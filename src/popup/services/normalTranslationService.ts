import type { ApiConfig } from '../types/api';
import type { TranslationModeConfig } from '../types/translationMode';
import { failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';
import { readCachedNormalTranslation, writeCachedNormalTranslation } from './normalTranslationCache';
import { requestChatResponse } from './openAiCompatibleClient';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';
import { parseChatJsonlResults, parseJsonlLines, readSseContent } from './translationJsonlParser';

export interface NormalTranslationInput {
  text: string;
}

export interface NormalTranslationResult {
  tid: string;
  text: string | null;
}

interface PendingItem {
  id: string;
  text: string;
  resolve: (result: NormalTranslationResult) => void;
  reject: (error: unknown) => void;
}

const queue: PendingItem[] = [];
let timer: number | undefined;
let currentConfig: TranslationModeConfig | undefined;
let currentApiConfig: ApiConfig | undefined;
let currentTargetLanguage = '';

/**
 * 提交普通模式翻译。
 *
 * @param apiConfig API 配置。
 * @param modeConfig 普通模式配置。
 * @param input 翻译输入。
 * @param targetLanguage 目标语言。
 * @returns 翻译结果。
 */
export async function translateNormalMode(
  apiConfig: ApiConfig,
  modeConfig: TranslationModeConfig,
  input: NormalTranslationInput,
  targetLanguage: string,
): Promise<NormalTranslationResult> {
  if (!(await loadRuntimeSettings()).translationEnabled) {
    return {
      tid: await createTranslationCacheKey(input.text),
      text: null,
    };
  }

  const cachedResult = await readCachedNormalTranslation(modeConfig, input);

  if (cachedResult) {
    return cachedResult;
  }

  currentConfig = modeConfig;
  currentApiConfig = apiConfig;
  currentTargetLanguage = targetLanguage;

  return new Promise((resolve, reject) => {
    queue.push({
      id: '',
      text: input.text,
      resolve,
      reject,
    });
    scheduleFlush();
  });
}

function scheduleFlush(): void {
  if (!currentConfig) {
    return;
  }

  if (shouldFlushImmediately(currentConfig)) {
    window.clearTimeout(timer);
    timer = undefined;
    void flushQueue();
    return;
  }

  if (timer) {
    return;
  }

  timer = window.setTimeout(() => void flushQueue(), currentConfig.parameters.batchWaitMs);
}

function shouldFlushImmediately(config: TranslationModeConfig): boolean {
  return queue.length >= config.parameters.batchMaxItems || estimateBatchTokens(queue) >= config.parameters.batchMaxTokens;
}

async function flushQueue(): Promise<void> {
  if (!currentApiConfig || !currentConfig || queue.length === 0) {
    return;
  }

  window.clearTimeout(timer);
  timer = undefined;
  const activeConfig = currentConfig;
  const activeApiConfig = currentApiConfig;
  const activeTargetLanguage = currentTargetLanguage;
  const batch = takeBatch(activeConfig);
  await assignBatchIds(batch);
  const body = buildRequestBody(activeConfig, batch, activeTargetLanguage);
  const idSet = new Set(batch.map((item) => item.id));
  const results = new Map<string, string | null>();

  let callLog: Awaited<ReturnType<typeof requestChatResponse>>['callLog'] | undefined;

  try {
    const responseInfo = await requestChatResponse(activeApiConfig, body);
    callLog = responseInfo.callLog;
    const activeCallLog = responseInfo.callLog;

    if (isStreamResponse(responseInfo.response)) {
      let streamOutput = '';
      await readJsonlStream(responseInfo.response, idSet, (tid, text) => {
        if (!results.has(tid)) {
          results.set(tid, text);
          resolveMatched(batch, activeConfig, tid, text);
        }
      }, async (content) => {
        streamOutput += content;
        await updateRequestOutput(activeCallLog, streamOutput);
      });
      await updateRequestOutput(activeCallLog, streamOutput, true);
      await recordTranslationUsage(activeApiConfig, body, streamOutput);
    } else {
      const responseData = await responseInfo.response.json();
      const content = readChatContent(responseData);
      await updateRequestOutput(activeCallLog, content, true);
      await recordTranslationUsage(activeApiConfig, body, content, responseData);
      parseChatJsonlResults(responseData, idSet).forEach((text, tid) => {
        results.set(tid, text);
      });
    }

    await writeBatchCache(batch, activeConfig, results);
    batch.forEach((item) => item.resolve({ tid: item.id, text: results.get(item.id) ?? null }));
  } catch (error) {
    if (callLog) {
      await failRequestLog(callLog, error);
    }

    batch.forEach((item) => item.reject(error));
  }
}

function takeBatch(config: TranslationModeConfig): PendingItem[] {
  const batch: PendingItem[] = [];
  let tokens = 0;

  while (queue.length > 0 && batch.length < config.parameters.batchMaxItems) {
    const next = queue[0];
    const nextTokens = estimateTextTokens(next.text);

    if (batch.length > 0 && tokens + nextTokens > config.parameters.batchMaxTokens) {
      break;
    }

    batch.push(queue.shift() as PendingItem);
    tokens += nextTokens;
  }

  if (queue.length > 0) {
    scheduleFlush();
  }

  return batch;
}

function buildRequestBody(
  config: TranslationModeConfig,
  batch: PendingItem[],
  targetLanguage: string,
): Record<string, unknown> {
  return {
    stream: true,
    temperature: config.parameters.temperature,
    max_tokens: config.parameters.maxTokens,
    messages: [
      {
        role: 'system',
        content: renderPrompt(config, targetLanguage),
      },
      {
        role: 'user',
        content: batch.map((item) => JSON.stringify({ [item.id]: item.text })).join('\n'),
      },
    ],
  };
}

function renderPrompt(config: TranslationModeConfig, targetLanguage: string): string {
  const preserveText = config.options.preserveFormatting
    ? 'Preserve source formatting and placeholders'
    : 'Output plain translated text';
  return config.prompt
    .replaceAll('{FORMAT_MODE}', preserveText)
    .replaceAll('{TARGET_LOCALE}', targetLanguage || 'en-us');
}

async function readJsonlStream(
  response: Response,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
  onContent: (content: string) => void | Promise<void>,
): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let eventBuffer = '';
  let jsonlBuffer = '';

  if (!reader) {
    return;
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    eventBuffer += decoder.decode(value, { stream: true });
    const parsed = readSseContent(eventBuffer);
    eventBuffer = parsed.rest;
    if (parsed.content) {
      await onContent(parsed.content);
    }
    jsonlBuffer = parseJsonlLines(`${jsonlBuffer}${parsed.content}`, idSet, onResult);
  }

  const parsed = readSseContent(`${eventBuffer}${decoder.decode()}\n\n`);
  if (parsed.content) {
    await onContent(parsed.content);
  }
  parseJsonlLines(`${jsonlBuffer}${parsed.content}\n`, idSet, onResult);
}

