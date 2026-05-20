import type { TranslationModeKey } from './translationMode';

/**
 * 翻译缓存排序字段。
 */
export type TranslationCacheSortKey = 'sourceText' | 'tid';

/**
 * 翻译缓存模式。
 */
export type TranslationCacheMode = TranslationModeKey;

/**
 * 普通模式翻译缓存输入。
 */
export interface NormalTranslationCacheInput {
  sourceText: string;
  targetLanguage: string;
  tid: string;
}

/**
 * 翻译缓存展示条目。
 */
export interface TranslationCacheViewEntry {
  sourceText: string;
  targetLanguage: string;
  text: string | null;
  tid: string;
  updatedAt: number;
}

/**
 * 翻译缓存统计。
 */
export interface TranslationCacheStats {
  count: number;
  mode: TranslationCacheMode;
}

/**
 * 翻译缓存存储条目。
 */
export interface TranslationCacheEntry {
  key: string;
  sourceText: string;
  targetLanguage: string;
  text: string | null;
  updatedAt: number;
}
