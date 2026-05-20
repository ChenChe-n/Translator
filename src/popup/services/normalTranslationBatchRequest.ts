import type { ApiConfig } from '../types/api';
import type { NormalTranslationPendingItem } from '../types/normalTranslation';
import type { TranslationModeConfig } from '../types/translationMode';
import { failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';
import {
  writeCachedNormalTranslation,
  writeCachedNormalTranslationBatch,
} from './normalTranslationCache';
import { requestChatResponse } from './openAiCompatibleClient';
import { parseChatJsonlResults } from './translationJsonlParser';
import { readJsonlTranslationStream } from './translationStreamReader';

/**
 * 请求一个普通模式翻译批次。
 *
 * @param batch 普通翻译批次。
 * @returns 无返回值。
 */
export async function requestNormalTranslationBatch(batch: NormalTranslationPendingItem[]): Promise<void> {
  const config = batch[0].config;
  const apiConfig = batch[0].apiConfig;
  const body = buildRequestBody(config, batch, batch[0].targetLanguage);
  const idSet = new Set(batch.map((item) => item.id));
  const results = new Map<string, string | null>();
  let callLog: Awaited<ReturnType<typeof requestChatResponse>>['callLog'] | undefined;

  try {
    callLog = await readBatchResults(apiConfig, config, batch, body, idSet, results);
    await writeBatchCache(batch, config, results);
    resolveBatchResults(batch, results);
  } catch (error) {
    if (callLog) {
      await failRequestLog(callLog, error);
    }

    batch.forEach((item) => item.reject(error));
  }
}

function buildRequestBody(
  config: TranslationModeConfig,
  batch: NormalTranslationPendingItem[],
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
        content: createUniqueBatchItems(batch).map((item) => JSON.stringify({ [item.id]: item.text })).join('\n'),
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

async function readBatchResults(
  apiConfig: ApiConfig,
  config: TranslationModeConfig,
  batch: NormalTranslationPendingItem[],
  body: Record<string, unknown>,
  idSet: Set<string>,
  results: Map<string, string | null>,
): Promise<Awaited<ReturnType<typeof requestChatResponse>>['callLog']> {
  const responseInfo = await requestChatResponse(apiConfig, body);

  if (isStreamResponse(responseInfo.response)) {
    await readStreamBatchResults(responseInfo, config, batch, body, results, idSet);
  } else {
    await readJsonBatchResults(responseInfo, apiConfig, body, results, idSet);
  }

  return responseInfo.callLog;
}

async function readStreamBatchResults(
  responseInfo: Awaited<ReturnType<typeof requestChatResponse>>,
  config: TranslationModeConfig,
  batch: NormalTranslationPendingItem[],
  body: Record<string, unknown>,
  results: Map<string, string | null>,
  idSet: Set<string>,
): Promise<void> {
  let streamOutput = '';

  await readJsonlTranslationStream({
    idSet,
    release: responseInfo.release,
    response: responseInfo.response,
    onResult: (tid, text) => {
      if (!results.has(tid)) {
        results.set(tid, text);
        resolveMatched(batch, config, tid, text);
      }
    },
    onContent: async (content) => {
      streamOutput += content;
      await updateRequestOutput(responseInfo.callLog, streamOutput);
    },
  });
  await updateRequestOutput(responseInfo.callLog, streamOutput, true);
  await recordTranslationUsage(batch[0].apiConfig, body, streamOutput);
}

async function readJsonBatchResults(
  responseInfo: Awaited<ReturnType<typeof requestChatResponse>>,
  apiConfig: ApiConfig,
  body: Record<string, unknown>,
  results: Map<string, string | null>,
  idSet: Set<string>,
): Promise<void> {
  const responseData = await readJsonResponse(responseInfo.response, responseInfo.release);
  const content = readChatContent(responseData);
  await updateRequestOutput(responseInfo.callLog, content, true);
  await recordTranslationUsage(apiConfig, body, content, responseData);
  parseChatJsonlResults(responseData, idSet).forEach((text, tid) => results.set(tid, text));
}

async function readJsonResponse(response: Response, release: () => void): Promise<unknown> {
  try {
    return await response.json();
  } finally {
    release();
  }
}

function resolveBatchResults(batch: NormalTranslationPendingItem[], results: Map<string, string | null>): void {
  batch.forEach((item) => {
    if (results.has(item.id)) {
      item.resolve({ tid: item.id, text: results.get(item.id) ?? null });
      return;
    }

    item.reject(new Error('api.errors.translationResultMissing'));
  });
}

function resolveMatched(
  batch: NormalTranslationPendingItem[],
  config: TranslationModeConfig,
  tid: string,
  text: string | null,
): void {
  const matchedItems = batch.filter((pendingItem) => pendingItem.id === tid);

  matchedItems.forEach((item) => {
    void writeCachedNormalTranslation(config, item.text, text, item.targetLanguage)
      .catch(() => undefined);
    item.resolve({ tid, text });
  });
}

function isStreamResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/event-stream') ?? false;
}

async function writeBatchCache(
  batch: NormalTranslationPendingItem[],
  config: TranslationModeConfig,
  results: Map<string, string | null>,
): Promise<void> {
  await writeCachedNormalTranslationBatch(
    config,
    batch
      .filter((item) => results.has(item.id))
      .map((item) => ({
        sourceText: item.text,
        targetLanguage: item.targetLanguage,
        text: results.get(item.id) ?? null,
      })),
  );
}

function readChatContent(data: unknown): string {
  const response = data as { choices?: Array<{ message?: { content?: string } }>; };
  return response.choices?.[0]?.message?.content ?? '';
}

function createUniqueBatchItems(batch: NormalTranslationPendingItem[]): NormalTranslationPendingItem[] {
  const itemMap = new Map<string, NormalTranslationPendingItem>();

  batch.forEach((item) => {
    if (!itemMap.has(item.id)) {
      itemMap.set(item.id, item);
    }
  });

  return [...itemMap.values()];
}

async function recordTranslationUsage(
  config: ApiConfig,
  requestBody: Record<string, unknown>,
  content: string,
  responseData?: unknown,
): Promise<void> {
  const usage = (responseData as { usage?: { completion_tokens?: number; prompt_tokens?: number } } | undefined)?.usage;
  await recordModelUsage({
    model: config.model,
    inputTokens: usage?.prompt_tokens ?? estimateTextTokens(JSON.stringify(requestBody)),
    outputTokens: usage?.completion_tokens ?? estimateTextTokens(content),
  });
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
