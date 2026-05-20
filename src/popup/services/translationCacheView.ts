import type {
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheViewEntry,
} from '../types/translationCache';
import { loadTranslationCacheEntries } from './translationCacheCatalog';

/**
 * 翻译缓存分页结果。
 */
export interface TranslationCachePageResult {
  entries: TranslationCacheViewEntry[];
  total: number;
}

/**
 * 分页读取缓存展示条目。
 *
 * @param mode 翻译模式。
 * @param targetLanguage 目标语言。
 * @param sortKey 排序字段。
 * @param page 页码。
 * @param pageSize 每页数量。
 * @returns 分页缓存条目。
 */
export async function loadTranslationCachePage(
  mode: TranslationCacheMode,
  targetLanguage: string,
  sortKey: TranslationCacheSortKey,
  page: number,
  pageSize: number,
): Promise<TranslationCachePageResult> {
  const entries = await loadTranslationCacheEntries(mode, targetLanguage, sortKey);
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const start = (Math.max(1, Math.floor(page)) - 1) * safePageSize;

  return {
    entries: entries.slice(start, start + safePageSize),
    total: entries.length,
  };
}
