import type { TranslationModeConfig } from '../types/translationMode';
import type {
  NormalTranslationInput,
  NormalTranslationPendingItem,
  NormalTranslationResult,
} from '../types/normalTranslation';
import { allocateCachedNormalTranslationTid, readCachedNormalTranslation } from './normalTranslationCache';
import { requestNormalTranslationBatch } from './normalTranslationBatchRequest';
import { createNormalTranslationRequestKey } from './normalTranslationRequestKey';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';

export type { NormalTranslationInput, NormalTranslationResult } from '../types/normalTranslation';

const queue: NormalTranslationPendingItem[] = [];
const runningBatches = new Set<Promise<void>>();
const inFlightTranslations = new Map<string, Promise<NormalTranslationResult>>();
const pendingInFlightKeys = new WeakMap<NormalTranslationPendingItem, string>();
const pendingPromises = new WeakMap<NormalTranslationPendingItem, Promise<NormalTranslationResult>>();
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
  const tid = await createTranslationCacheKey(input.text);

  if (!(await loadRuntimeSettings()).translationEnabled) {
    return {
      tid,
      text: null,
    };
  }

  const cachedResult = await readCachedNormalTranslation(modeConfig, input, targetLanguage);

  if (cachedResult) {
    return cachedResult;
  }

  const inFlightKey = createNormalTranslationRequestKey(apiConfig, modeConfig, input.text, targetLanguage, tid);
  const inFlightResult = inFlightTranslations.get(inFlightKey);

  if (inFlightResult) {
    return inFlightResult;
  }

  const nextResult = enqueueTranslation(apiConfig, modeConfig, input.text, targetLanguage, tid, inFlightKey);
  inFlightTranslations.set(inFlightKey, nextResult);
  return nextResult;
}

function enqueueTranslation(
  apiConfig: NormalTranslationPendingItem['apiConfig'],
  modeConfig: TranslationModeConfig,
  text: string,
  targetLanguage: string,
  tid: string,
  inFlightKey: string,
): Promise<NormalTranslationResult> {
  let resolveResult!: (result: NormalTranslationResult) => void;
  let rejectResult!: (error: unknown) => void;

  const result = new Promise<NormalTranslationResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const item: NormalTranslationPendingItem = {
    apiConfig,
    config: modeConfig,
    id: tid,
    targetLanguage,
    text,
    resolve: resolveResult,
    reject: rejectResult,
  };

  pendingInFlightKeys.set(item, inFlightKey);
  pendingPromises.set(item, result);
  queue.push(item);
  scheduleBatchDispatch(modeConfig);
  return result;
}

function releaseBatchInFlightEntries(batch: NormalTranslationPendingItem[]): void {
  batch.forEach((item) => {
    const key = pendingInFlightKeys.get(item);
    const promise = pendingPromises.get(item);

    if (key && promise && inFlightTranslations.get(key) === promise) {
      inFlightTranslations.delete(key);
    }
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
    trackBatchRequest(requestNormalTranslationBatch(batch), batch);
  }

  if (queue.length > 0 && !timer) {
    scheduleBatchDispatch(queue[0].config);
  }
}

function trackBatchRequest(request: Promise<void>, batch: NormalTranslationPendingItem[]): void {
  runningBatches.add(request);
  request.finally(() => {
    runningBatches.delete(request);
    releaseBatchInFlightEntries(batch);
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
    item.id = await allocateCachedNormalTranslationTid(item.config, item.text, item.targetLanguage);
  }));
}
