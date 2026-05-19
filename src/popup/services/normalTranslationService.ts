import type { ApiConfig } from '../types/api';
import type { TranslationModeConfig } from '../types/translationMode';
import { requestChatResponse } from './openAiCompatibleClient';
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
let sequence = 0;
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
export function translateNormalMode(
  apiConfig: ApiConfig,
  modeConfig: TranslationModeConfig,
  input: NormalTranslationInput,
  targetLanguage: string,
): Promise<NormalTranslationResult> {
  currentConfig = modeConfig;
  currentApiConfig = apiConfig;
  currentTargetLanguage = targetLanguage;

  return new Promise((resolve, reject) => {
    queue.push({
      id: createTranslationCacheKey(input.text, sequence),
      text: input.text,
      resolve,
      reject,
    });
    sequence += 1;
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
  const batch = takeBatch(currentConfig);
  const idSet = new Set(batch.map((item) => item.id));
  const results = new Map<string, string | null>();

  try {
    const response = await requestChatResponse(currentApiConfig, buildRequestBody(currentConfig, batch));

    if (isStreamResponse(response)) {
      await readJsonlStream(response, idSet, (tid, text) => {
        if (!results.has(tid)) {
          results.set(tid, text);
          resolveMatched(batch, tid, text);
        }
      });
    } else {
      parseChatJsonlResults(await response.json(), idSet).forEach((text, tid) => results.set(tid, text));
    }

    batch.forEach((item) => item.resolve({ tid: item.id, text: results.get(item.id) ?? null }));
  } catch (error) {
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

function buildRequestBody(config: TranslationModeConfig, batch: PendingItem[]): Record<string, unknown> {
  return {
    stream: true,
    temperature: config.parameters.temperature,
    max_tokens: config.parameters.maxTokens,
    messages: [
      {
        role: 'user',
        content: `${renderPrompt(config)}\n${batch.map((item) => JSON.stringify({ [item.id]: item.text })).join('\n')}`,
      },
    ],
  };
}

function renderPrompt(config: TranslationModeConfig): string {
  const preserveText = config.options.preserveFormatting ? '保留原文格式' : '不保留原文格式';
  return config.prompt
    .replaceAll('{是否保留原文格式}', preserveText)
    .replaceAll('{目标语言(默认为界面语言)}', currentTargetLanguage || 'en-us');
}

async function readJsonlStream(
  response: Response,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
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
    jsonlBuffer = parseJsonlLines(`${jsonlBuffer}${parsed.content}`, idSet, onResult);
  }

  const parsed = readSseContent(`${eventBuffer}${decoder.decode()}\n\n`);
  parseJsonlLines(`${jsonlBuffer}${parsed.content}\n`, idSet, onResult);
}

function resolveMatched(batch: PendingItem[], tid: string, text: string | null): void {
  batch.find((item) => item.id === tid)?.resolve({ tid, text });
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
