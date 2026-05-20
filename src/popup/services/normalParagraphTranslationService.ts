import type { TranslationModeConfig } from '../types/translationMode';
import type { NormalTranslationPendingItem, NormalTranslationResult } from '../types/normalTranslation';
import { allocateCachedNormalTranslationTid, readCachedNormalTranslation } from './normalTranslationCache';
import { requestNormalTranslationBatch } from './normalTranslationBatchRequest';
import { loadRuntimeSettings } from './runtimeSettingsStorage';
import { createTranslationCacheKey } from './translationCacheKey';

/**
 * 普通模式段落翻译输入。
 */
export interface NormalParagraphTranslationInput {
  depth: number;
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

  const cachedResults = await readCachedParagraphResults(modeConfig, inputs, targetLanguage);

  if (cachedResults.every(Boolean)) {
    return cachedResults as NormalTranslationResult[];
  }

  const items = await Promise.all(inputs.map((input) => createParagraphPendingItem(
    apiConfig,
    modeConfig,
    input,
    targetLanguage,
  )));
  await requestNormalTranslationBatch(items);
  return Promise.all(items.map(readParagraphResult));
}

async function readCachedParagraphResults(
  modeConfig: TranslationModeConfig,
  inputs: NormalParagraphTranslationInput[],
  targetLanguage: string,
): Promise<Array<NormalTranslationResult | undefined>> {
  return Promise.all(inputs.map((input) => readCachedNormalTranslation(modeConfig, { text: input.text }, targetLanguage)));
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
    depth: input.depth,
    id: await allocateCachedNormalTranslationTid(modeConfig, input.text, targetLanguage),
    promise: result,
    targetLanguage,
    text: input.text,
    resolve: resolveResult,
    reject: rejectResult,
  };
}

async function readParagraphResult(item: NormalTranslationPendingItem): Promise<NormalTranslationResult> {
  if (!item.promise) {
    throw new Error('api.errors.translationResultMissing');
  }

  return item.promise;
}
