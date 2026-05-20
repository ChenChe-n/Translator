import type { TranslationModeConfig } from '../types/translationMode';
import type { NormalTranslationInput, NormalTranslationResult } from '../types/normalTranslation';
import {
  readNormalTranslationCache,
  writeNormalTranslationCache,
  writeNormalTranslationCacheBatch,
} from './translationCacheStorage';
import { createTranslationCacheKey } from './translationCacheKey';

/**
 * 读取普通模式翻译缓存结果。
 *
 * @param config 翻译配置。
 * @param input 翻译输入。
 * @returns 命中的翻译结果。
 */
export async function readCachedNormalTranslation(
  config: TranslationModeConfig,
  input: NormalTranslationInput,
  targetLanguage: string,
): Promise<NormalTranslationResult | undefined> {
  if (!shouldUseNormalTranslationCache(config)) {
    return undefined;
  }

  const tid = await createTranslationCacheKey(input.text);
  const cached = await readNormalTranslationCache({
    sourceText: input.text,
    targetLanguage,
    tid,
  });

  return cached
    ? {
        tid,
        text: cached.text,
      }
    : undefined;
}

/**
 * 写入普通模式翻译缓存。
 *
 * @param config 翻译配置。
 * @param sourceText 原文。
 * @param text 译文。
 * @returns 无返回值。
 */
export async function writeCachedNormalTranslation(
  config: TranslationModeConfig,
  sourceText: string,
  text: string | null,
  targetLanguage: string,
): Promise<void> {
  if (!shouldUseNormalTranslationCache(config)) {
    return;
  }

  await writeNormalTranslationCache({
    sourceText,
    targetLanguage,
    tid: await createTranslationCacheKey(sourceText),
  }, text);
}

/**
 * 批量写入普通模式翻译缓存。
 *
 * @param config 翻译配置。
 * @param entries 缓存写入列表。
 * @returns 无返回值。
 */
export async function writeCachedNormalTranslationBatch(
  config: TranslationModeConfig,
  entries: Array<{ sourceText: string; targetLanguage: string; text: string | null }>,
): Promise<void> {
  if (!shouldUseNormalTranslationCache(config) || entries.length === 0) {
    return;
  }

  await writeNormalTranslationCacheBatch(await Promise.all(entries.map(async (entry) => ({
    input: {
      sourceText: entry.sourceText,
      targetLanguage: entry.targetLanguage,
      tid: await createTranslationCacheKey(entry.sourceText),
    },
    text: entry.text,
  }))));
}

function shouldUseNormalTranslationCache(config: TranslationModeConfig): boolean {
  return config.mode === 'normal' && config.options.enableCache;
}
