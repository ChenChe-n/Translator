import type {
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheViewEntry,
} from '../types/translationCache';
import { compareEntries, normalizeTargetLanguage, toViewEntry } from './translationCacheEntryUtils';
import { createTranslationSourceHash } from './translationCacheKey';
import {
  readStoredLanguageEntryKeys,
  readStoredPrefixEntryKeys,
  readStoredTranslationCacheEntries,
} from './translationCachePersistence';
import {
  clearContextTranslationCache,
  clearNormalTranslationCache,
  writeTranslationModeCache,
} from './translationCacheStorage';

/**
 * 读取缓存展示条目。
 *
 * @param mode 翻译模式。
 * @param targetLanguage 目标语言。
 * @param sortKey 排序字段。
 * @returns 缓存展示条目。
 */
export async function loadTranslationCacheEntries(
  mode: TranslationCacheMode,
  targetLanguage: string,
  sortKey: TranslationCacheSortKey,
): Promise<TranslationCacheViewEntry[]> {
  const entryKeys = await readStoredLanguageEntryKeys(mode, normalizeTargetLanguage(targetLanguage));
  return (await readStoredTranslationCacheEntries(entryKeys))
    .map(toViewEntry)
    .sort((left, right) => compareEntries(left, right, sortKey));
}

/**
 * 导出指定模式的缓存快照。
 *
 * @param mode 翻译模式。
 * @returns 缓存展示条目。
 */
export async function exportTranslationCacheEntries(mode: TranslationCacheMode): Promise<TranslationCacheViewEntry[]> {
  const entryKeys = await readStoredLanguageEntryKeys(mode, '');
  return (await readStoredTranslationCacheEntries(entryKeys)).map(toViewEntry);
}

/**
 * 按 TID 前缀读取缓存展示条目。
 *
 * @param mode 翻译模式。
 * @param tidPrefix TID 前缀。
 * @param sortKey 排序字段。
 * @returns 缓存展示条目。
 */
export async function loadTranslationCacheEntriesByTidPrefix(
  mode: TranslationCacheMode,
  tidPrefix: string,
  sortKey: TranslationCacheSortKey,
): Promise<TranslationCacheViewEntry[]> {
  const entryKeys = await readStoredPrefixEntryKeys(mode, tidPrefix);
  return (await readStoredTranslationCacheEntries(entryKeys))
    .map(toViewEntry)
    .sort((left, right) => compareEntries(left, right, sortKey));
}

/**
 * 导入指定模式的缓存快照。
 *
 * @param mode 翻译模式。
 * @param entries 缓存展示条目。
 * @returns 无返回值。
 */
export async function importTranslationCacheEntries(
  mode: TranslationCacheMode,
  entries: TranslationCacheViewEntry[],
): Promise<void> {
  await clearTranslationCache(mode);

  for (const entry of entries) {
    await writeTranslationModeCache(mode, {
      sourceText: entry.sourceText,
      sourceTextHash: await createTranslationSourceHash(entry.sourceText),
      targetLanguage: entry.targetLanguage,
      tid: entry.tid,
    }, entry.text);
  }
}

async function clearTranslationCache(mode: TranslationCacheMode): Promise<void> {
  if (mode === 'normal') {
    await clearNormalTranslationCache();
    return;
  }

  await clearContextTranslationCache();
}
