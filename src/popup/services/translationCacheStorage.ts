import type {
  NormalTranslationCacheInput,
  TranslationCacheEntry,
  TranslationCacheMode,
  TranslationCacheStats,
} from '../types/translationCache';
import {
  addLanguageToIndex,
  changeIndexCount,
  createCacheEntry,
  createEmptyCacheIndex,
  isEntryMatched,
  normalizeTargetLanguage,
} from './translationCacheEntryUtils';
import {
  readStoredLanguageEntryKeys,
  readStoredPrefixEntryKeys,
  readStoredPrefixTids,
  readStoredSourceEntries,
  readStoredSourceTids,
  readStoredTranslationCacheEntries,
  readStoredTranslationCacheIndex,
  removeStoredTranslationCache,
  writeStoredTranslationCacheEntrySet,
  writeStoredTranslationCacheIndex,
  writeStoredPrefixTids,
} from './translationCachePersistence';
import {
  createTranslationHashPrefix,
  createTranslationTid,
  readTranslationTidPrefix,
} from './translationCacheKey';
import { createCacheEntryStorageKey } from './translationCacheKeys';
import { normalizeNoTranslationResult } from './translationResultNormalizer';
export type {
  NormalTranslationCacheInput,
  TranslationCacheMode,
  TranslationCacheStats,
} from '../types/translationCache';

const indexCaches: Partial<Record<TranslationCacheMode, TranslationCacheStats & { languages: string[] }>> = {};
const operationChains: Partial<Record<TranslationCacheMode, Promise<unknown>>> = {};

/**
 * 读取普通模式翻译缓存。
 *
 * @param input 缓存查询输入。
 * @returns 命中的翻译文本。
 */
export async function readNormalTranslationCache(
  input: NormalTranslationCacheInput,
): Promise<{ text: string | null; tid: string } | undefined> {
  return readTranslationCache('normal', input);
}

/**
 * 写入普通模式翻译缓存。
 *
 * @param input 缓存写入输入。
 * @param text 翻译文本。
 * @returns 写入后的 TID。
 */
export async function writeNormalTranslationCache(
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<string> {
  return runExclusive('normal', () => writeTranslationCache('normal', input, text));
}

/**
 * 写入指定模式翻译缓存。
 *
 * @param mode 翻译模式。
 * @param input 缓存写入输入。
 * @param text 翻译文本。
 * @returns 写入后的 TID。
 */
export async function writeTranslationModeCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<string> {
  return runExclusive(mode, () => writeTranslationCache(mode, input, text));
}

/**
 * 批量写入普通模式翻译缓存。
 *
 * @param entries 缓存写入列表。
 * @returns 写入后的 TID 列表。
 */
export async function writeNormalTranslationCacheBatch(
  entries: Array<{ input: NormalTranslationCacheInput; text: string | null }>,
): Promise<string[]> {
  const tids: string[] = [];

  for (const entry of entries) {
    tids.push(await writeNormalTranslationCache(entry.input, entry.text));
  }

  return tids;
}

/**
 * 分配普通模式缓存 TID。
 *
 * @param input 缓存输入。
 * @returns 可复用或新建的 TID。
 */
export async function allocateNormalTranslationCacheTid(input: NormalTranslationCacheInput): Promise<string> {
  return runExclusive('normal', async () => {
    const existing = await findSourceEntry('normal', input);
    return existing?.tid ?? await reserveCacheTid('normal', input);
  });
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
  return (await loadIndex(mode)).languages;
}

/**
 * 读取缓存统计。
 *
 * @param mode 翻译模式。
 * @returns 缓存统计。
 */
export async function loadTranslationCacheStats(mode: TranslationCacheMode): Promise<TranslationCacheStats> {
  const index = await loadIndex(mode);

  return {
    mode,
    count: index.count,
  };
}

async function readTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
): Promise<{ text: string | null; tid: string } | undefined> {
  const sourceEntry = await findSourceEntry(mode, input);
  const entryKey = sourceEntry
    ? createCacheEntryStorageKey(mode, normalizeTargetLanguage(input.targetLanguage), sourceEntry.tid)
    : '';
  const [entry] = entryKey ? await readStoredTranslationCacheEntries([entryKey]) : [];

  return isEntryMatched(entry, { ...input, tid: entry?.key ?? input.tid })
    ? {
      text: normalizeNoTranslationResult(entry?.text ?? null, input.sourceText, input.targetLanguage),
      tid: entry?.key ?? input.tid,
    }
    : undefined;
}

