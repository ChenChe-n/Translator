import type { TranslationModeKey } from '../types/translationMode';

export interface NormalTranslationCacheInput {
  sourceText: string;
  tid: string;
}

interface TranslationCacheEntry {
  key: string;
  sourceText: string;
  text: string | null;
  updatedAt: number;
}

type TranslationCacheMode = TranslationModeKey;

export const TRANSLATION_CACHE_STORAGE_KEYS: Record<TranslationCacheMode, string> = {
  normal: 'Translator.translationCache.normal',
  context: 'Translator.translationCache.context',
};

const maxCacheEntries = 5000;
const saveDelayMs = 400;
const memoryCaches: Partial<Record<TranslationCacheMode, Record<string, TranslationCacheEntry>>> = {};
const saveTimers: Partial<Record<TranslationCacheMode, number>> = {};

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }

    getCacheModes().forEach((mode) => {
      if (changes[TRANSLATION_CACHE_STORAGE_KEYS[mode]]) {
        memoryCaches[mode] = undefined;
      }
    });
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
  return readTranslationCache('normal', input);
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
  await writeTranslationCache('normal', input, text);
}

/**
 * 清空普通模式翻译缓存。
 *
 * @returns 无返回值。
 */
export async function clearNormalTranslationCache(): Promise<void> {
  await clearTranslationCache('normal');
}

/**
 * 清空上下文模式翻译缓存。
 *
 * @returns 无返回值。
 */
export async function clearContextTranslationCache(): Promise<void> {
  await clearTranslationCache('context');
}

/**
 * 清空所有翻译缓存。
 *
 * @returns 无返回值。
 */
export async function clearTranslationCaches(): Promise<void> {
  await Promise.all(getCacheModes().map(clearTranslationCache));
}

async function readTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
): Promise<{ text: string | null } | undefined> {
  const cache = await loadTranslationCache(mode);
  const entry = cache[input.tid];

  return isEntryMatched(entry, input) ? { text: entry.text } : undefined;
}

async function writeTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<void> {
  const cache = await loadTranslationCache(mode);
  cache[input.tid] = createCacheEntry(input, text);
  scheduleTranslationCacheSave(mode, cache);
}

async function clearTranslationCache(mode: TranslationCacheMode): Promise<void> {
  memoryCaches[mode] = {};
  window.clearTimeout(saveTimers[mode]);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(TRANSLATION_CACHE_STORAGE_KEYS[mode]);
    return;
  }

  await chrome.storage.local.remove(TRANSLATION_CACHE_STORAGE_KEYS[mode]);
}

async function loadTranslationCache(mode: TranslationCacheMode): Promise<Record<string, TranslationCacheEntry>> {
  if (memoryCaches[mode]) {
    return memoryCaches[mode];
  }

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    memoryCaches[mode] = readPreviewCache(mode);
    return memoryCaches[mode];
  }

  const storageKey = TRANSLATION_CACHE_STORAGE_KEYS[mode];
  const stored = await chrome.storage.local.get(storageKey);
  memoryCaches[mode] = normalizeCache(stored[storageKey] as Record<string, TranslationCacheEntry>);
  return memoryCaches[mode];
}

async function saveTranslationCache(
  mode: TranslationCacheMode,
  cache: Record<string, TranslationCacheEntry>,
): Promise<void> {
  memoryCaches[mode] = pruneCache(cache);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(TRANSLATION_CACHE_STORAGE_KEYS[mode], JSON.stringify(memoryCaches[mode]));
    return;
  }

  await chrome.storage.local.set({
    [TRANSLATION_CACHE_STORAGE_KEYS[mode]]: memoryCaches[mode],
  });
}

function scheduleTranslationCacheSave(
  mode: TranslationCacheMode,
  cache: Record<string, TranslationCacheEntry>,
): void {
  memoryCaches[mode] = cache;
  window.clearTimeout(saveTimers[mode]);
  saveTimers[mode] = window.setTimeout(() => {
    void saveTranslationCache(mode, memoryCaches[mode] ?? {});
  }, saveDelayMs);
}

function createCacheEntry(input: NormalTranslationCacheInput, text: string | null): TranslationCacheEntry {
  return {
    key: input.tid,
    sourceText: input.sourceText,
    text,
    updatedAt: Date.now(),
  };
}

function isEntryMatched(
  entry: TranslationCacheEntry | undefined,
  input: NormalTranslationCacheInput,
): boolean {
  return Boolean(entry && entry.key === input.tid && entry.sourceText === input.sourceText);
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

function pruneCache(cache: Record<string, TranslationCacheEntry>): Record<string, TranslationCacheEntry> {
  return Object.fromEntries(
    Object.entries(cache)
      .filter(([, entry]) => Boolean(entry?.key && entry.sourceText))
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, maxCacheEntries),
  );
}

function getCacheModes(): TranslationCacheMode[] {
  return ['normal', 'context'];
}
