import type { TranslationModeConfig } from '../types/translationMode';
import type { NormalTranslationInput, NormalTranslationResult } from '../types/normalTranslation';
import {
  allocateNormalTranslationCacheTid,
  readNormalTranslationCache,
  writeNormalTranslationCache,
  writeNormalTranslationCacheBatch,
} from './translationCacheStorage';
import { createTranslationCacheKey, createTranslationSourceHash } from './translationCacheKey';

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
  const sourceTextHash = await createTranslationSourceHash(input.text);
  const cached = await readNormalTranslationCache({
    sourceText: input.text,
    sourceTextHash,
    targetLanguage,
    tid,
  });

  return cached
    ? {
        tid: cached.tid,
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
): Promise<string | undefined> {
  if (!shouldUseNormalTranslationCache(config)) {
    return undefined;
  }

  return writeNormalTranslationCache({
    sourceText,
    sourceTextHash: await createTranslationSourceHash(sourceText),
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
): Promise<string[]> {
  if (!shouldUseNormalTranslationCache(config) || entries.length === 0) {
    return [];
  }

  return writeNormalTranslationCacheBatch(await Promise.all(entries.map(async (entry) => ({
    input: {
      sourceText: entry.sourceText,
      sourceTextHash: await createTranslationSourceHash(entry.sourceText),
      targetLanguage: entry.targetLanguage,
      tid: await createTranslationCacheKey(entry.sourceText),
    },
    text: entry.text,
  }))));
}

/**
 * 分配普通模式翻译 TID。
 *
 * @param config 翻译配置。
 * @param sourceText 原文。
 * @param targetLanguage 目标语言。
 * @returns 翻译 TID。
 */
export async function allocateCachedNormalTranslationTid(
  config: TranslationModeConfig,
  sourceText: string,
  targetLanguage: string,
): Promise<string> {
  const tid = await createTranslationCacheKey(sourceText);

  if (!shouldUseNormalTranslationCache(config)) {
    return tid;
  }

  return allocateNormalTranslationCacheTid({
    sourceText,
    sourceTextHash: await createTranslationSourceHash(sourceText),
    targetLanguage,
    tid,
  });
}

function shouldUseNormalTranslationCache(config: TranslationModeConfig): boolean {
  return config.mode === 'normal' && config.options.enableCache;
}
