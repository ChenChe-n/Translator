import type { TranslationCacheEntry, TranslationCacheMode } from '../types/translationCache';
import { pruneCache } from './translationCacheEntryUtils';
import { TRANSLATION_CACHE_STORAGE_KEYS } from './translationCacheKeys';

/**
 * 读取已持久化的翻译缓存。
 *
 * @param mode 翻译模式。
 * @returns 缓存对象。
 */
export async function readStoredTranslationCache(
  mode: TranslationCacheMode,
): Promise<Record<string, TranslationCacheEntry>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return readPreviewCache(mode);
  }

  const storageKey = TRANSLATION_CACHE_STORAGE_KEYS[mode];
  const stored = await chrome.storage.local.get(storageKey);
  return normalizeCache(stored[storageKey] as Record<string, TranslationCacheEntry>);
}

/**
 * 持久化翻译缓存。
 *
 * @param mode 翻译模式。
 * @param cache 缓存对象。
 * @returns 无返回值。
 */
export async function persistTranslationCache(
  mode: TranslationCacheMode,
  cache: Record<string, TranslationCacheEntry>,
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(TRANSLATION_CACHE_STORAGE_KEYS[mode], JSON.stringify(cache));
    return;
  }

  await chrome.storage.local.set({
    [TRANSLATION_CACHE_STORAGE_KEYS[mode]]: cache,
  });
}

/**
 * 删除已持久化的翻译缓存。
 *
 * @param mode 翻译模式。
 * @returns 无返回值。
 */
export async function removeStoredTranslationCache(mode: TranslationCacheMode): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(TRANSLATION_CACHE_STORAGE_KEYS[mode]);
    return;
  }

  await chrome.storage.local.remove(TRANSLATION_CACHE_STORAGE_KEYS[mode]);
}

function readPreviewCache(mode: TranslationCacheMode): Record<string, TranslationCacheEntry> {
  const value = localStorage.getItem(TRANSLATION_CACHE_STORAGE_KEYS[mode]);
  return normalizeCache(value ? (JSON.parse(value) as Record<string, TranslationCacheEntry>) : {});
}

function normalizeCache(
  cache: Record<string, TranslationCacheEntry> | undefined,
): Record<string, TranslationCacheEntry> {
  return pruneCache(cache ?? {});
}
