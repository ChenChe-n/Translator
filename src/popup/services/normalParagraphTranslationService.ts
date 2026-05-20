import type { TranslationModeConfig } from '../types/translationMode';
import type { NormalTranslationPendingItem, NormalTranslationResult } from '../types/normalTranslation';
import { allocateCachedNormalTranslationTid, readCachedNormalTranslation } from './normalTranslationCache';
import { requestNormalTranslationBatch } from './normalTranslationBatchRequest';
import { createNormalTranslationRequestKey } from './normalTranslationRequestKey';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';

const inFlightParagraphItems = new Map<string, Promise<NormalTranslationResult>>();
const pendingParagraphKeys = new WeakMap<NormalTranslationPendingItem, string>();

type ParagraphResultSlot = NormalTranslationResult | Promise<NormalTranslationResult> | undefined;
type ParagraphRequestItem = NormalTranslationPendingItem & { required: true };

/**
 * 普通模式段落翻译输入。
 */
export interface NormalParagraphTranslationInput {
  text: string;
}

/**
 * 提交普通模式段落翻译。
 *
 * @param apiConfig API 配置。
 * @param modeConfig 普通模式配置。
 * @param inputs 段落文本输入。
 * @param targetLanguage 目标语言。
 * @returns 翻译结果列表。
 */
export async function translateNormalParagraphMode(
  apiConfig: NormalTranslationPendingItem['apiConfig'],
  modeConfig: TranslationModeConfig,
  inputs: NormalParagraphTranslationInput[],
  targetLanguage: string,
): Promise<NormalTranslationResult[]> {
  if (!(await loadRuntimeSettings()).translationEnabled) {
    return Promise.all(inputs.map(async (input) => ({
      text: null,
      tid: await createTranslationCacheKey(input.text),
    })));
  }

  const results = await readCachedParagraphResults(modeConfig, inputs, targetLanguage);
  const requestItems = await collectRequestItems(apiConfig, modeConfig, inputs, targetLanguage, results);
  const requiredItems = requestItems.filter(isRequiredRequestItem);

  if (requiredItems.length > 0) {
    await assignParagraphItemIds(requiredItems);

    try {
      await requestNormalTranslationBatch(requestItems);
    } finally {
      releaseInFlightParagraphItems(requiredItems);
    }
  }

  return Promise.all(results.map(readParagraphResult));
}

async function readCachedParagraphResults(
  modeConfig: TranslationModeConfig,
  inputs: NormalParagraphTranslationInput[],
  targetLanguage: string,
): Promise<Array<NormalTranslationResult | undefined>> {
  return Promise.all(inputs.map((input) => readCachedNormalTranslation(modeConfig, { text: input.text }, targetLanguage)));
}

async function collectRequestItems(
  apiConfig: NormalTranslationPendingItem['apiConfig'],
  modeConfig: TranslationModeConfig,
  inputs: NormalParagraphTranslationInput[],
  targetLanguage: string,
  results: ParagraphResultSlot[],
): Promise<NormalTranslationPendingItem[]> {
  const items: Array<NormalTranslationPendingItem | undefined> = [];

  await Promise.all(inputs.map(async (input, index) => {
    const cachedResult = results[index];

    if (cachedResult) {
      items[index] = await createParagraphContextItem(apiConfig, modeConfig, input, targetLanguage, cachedResult);
      return;
    }

    const item = await createParagraphPendingItem(apiConfig, modeConfig, input, targetLanguage);
    const requestKey = createNormalTranslationRequestKey(apiConfig, modeConfig, input.text, targetLanguage, item.id);
    const inFlightResult = inFlightParagraphItems.get(requestKey);

    if (inFlightResult) {
      results[index] = inFlightResult;
      return;
    }

    const itemPromise = readPendingItemPromise(item);
    pendingParagraphKeys.set(item, requestKey);
    inFlightParagraphItems.set(requestKey, itemPromise);
    results[index] = itemPromise;
    items[index] = item;
  }));

  return items.filter((item): item is NormalTranslationPendingItem => Boolean(item));
}

async function createParagraphPendingItem(
  apiConfig: NormalTranslationPendingItem['apiConfig'],
  modeConfig: TranslationModeConfig,
  input: NormalParagraphTranslationInput,
  targetLanguage: string,
): Promise<NormalTranslationPendingItem> {
  let resolveResult!: (result: NormalTranslationResult) => void;
  let rejectResult!: (error: unknown) => void;
  const result = new Promise<NormalTranslationResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  return {
    apiConfig,
    config: modeConfig,
    id: await createTranslationCacheKey(input.text),
    promise: result,
    required: true,
    targetLanguage,
    text: input.text,
    resolve: resolveResult,
    reject: rejectResult,
  };
}

async function readParagraphResult(result: ParagraphResultSlot): Promise<NormalTranslationResult> {
  if (!result) {
    throw new Error('api.errors.translationResultMissing');
  }

  return result;
}

function readPendingItemPromise(item: NormalTranslationPendingItem): Promise<NormalTranslationResult> {
  if (!item.promise) {
    throw new Error('api.errors.translationResultMissing');
  }

  return item.promise;
}

async function createParagraphContextItem(
  apiConfig: NormalTranslationPendingItem['apiConfig'],
  modeConfig: TranslationModeConfig,
  input: NormalParagraphTranslationInput,
  targetLanguage: string,
  result: NormalTranslationResult | Promise<NormalTranslationResult>,
): Promise<NormalTranslationPendingItem> {
  const resolvedResult = await result;

  return {
    apiConfig,
    cacheWrite: false,
    config: modeConfig,
    id: resolvedResult.tid,
    required: false,
    targetLanguage,
    text: input.text,
    resolve: () => undefined,
    reject: () => undefined,
  };
}

async function assignParagraphItemIds(items: ParagraphRequestItem[]): Promise<void> {
  await Promise.all(items.map(async (item) => {
    item.id = await allocateCachedNormalTranslationTid(item.config, item.text, item.targetLanguage);
  }));
}

function isRequiredRequestItem(item: NormalTranslationPendingItem): item is ParagraphRequestItem {
  return item.required === true;
}

function releaseInFlightParagraphItems(items: ParagraphRequestItem[]): void {
  items.forEach((item) => {
    const requestKey = pendingParagraphKeys.get(item);

    if (!requestKey) {
      return;
    }

    const promise = inFlightParagraphItems.get(requestKey);

    if (promise === item.promise) {
      inFlightParagraphItems.delete(requestKey);
    }
  });
}
