import type { TranslationModeConfig } from '../types/translationMode';
import type { NormalTranslationInput, NormalTranslationResult } from './normalTranslationService';
import { readNormalTranslationCache, writeNormalTranslationCache } from './translationCacheStorage';
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

function shouldUseNormalTranslationCache(config: TranslationModeConfig): boolean {
  return config.mode === 'normal' && config.options.enableCache;
}
