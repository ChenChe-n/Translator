import type {
  TranslationCacheEntry,
  TranslationCacheIndex,
  TranslationCacheMode,
  TranslationCacheSourceEntry,
} from '../types/translationCache';
import { createEmptyCacheIndex } from './translationCacheEntryUtils';
import {
  createCacheEntryStorageKey,
  createCacheLanguageIndexKey,
  createCacheSourceEntryStorageKey,
  createCacheSourceIndexKey,
  createCacheTidPrefixEntryIndexKey,
  createCacheTidPrefixIndexKey,
  TRANSLATION_CACHE_INDEX_KEYS,
} from './translationCacheKeys';

/**
 * 读取翻译缓存索引。
 *
 * @param mode 翻译模式。
 * @returns 缓存索引。
 */
export async function readStoredTranslationCacheIndex(mode: TranslationCacheMode): Promise<TranslationCacheIndex> {
  const stored = await readStorageValue<TranslationCacheIndex>(TRANSLATION_CACHE_INDEX_KEYS[mode]);
  return normalizeIndex(stored, mode);
}

/**
 * 写入翻译缓存索引。
 *
 * @param mode 翻译模式。
 * @param index 缓存索引。
 * @returns 无返回值。
 */
export async function writeStoredTranslationCacheIndex(
  mode: TranslationCacheMode,
  index: TranslationCacheIndex,
): Promise<void> {
  await writeStorageValues({
    [TRANSLATION_CACHE_INDEX_KEYS[mode]]: index,
  });
}

/**
 * 读取多个翻译缓存条目。
 *
 * @param mode 翻译模式。
 * @param keys 条目存储键列表。
 * @returns 缓存条目列表。
 */
export async function readStoredTranslationCacheEntries(
  keys: string[],
): Promise<TranslationCacheEntry[]> {
  const values = await readStorageValues<TranslationCacheEntry>(keys);
  return keys.map((key) => values[key]).filter((entry): entry is TranslationCacheEntry => Boolean(entry));
}

/**
 * 写入缓存条目及索引分片。
 *
 * @param mode 翻译模式。
 * @param entry 缓存条目。
 * @param sourceEntry 源文本记录。
 * @param sourceTids 完整文本对应 TID 列表。
 * @param prefixTids 前缀对应 TID 列表。
 * @param prefixEntryKeys 前缀对应条目键列表。
 * @param languageKeys 语言对应条目键列表。
 * @param allKeys 全部条目键列表。
 * @returns 无返回值。
 */
export async function writeStoredTranslationCacheEntrySet(
  mode: TranslationCacheMode,
  entry: TranslationCacheEntry,
  sourceEntry: TranslationCacheSourceEntry,
  sourceTids: string[],
  prefixTids: string[],
  prefixEntryKeys: string[],
  languageKeys: string[],
  allKeys: string[],
): Promise<void> {
  const entryKey = createCacheEntryStorageKey(mode, entry.targetLanguage, entry.key);

  await writeStorageValues({
    [entryKey]: entry,
    [createCacheSourceEntryStorageKey(mode, entry.key)]: sourceEntry,
    [createCacheSourceIndexKey(mode, entry.sourceTextHash)]: sourceTids,
    [createCacheTidPrefixIndexKey(mode, entry.key.split('-')[0] ?? '')]: prefixTids,
    [createCacheTidPrefixEntryIndexKey(mode, entry.key.split('-')[0] ?? '')]: prefixEntryKeys,
    [createCacheLanguageIndexKey(mode, entry.targetLanguage)]: languageKeys,
    [createCacheLanguageIndexKey(mode, '')]: allKeys,
  });
}

/**
 * 读取完整文本索引。
 *
 * @param mode 翻译模式。
 * @param sourceTextHash 完整文本哈希。
 * @returns TID 列表。
 */
export async function readStoredSourceTids(
  mode: TranslationCacheMode,
  sourceTextHash: string,
): Promise<string[]> {
  return await readStorageValue<string[]>(createCacheSourceIndexKey(mode, sourceTextHash)) ?? [];
}

