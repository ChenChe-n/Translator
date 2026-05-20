import type {
  NormalTranslationCacheInput,
  TranslationCacheEntry,
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheStats,
  TranslationCacheViewEntry,
} from '../types/translationCache';
import {
  compareEntries,
  createCacheEntry,
  createScopedCacheKey,
  isEntryMatched,
  normalizeTargetLanguage,
  pruneCache,
  toStoragePair,
  toViewEntry,
} from './translationCacheEntryUtils';
import { TRANSLATION_CACHE_STORAGE_KEYS } from './translationCacheKeys';
import {
  persistTranslationCache,
  readStoredTranslationCache,
  removeStoredTranslationCache,
} from './translationCachePersistence';
export type {
  NormalTranslationCacheInput,
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheStats,
  TranslationCacheViewEntry,
} from '../types/translationCache';

const memoryCaches: Partial<Record<TranslationCacheMode, Record<string, TranslationCacheEntry>>> = {};
const pendingWrites: Partial<Record<TranslationCacheMode, Record<string, TranslationCacheEntry>>> = {};
const saveChains: Partial<Record<TranslationCacheMode, Promise<void>>> = {};

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
 * 批量写入普通模式翻译缓存。
 *
 * @param entries 缓存写入列表。
 * @returns 无返回值。
 */
export async function writeNormalTranslationCacheBatch(
  entries: Array<{ input: NormalTranslationCacheInput; text: string | null }>,
): Promise<void> {
  await writeTranslationCacheBatch('normal', entries, true);
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

/**
 * 读取缓存目标语言列表。
 *
 * @param mode 翻译模式。
 * @returns 目标语言列表。
 */
export async function loadTranslationCacheLanguages(mode: TranslationCacheMode): Promise<string[]> {
  const cache = await loadTranslationCache(mode);
  const languages = Object.values(cache).map((entry) => normalizeTargetLanguage(entry.targetLanguage));
  return [...new Set(languages)].sort((left, right) => left.localeCompare(right));
}

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
  const cache = await loadTranslationCache(mode);
  return Object.values(cache)
    .filter((entry) => normalizeTargetLanguage(entry.targetLanguage) === normalizeTargetLanguage(targetLanguage))
    .map(toViewEntry)
    .sort((left, right) => compareEntries(left, right, sortKey));
}

/**
 * 读取缓存统计。
 *
 * @param mode 翻译模式。
 * @returns 缓存统计。
 */
export async function loadTranslationCacheStats(mode: TranslationCacheMode): Promise<TranslationCacheStats> {
  const cache = await loadTranslationCache(mode);

  return {
    mode,
    count: Object.keys(cache).length,
  };
}

/**
 * 导出指定模式的缓存快照。
 *
 * @param mode 翻译模式。
 * @returns 缓存展示条目。
 */
export async function exportTranslationCacheEntries(mode: TranslationCacheMode): Promise<TranslationCacheViewEntry[]> {
  return Object.values(await loadTranslationCache(mode)).map(toViewEntry);
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
  await flushPendingCacheWrites(mode);
  await saveTranslationCache(mode, Object.fromEntries(entries.map(toStoragePair)));
}

async function readTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
): Promise<{ text: string | null } | undefined> {
  const cache = await loadTranslationCache(mode);
  const entry = cache[createScopedCacheKey(input)];

  return isEntryMatched(entry, input) ? { text: entry.text } : undefined;
}

async function writeTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<void> {
  await writeTranslationCacheBatch(mode, [{ input, text }], false);
}

async function writeTranslationCacheBatch(
  mode: TranslationCacheMode,
  entries: Array<{ input: NormalTranslationCacheInput; text: string | null }>,
  flushNow: boolean,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const cache = await loadTranslationCache(mode);
  const pending = pendingWrites[mode] ?? {};

  entries.forEach(({ input, text }) => {
    const entry = createCacheEntry(input, text);
    const key = createScopedCacheKey(input);
    cache[key] = entry;
    pending[key] = entry;
  });

  pendingWrites[mode] = pending;

  if (flushNow) {
    await flushPendingCacheWrites(mode);
  }
}

async function clearTranslationCache(mode: TranslationCacheMode): Promise<void> {
  await flushPendingCacheWrites(mode);
  memoryCaches[mode] = {};
  pendingWrites[mode] = {};
  await removeStoredTranslationCache(mode);
}

async function loadTranslationCache(mode: TranslationCacheMode): Promise<Record<string, TranslationCacheEntry>> {
  if (memoryCaches[mode]) {
    return memoryCaches[mode];
  }

  memoryCaches[mode] = await readStoredTranslationCache(mode);
  return memoryCaches[mode];
}

async function saveTranslationCache(
  mode: TranslationCacheMode,
  cache: Record<string, TranslationCacheEntry>,
): Promise<void> {
  memoryCaches[mode] = pruneCache(cache);
  pendingWrites[mode] = {};
  await persistTranslationCache(mode, memoryCaches[mode]);
}

async function flushPendingCacheWrites(mode: TranslationCacheMode): Promise<void> {
  const chain = saveChains[mode] ?? Promise.resolve();
  const nextChain = chain.then(() => persistPendingWrites(mode));
  saveChains[mode] = nextChain.catch(() => undefined);
  await nextChain;
}

async function persistPendingWrites(mode: TranslationCacheMode): Promise<void> {
  const pending = pendingWrites[mode];

  if (!pending || Object.keys(pending).length === 0) {
    return;
  }

  pendingWrites[mode] = {};
  const storedCache = await readStoredTranslationCache(mode);
  const nextCache = pruneCache({
    ...storedCache,
    ...pending,
  });
  await persistTranslationCache(mode, nextCache);
  memoryCaches[mode] = nextCache;
}

function getCacheModes(): TranslationCacheMode[] {
  return ['normal', 'context'];
}