async function writeTranslationCache(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
  text: string | null,
): Promise<string> {
  const sourceEntry = await findSourceEntry(mode, input);
  const nextInput = sourceEntry ? { ...input, tid: sourceEntry.tid } : { ...input, tid: await reserveCacheTid(mode, input) };
  const entry = createCacheEntry(nextInput, text);
  const existing = await readExistingTranslationEntry(mode, entry);
  const index = addLanguageToIndex(await readStoredTranslationCacheIndex(mode), entry.targetLanguage);
  const entryKey = createCacheEntryStorageKey(mode, entry.targetLanguage, entry.key);
  const sourceTids = addUnique(await readStoredSourceTids(mode, entry.sourceTextHash), entry.key);
  const prefix = readTranslationTidPrefix(entry.key);
  const prefixTids = addUnique(await readStoredPrefixTids(mode, prefix), entry.key);
  const prefixEntryKeys = addUnique(await readStoredPrefixEntryKeys(mode, prefix), entryKey);
  const languageKeys = addUnique(await readStoredLanguageEntryKeys(mode, entry.targetLanguage), entryKey);
  const allKeys = addUnique(await readStoredLanguageEntryKeys(mode, ''), entryKey);
  const nextIndex = changeIndexCount(index, existing ? 0 : 1);

  await writeStoredTranslationCacheEntrySet(
    mode,
    entry,
    {
      sourceText: entry.sourceText,
      sourceTextHash: entry.sourceTextHash,
      tid: entry.key,
    },
    sourceTids,
    prefixTids,
    prefixEntryKeys,
    languageKeys,
    allKeys,
  );
  await writeStoredTranslationCacheIndex(mode, nextIndex);
  indexCaches[mode] = { count: nextIndex.count, languages: nextIndex.languages, mode };
  return entry.key;
}

async function findSourceEntry(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
): Promise<{ sourceText: string; sourceTextHash: string; tid: string } | undefined> {
  const tids = await readStoredSourceTids(mode, input.sourceTextHash);
  const entries = await readStoredSourceEntries(mode, tids);
  return entries.find((entry) => entry.sourceText === input.sourceText);
}

async function readExistingTranslationEntry(
  mode: TranslationCacheMode,
  entry: TranslationCacheEntry,
): Promise<TranslationCacheEntry | undefined> {
  const entryKey = createCacheEntryStorageKey(mode, entry.targetLanguage, entry.key);
  const [existing] = await readStoredTranslationCacheEntries([entryKey]);
  return existing;
}

async function reserveCacheTid(
  mode: TranslationCacheMode,
  input: NormalTranslationCacheInput,
): Promise<string> {
  const prefix = await createTranslationHashPrefix(input.sourceText);
  const tids = await readStoredPrefixTids(mode, prefix);
  const tid = createTranslationTid(prefix, tids.length);
  await writeStoredPrefixTids(mode, prefix, [...tids, tid]);
  return tid;
}

async function clearTranslationCache(mode: TranslationCacheMode): Promise<void> {
  await removeStoredTranslationCache(mode);
  await writeStoredTranslationCacheIndex(mode, createEmptyCacheIndex(mode));
  indexCaches[mode] = undefined;
}

async function loadIndex(mode: TranslationCacheMode): Promise<TranslationCacheStats & { languages: string[] }> {
  if (indexCaches[mode]) {
    return indexCaches[mode];
  }

  const index = await readStoredTranslationCacheIndex(mode);
  indexCaches[mode] = { count: index.count, languages: index.languages, mode };
  return indexCaches[mode];
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

async function runExclusive<T>(mode: TranslationCacheMode, task: () => Promise<T>): Promise<T> {
  const chain = operationChains[mode] ?? Promise.resolve();
  const result = chain.then(task, task);
  operationChains[mode] = result.catch(() => undefined);
  return result;
}

function getCacheModes(): TranslationCacheMode[] {
  return ['normal', 'context'];
}