function resolveMatched(
  batch: PendingItem[],
  config: TranslationModeConfig,
  tid: string,
  text: string | null,
): void {
  const item = batch.find((pendingItem) => pendingItem.id === tid);
  if (!item) {
    return;
  }

  void writeCacheIfEnabled(config, item.text, text);
  item.resolve({ tid, text });
}

function isStreamResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/event-stream') ?? false;
}

function estimateBatchTokens(items: PendingItem[]): number {
  return items.reduce((sum, item) => sum + estimateTextTokens(item.text), 0);
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

async function assignBatchIds(batch: PendingItem[]): Promise<void> {
  for (const item of batch) {
    item.id = await createTranslationCacheKey(item.text);
  }
}

async function writeBatchCache(
  batch: PendingItem[],
  config: TranslationModeConfig,
  results: Map<string, string | null>,
): Promise<void> {
  await Promise.all(
    batch.map(async (item) => {
      if (results.has(item.id)) {
        await writeCachedNormalTranslation(config, item.text, results.get(item.id) ?? null);
      }
    }),
  );
}

async function writeCacheIfEnabled(
  config: TranslationModeConfig,
  sourceText: string,
  text: string | null,
): Promise<void> {
  await writeCachedNormalTranslation(config, sourceText, text);
}

function readChatContent(data: unknown): string {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return response.choices?.[0]?.message?.content ?? '';
}

async function recordTranslationUsage(
  config: ApiConfig,
  requestBody: Record<string, unknown>,
  content: string,
  responseData?: unknown,
): Promise<void> {
  const usage = readUsage(responseData);
  await recordModelUsage({
    model: config.model,
    inputTokens: usage?.prompt_tokens ?? estimateTextTokens(JSON.stringify(requestBody)),
    outputTokens: usage?.completion_tokens ?? estimateTextTokens(content),
  });
}

function readUsage(data: unknown): { completion_tokens?: number; prompt_tokens?: number } | undefined {
  return (data as { usage?: { completion_tokens?: number; prompt_tokens?: number } } | undefined)?.usage;
}