/**
 * 读取多个源文本记录。
 *
 * @param mode 翻译模式。
 * @param tids 翻译 TID 列表。
 * @returns 源文本记录列表。
 */
export async function readStoredSourceEntries(
  mode: TranslationCacheMode,
  tids: string[],
): Promise<TranslationCacheSourceEntry[]> {
  const keys = tids.map((tid) => createCacheSourceEntryStorageKey(mode, tid));
  const values = await readStorageValues<TranslationCacheSourceEntry>(keys);
  return keys.map((key) => values[key]).filter((entry): entry is TranslationCacheSourceEntry => Boolean(entry));
}

/**
 * 读取 TID 前缀索引。
 *
 * @param mode 翻译模式。
 * @param prefix TID 前缀。
 * @returns TID 列表。
 */
export async function readStoredPrefixTids(mode: TranslationCacheMode, prefix: string): Promise<string[]> {
  return await readStorageValue<string[]>(createCacheTidPrefixIndexKey(mode, prefix)) ?? [];
}

/**
 * 读取 TID 前缀条目索引。
 *
 * @param mode 翻译模式。
 * @param prefix TID 前缀。
 * @returns 条目存储键列表。
 */
export async function readStoredPrefixEntryKeys(mode: TranslationCacheMode, prefix: string): Promise<string[]> {
  return await readStorageValue<string[]>(createCacheTidPrefixEntryIndexKey(mode, prefix)) ?? [];
}

/**
 * 写入 TID 前缀索引。
 *
 * @param mode 翻译模式。
 * @param prefix TID 前缀。
 * @param tids TID 列表。
 * @returns 无返回值。
 */
export async function writeStoredPrefixTids(
  mode: TranslationCacheMode,
  prefix: string,
  tids: string[],
): Promise<void> {
  await writeStorageValues({
    [createCacheTidPrefixIndexKey(mode, prefix)]: tids,
  });
}

/**
 * 读取语言条目索引。
 *
 * @param mode 翻译模式。
 * @param targetLanguage 目标语言。
 * @returns 条目存储键列表。
 */
export async function readStoredLanguageEntryKeys(
  mode: TranslationCacheMode,
  targetLanguage: string,
): Promise<string[]> {
  return await readStorageValue<string[]>(createCacheLanguageIndexKey(mode, targetLanguage)) ?? [];
}

/**
 * 清空翻译缓存命名空间。
 *
 * @param mode 翻译模式。
 * @returns 无返回值。
 */
export async function removeStoredTranslationCache(mode: TranslationCacheMode): Promise<void> {
  const prefix = `Translator.translationCache.${mode}.`;
  const keys = await listStorageKeys();
  await removeStorageValues(keys.filter((key) => key.startsWith(prefix)));
}

async function readStorageValue<T>(key: string): Promise<T | undefined> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return readLocalStorageValue<T>(key);
  }

  const values = await chrome.storage.local.get(key);
  return values[key] as T | undefined;
}

async function readStorageValues<T>(keys: string[]): Promise<Record<string, T | undefined>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Object.fromEntries(keys.map((key) => [key, readLocalStorageValue<T>(key)]));
  }

  return await chrome.storage.local.get(keys) as Record<string, T | undefined>;
}

async function writeStorageValues(values: Record<string, unknown>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    return;
  }

  await chrome.storage.local.set(values);
}

async function removeStorageValues(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    keys.forEach((key) => localStorage.removeItem(key));
    return;
  }

  await chrome.storage.local.remove(keys);
}

async function listStorageKeys(): Promise<string[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return Object.keys(localStorage);
  }

  return Object.keys(await chrome.storage.local.get(null));
}

function readLocalStorageValue<T>(key: string): T | undefined {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) as T : undefined;
}

function normalizeIndex(index: TranslationCacheIndex | undefined, mode: TranslationCacheMode): TranslationCacheIndex {
  if (index?.schemaVersion === 2 && index.mode === mode) {
    return index;
  }

  return createEmptyCacheIndex(mode);
}
