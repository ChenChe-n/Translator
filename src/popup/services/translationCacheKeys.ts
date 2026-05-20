import type { TranslationCacheMode } from '../types/translationCache';

export const TRANSLATION_CACHE_INDEX_KEYS: Record<TranslationCacheMode, string> = {
  normal: 'Translator.translationCache.normal.index',
  context: 'Translator.translationCache.context.index',
};

export const TRANSLATION_CACHE_STORAGE_KEYS = TRANSLATION_CACHE_INDEX_KEYS;

/**
 * 创建缓存条目存储键。
 *
 * @param mode 翻译模式。
 * @param targetLanguage 目标语言。
 * @param tid 翻译 TID。
 * @returns 存储键。
 */
export function createCacheEntryStorageKey(
  mode: TranslationCacheMode,
  targetLanguage: string,
  tid: string,
): string {
  return `Translator.translationCache.${mode}.entry.${targetLanguage}.${tid}`;
}

/**
 * 创建完整文本索引存储键。
 *
 * @param mode 翻译模式。
 * @param sourceTextHash 完整文本哈希。
 * @returns 存储键。
 */
export function createCacheSourceIndexKey(
  mode: TranslationCacheMode,
  sourceTextHash: string,
): string {
  return `Translator.translationCache.${mode}.source.${sourceTextHash}`;
}

/**
 * 创建源文本记录存储键。
 *
 * @param mode 翻译模式。
 * @param tid 翻译 TID。
 * @returns 存储键。
 */
export function createCacheSourceEntryStorageKey(mode: TranslationCacheMode, tid: string): string {
  return `Translator.translationCache.${mode}.sourceEntry.${tid}`;
}

/**
 * 创建 TID 前缀索引存储键。
 *
 * @param mode 翻译模式。
 * @param prefix TID 前缀。
 * @returns 存储键。
 */
export function createCacheTidPrefixIndexKey(mode: TranslationCacheMode, prefix: string): string {
  return `Translator.translationCache.${mode}.prefix.${prefix}`;
}

/**
 * 创建 TID 前缀条目索引存储键。
 *
 * @param mode 翻译模式。
 * @param prefix TID 前缀。
 * @returns 存储键。
 */
export function createCacheTidPrefixEntryIndexKey(mode: TranslationCacheMode, prefix: string): string {
  return `Translator.translationCache.${mode}.prefixEntry.${prefix}`;
}

/**
 * 创建语言条目索引存储键。
 *
 * @param mode 翻译模式。
 * @param targetLanguage 目标语言。
 * @returns 存储键。
 */
export function createCacheLanguageIndexKey(mode: TranslationCacheMode, targetLanguage: string): string {
  return `Translator.translationCache.${mode}.language.${targetLanguage}`;
}
