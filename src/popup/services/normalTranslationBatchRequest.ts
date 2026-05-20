import type { ApiConfig } from '../types/api';
import type { NormalTranslationPendingItem } from '../types/normalTranslation';
import type { TranslationModeConfig } from '../types/translationMode';
import { failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';
import { writeCachedNormalTranslationBatch } from './normalTranslationCache';
import { ensureCompleteTranslationResults, ensureNonEmptyStreamOutput } from './normalTranslationResultGuard';
import { requestChatResponse } from './openAiCompatibleClient';
import { parseChatJsonlResults } from './translationJsonlParser';
import { normalizeNoTranslationResult } from './translationResultNormalizer';
import { readJsonlTranslationStream } from './translationStreamReader';

const languageNames: Record<string, string> = {
  'en-us': '美国英语',
  'zh-hans': '简体中文',
};
const outputExamples: Record<string, string[]> = {
  'en-us': [
    '输入：',
    '{"tid-a":"标题"}',
    '{"tid-b":"你好，世界"}',
    '{"tid-c":"OpenAI"}',
    '输出：',
    '{"tid-a":"Title"}',
    '{"tid-b":"Hello world"}',
    '{"tid-c":null}',
  ],
  'zh-hans': [
    '输入：',
    '{"tid-a":"Title"}',
    '{"tid-b":"Hello world"}',
    '{"tid-c":"OpenAI"}',
    '输出：',
    '{"tid-a":"标题"}',
    '{"tid-b":"你好，世界"}',
    '{"tid-c":null}',
  ],
};

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
  const idSet = new Set(readRequiredItems(batch).map((item) => item.id));
  const results = new Map<string, string | null>();
  let callLog: Awaited<ReturnType<typeof requestChatResponse>>['callLog'] | undefined;

  try {
    callLog = await readBatchResults(apiConfig, batch, body, idSet, results);
    ensureCompleteTranslationResults(results, idSet);
    normalizeBatchResults(batch, results);
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
        content: createUniqueBatchItems(batch).map(formatBatchItem).join('\n'),
      },
    ],
  };
}

function renderPrompt(config: TranslationModeConfig, targetLanguage: string): string {
  const preserveText = config.options.preserveFormatting
    ? '保留原文格式和占位符'
    : '输出纯译文文本';
  return config.prompt
    .replaceAll('{FORMAT_MODE}', preserveText)
    .replaceAll('{TARGET_LOCALE}', describeTargetLanguage(targetLanguage))
    .replaceAll('{OUTPUT_EXAMPLE}', createOutputExample(targetLanguage));
}

function describeTargetLanguage(targetLanguage: string): string {
  const language = targetLanguage.trim().toLowerCase() || 'en-us';
  return languageNames[language] ?? language;
}

function createOutputExample(targetLanguage: string): string {
  const language = targetLanguage.trim().toLowerCase() || 'en-us';
  return (outputExamples[language] ?? outputExamples['en-us']).join('\n');
}

async function readBatchResults(
  apiConfig: ApiConfig,
  batch: NormalTranslationPendingItem[],
  body: Record<string, unknown>,
  idSet: Set<string>,
  results: Map<string, string | null>,
): Promise<Awaited<ReturnType<typeof requestChatResponse>>['callLog']> {
  const responseInfo = await requestChatResponse(apiConfig, body);

  if (isStreamResponse(responseInfo.response)) {
    await readStreamBatchResults(responseInfo, batch, body, results, idSet);
  } else {
    await readJsonBatchResults(responseInfo, apiConfig, body, results, idSet);
  }

  return responseInfo.callLog;
}

async function readStreamBatchResults(
  responseInfo: Awaited<ReturnType<typeof requestChatResponse>>,
  batch: NormalTranslationPendingItem[],
  body: Record<string, unknown>,
  results: Map<string, string | null>,
  idSet: Set<string>,
): Promise<void> {
  let streamOutput = '';
  let rawOutput = '';

  await readJsonlTranslationStream({
    idSet,
    release: responseInfo.release,
    response: responseInfo.response,
    onResult: (tid, text) => {
      if (!results.has(tid)) {
        const normalizedText = normalizeBatchResultText(batch, tid, text);
        results.set(tid, normalizedText);
      }
    },
    onContent: async (content) => {
      streamOutput += content;
    },
    onRawChunk: async (chunk) => {
      rawOutput += chunk;
      await updateRequestOutput(responseInfo.callLog, rawOutput);
    },
  });
  ensureNonEmptyStreamOutput(streamOutput);
  ensureCompleteTranslationResults(results, idSet);
  await updateRequestOutput(responseInfo.callLog, rawOutput || streamOutput, true);
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
  await updateRequestOutput(responseInfo.callLog, JSON.stringify(responseData, null, 2), true);
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
  readRequiredItems(batch).forEach((item) => {
    if (results.has(item.id)) {
      item.resolve({ tid: item.id, text: results.get(item.id) ?? null });
      return;
    }

    item.reject(new Error('api.errors.translationResultMissing'));
  });
}

function normalizeBatchResults(
  batch: NormalTranslationPendingItem[],
  results: Map<string, string | null>,
): void {
  results.forEach((text, tid) => results.set(tid, normalizeBatchResultText(batch, tid, text)));
}

function normalizeBatchResultText(
  batch: NormalTranslationPendingItem[],
  tid: string,
  text: string | null,
): string | null {
  const item = batch.find((pendingItem) => pendingItem.id === tid);
  return item ? normalizeNoTranslationResult(text, item.text, item.targetLanguage) : text;
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
      .filter((item) => item.cacheWrite !== false && results.has(item.id))
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

function readRequiredItems(batch: NormalTranslationPendingItem[]): NormalTranslationPendingItem[] {
  return batch.filter((item) => item.required !== false);
}

function formatBatchItem(item: NormalTranslationPendingItem): string {
  return JSON.stringify({ [item.id]: item.text });
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
