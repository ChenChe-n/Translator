import type { ApiConfig } from '../types/api';
import type { TranslationModeConfig } from '../types/translationMode';
import { failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';
import { readCachedNormalTranslation, writeCachedNormalTranslation } from './normalTranslationCache';
import { requestChatResponse } from './openAiCompatibleClient';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';
import { parseChatJsonlResults } from './translationJsonlParser';
import { readJsonlTranslationStream } from './translationStreamReader';

export interface NormalTranslationInput {
  text: string;
}

export interface NormalTranslationResult {
  tid: string;
  text: string | null;
}

interface PendingItem {
  apiConfig: ApiConfig;
  config: TranslationModeConfig;
  id: string;
  targetLanguage: string;
  text: string;
  resolve: (result: NormalTranslationResult) => void;
  reject: (error: unknown) => void;
}

const queue: PendingItem[] = [];
let timer: number | undefined;

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

  const cachedResult = await readCachedNormalTranslation(modeConfig, input, targetLanguage);

  if (cachedResult) {
    return cachedResult;
  }

  return new Promise((resolve, reject) => {
    queue.push({
      apiConfig,
      config: modeConfig,
      id: '',
      targetLanguage,
      text: input.text,
      resolve,
      reject,
    });
    scheduleFlush(modeConfig);
  });
}

function scheduleFlush(config: TranslationModeConfig): void {
  if (shouldFlushImmediately(config)) {
    window.clearTimeout(timer);
    timer = undefined;
    void flushQueue();
    return;
  }

  if (timer) {
    return;
  }

  timer = window.setTimeout(() => void flushQueue(), config.parameters.batchWaitMs);
}

function shouldFlushImmediately(config: TranslationModeConfig): boolean {
  return queue.length >= config.parameters.batchMaxItems || estimateBatchTokens(queue) >= config.parameters.batchMaxTokens;
}

async function flushQueue(): Promise<void> {
  if (queue.length === 0) {
    return;
  }

  window.clearTimeout(timer);
  timer = undefined;
  const activeConfig = queue[0].config;
  const activeApiConfig = queue[0].apiConfig;
  const activeTargetLanguage = queue[0].targetLanguage;
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
      await readJsonlTranslationStream({
        idSet,
        release: responseInfo.release,
        response: responseInfo.response,
        onResult: (tid, text) => {
          if (!results.has(tid)) {
            results.set(tid, text);
            resolveMatched(batch, activeConfig, tid, text);
          }
        },
        onContent: async (content) => {
          streamOutput += content;
          await updateRequestOutput(activeCallLog, streamOutput);
        },
      });
      await updateRequestOutput(activeCallLog, streamOutput, true);
      await recordTranslationUsage(activeApiConfig, body, streamOutput);
    } else {
      const responseData = await readJsonResponse(responseInfo.response, responseInfo.release);
      const content = readChatContent(responseData);
      await updateRequestOutput(activeCallLog, content, true);
      await recordTranslationUsage(activeApiConfig, body, content, responseData);
      parseChatJsonlResults(responseData, idSet).forEach((text, tid) => {
        results.set(tid, text);
      });
    }

    await writeBatchCache(batch, activeConfig, results);
    resolveBatchResults(batch, results);
  } catch (error) {
    if (callLog) {
      await failRequestLog(callLog, error);
    }

    batch.forEach((item) => item.reject(error));
  }
}

function resolveBatchResults(batch: PendingItem[], results: Map<string, string | null>): void {
  batch.forEach((item) => {
    if (results.has(item.id)) {
      item.resolve({ tid: item.id, text: results.get(item.id) ?? null });
      return;
    }

    item.reject(new Error('api.errors.translationResultMissing'));
  });
}

function takeBatch(config: TranslationModeConfig): PendingItem[] {
  const batch: PendingItem[] = [];
  let tokens = 0;

  while (queue.length > 0 && batch.length < config.parameters.batchMaxItems) {
    const next = queue[0];
    const nextTokens = estimateTextTokens(next.text);

    if (batch.length > 0 && !isSameBatchGroup(batch[0], next)) {
      break;
    }

    if (batch.length > 0 && tokens + nextTokens > config.parameters.batchMaxTokens) {
      break;
    }

    batch.push(queue.shift() as PendingItem);
    tokens += nextTokens;
  }

  if (queue.length > 0) {
    scheduleFlush(queue[0].config);
  }

  return batch;
}

function isSameBatchGroup(left: PendingItem, right: PendingItem): boolean {
  return left.config === right.config
    && left.apiConfig === right.apiConfig
    && left.targetLanguage === right.targetLanguage;
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

async function readJsonResponse(response: Response, release: () => void): Promise<unknown> {
  try {
    return await response.json();
  } finally {
    release();
  }
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

  void writeCacheIfEnabled(config, item.text, text, item.targetLanguage);
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
        await writeCachedNormalTranslation(config, item.text, results.get(item.id) ?? null, item.targetLanguage);
      }
    }),
  );
}

async function writeCacheIfEnabled(
  config: TranslationModeConfig,
  sourceText: string,
  text: string | null,
  targetLanguage: string,
): Promise<void> {
  await writeCachedNormalTranslation(config, sourceText, text, targetLanguage);
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
