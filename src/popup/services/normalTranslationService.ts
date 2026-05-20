import type { TranslationModeConfig } from '../types/translationMode';
import type {
  NormalTranslationInput,
  NormalTranslationPendingItem,
  NormalTranslationResult,
} from '../types/normalTranslation';
import { readCachedNormalTranslation } from './normalTranslationCache';
import { requestNormalTranslationBatch } from './normalTranslationBatchRequest';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';

export type { NormalTranslationInput, NormalTranslationResult } from '../types/normalTranslation';

const queue: NormalTranslationPendingItem[] = [];
const runningBatches = new Set<Promise<void>>();
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
  apiConfig: NormalTranslationPendingItem['apiConfig'],
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
    scheduleBatchDispatch(modeConfig);
  });
}

function scheduleBatchDispatch(config: TranslationModeConfig): void {
  if (shouldDispatchImmediately(config)) {
    window.clearTimeout(timer);
    timer = undefined;
    void dispatchReadyBatches();
    return;
  }

  if (!timer) {
    timer = window.setTimeout(() => void dispatchReadyBatches(), config.parameters.batchWaitMs);
  }
}

function shouldDispatchImmediately(config: TranslationModeConfig): boolean {
  return queue.length >= config.parameters.batchMaxItems || estimateBatchTokens(queue) >= config.parameters.batchMaxTokens;
}

async function dispatchReadyBatches(): Promise<void> {
  window.clearTimeout(timer);
  timer = undefined;

  while (queue.length > 0 && runningBatches.size < readMaxConcurrentBatchCount()) {
    const batch = takeBatch(queue[0].config);

    if (batch.length === 0) {
      break;
    }

    await assignBatchIds(batch);
    trackBatchRequest(requestNormalTranslationBatch(batch));
  }

  if (queue.length > 0 && !timer) {
    scheduleBatchDispatch(queue[0].config);
  }
}

function trackBatchRequest(request: Promise<void>): void {
  runningBatches.add(request);
  request.finally(() => {
    runningBatches.delete(request);
    void dispatchReadyBatches();
  }).catch(() => undefined);
}

function takeBatch(config: TranslationModeConfig): NormalTranslationPendingItem[] {
  const batch: NormalTranslationPendingItem[] = [];
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

    batch.push(queue.shift() as NormalTranslationPendingItem);
    tokens += nextTokens;
  }

  return batch;
}

function isSameBatchGroup(left: NormalTranslationPendingItem, right: NormalTranslationPendingItem): boolean {
  return left.config === right.config
    && left.apiConfig === right.apiConfig
    && left.targetLanguage === right.targetLanguage;
}

function readMaxConcurrentBatchCount(): number {
  const pendingConfig = queue[0]?.apiConfig;
  return Math.min(65536, Math.max(1, Math.floor(pendingConfig?.maxConcurrency ?? 1)));
}

function estimateBatchTokens(items: NormalTranslationPendingItem[]): number {
  return items.reduce((sum, item) => sum + estimateTextTokens(item.text), 0);
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

async function assignBatchIds(batch: NormalTranslationPendingItem[]): Promise<void> {
  await Promise.all(batch.map(async (item) => {
    item.id = await createTranslationCacheKey(item.text);
  }));
}
