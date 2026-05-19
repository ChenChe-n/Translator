import type { TranslationModeConfig } from '../types/translationMode';

export interface NormalTranslationCacheInput {
  config: TranslationModeConfig;
  sourceText: string;
  tid: string;
}

interface NormalTranslationCacheEntry {
  key: string;
  sourceText: string;
  text: string | null;
  updatedAt: number;
}

export const NORMAL_TRANSLATION_CACHE_KEY = 'Translator.translationCache.normal';
const maxCacheEntries = 5000;
let memoryCache: Record<string, NormalTranslationCacheEntry> | undefined;

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[NORMAL_TRANSLATION_CACHE_KEY]) {
      memoryCache = undefined;
    }
  });
}

/**
 * 读取普通模式翻译缓存。
 *
 * @param input 缓存查询输入。
 * @returns 命中的翻译文本。
 */
export async function readNormalTranslationCache(
  input: NormalTranslationCacheInput,
): Promise<{ text: string | null } | undefined> {
  const cache = await loadNormalTranslationCache();
  const key = await createNormalTranslationCacheKey(input);
  const entry = cache[key];

  return isEntryMatched(entry, input) ? { text: entry.text } : undefined;
}

/**
 * 写入普通模式翻译缓存。
 *
 * @param input 缓存写入输入。
 * @param text 翻译文本。
 * @returns 无返回值。
 */
export async function writeNormalTranslationCache(
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<void> {
  const cache = await loadNormalTranslationCache();
  const key = await createNormalTranslationCacheKey(input);
  cache[key] = await createCacheEntry(input, key, text);
  await saveNormalTranslationCache(cache);
}

/**
 * 清空普通模式翻译缓存。
 *
 * @returns 无返回值。
 */
export async function clearNormalTranslationCache(): Promise<void> {
  memoryCache = {};

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(NORMAL_TRANSLATION_CACHE_KEY);
    return;
  }

  await chrome.storage.local.remove(NORMAL_TRANSLATION_CACHE_KEY);
}

async function loadNormalTranslationCache(): Promise<Record<string, NormalTranslationCacheEntry>> {
  if (memoryCache) {
    return memoryCache;
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    memoryCache = readPreviewCache();
    return memoryCache;
  }

  const stored = await chrome.storage.local.get(NORMAL_TRANSLATION_CACHE_KEY);
  memoryCache = normalizeCache(stored[NORMAL_TRANSLATION_CACHE_KEY] as Record<string, NormalTranslationCacheEntry>);
  return memoryCache;
}

async function saveNormalTranslationCache(cache: Record<string, NormalTranslationCacheEntry>): Promise<void> {
  memoryCache = pruneCache(cache);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(NORMAL_TRANSLATION_CACHE_KEY, JSON.stringify(memoryCache));
    return;
  }

  await chrome.storage.local.set({
    [NORMAL_TRANSLATION_CACHE_KEY]: memoryCache,
  });
}

async function createNormalTranslationCacheKey(input: NormalTranslationCacheInput): Promise<string> {
  return input.tid;
}

async function createCacheEntry(
  input: NormalTranslationCacheInput,
  key: string,
  text: string | null,
): Promise<NormalTranslationCacheEntry> {
  return {
    key,
    sourceText: input.sourceText,
    text,
    updatedAt: Date.now(),
  };
}

function isEntryMatched(entry: NormalTranslationCacheEntry | undefined, input: NormalTranslationCacheInput): boolean {
  return Boolean(entry && entry.key === input.tid);
}

function readPreviewCache(): Record<string, NormalTranslationCacheEntry> {
  const value = localStorage.getItem(NORMAL_TRANSLATION_CACHE_KEY);
  return normalizeCache(value ? (JSON.parse(value) as Record<string, NormalTranslationCacheEntry>) : {});
}

function normalizeCache(cache: Record<string, NormalTranslationCacheEntry> | undefined): Record<string, NormalTranslationCacheEntry> {
  return pruneCache(cache ?? {});
}

function pruneCache(cache: Record<string, NormalTranslationCacheEntry>): Record<string, NormalTranslationCacheEntry> {
  return Object.fromEntries(
    Object.entries(cache)
      .filter(([, entry]) => Boolean(entry?.key && entry.sourceText))
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, maxCacheEntries),
  );
}
