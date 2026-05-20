import type {
  NormalTranslationCacheInput,
  TranslationCacheEntry,
  TranslationCacheSortKey,
  TranslationCacheViewEntry,
} from '../types/translationCache';

const maxCacheEntries = 5000;

/**
 * 创建缓存条目。
 *
 * @param input 缓存输入。
 * @param text 翻译文本。
 * @returns 缓存条目。
 */
export function createCacheEntry(input: NormalTranslationCacheInput, text: string | null): TranslationCacheEntry {
  return {
    key: input.tid,
    sourceText: input.sourceText,
    targetLanguage: normalizeTargetLanguage(input.targetLanguage),
    text,
    updatedAt: Date.now(),
  };
}

/**
 * 创建目标语言隔离的缓存键。
 *
 * @param input 缓存输入。
 * @returns 缓存键。
 */
export function createScopedCacheKey(input: NormalTranslationCacheInput): string {
  return `${normalizeTargetLanguage(input.targetLanguage)}:${input.tid}`;
}

/**
 * 剪裁并清理缓存。
 *
 * @param cache 缓存对象。
 * @returns 清理后的缓存对象。
 */
export function pruneCache(cache: Record<string, TranslationCacheEntry>): Record<string, TranslationCacheEntry> {
  return Object.fromEntries(
    Object.entries(cache)
      .filter(([, entry]) => Boolean(entry?.key && entry.sourceText && entry.targetLanguage))
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, maxCacheEntries),
  );
}

/**
 * 标准化目标语言。
 *
 * @param targetLanguage 目标语言。
 * @returns 标准化语言。
 */
export function normalizeTargetLanguage(targetLanguage: string | undefined): string {
  return targetLanguage?.trim().toLowerCase() || 'default';
}

/**
 * 判断缓存条目是否匹配输入。
 *
 * @param entry 缓存条目。
 * @param input 缓存输入。
 * @returns 是否匹配。
 */
export function isEntryMatched(
  entry: TranslationCacheEntry | undefined,
  input: NormalTranslationCacheInput,
): boolean {
  return Boolean(
    entry
      && entry.key === input.tid
      && entry.sourceText === input.sourceText
      && normalizeTargetLanguage(entry.targetLanguage) === normalizeTargetLanguage(input.targetLanguage),
  );
}

/**
 * 转为缓存展示条目。
 *
 * @param entry 缓存条目。
 * @returns 展示条目。
 */
export function toViewEntry(entry: TranslationCacheEntry): TranslationCacheViewEntry {
  return {
    sourceText: entry.sourceText,
    targetLanguage: normalizeTargetLanguage(entry.targetLanguage),
    text: entry.text,
    tid: entry.key,
    updatedAt: entry.updatedAt,
  };
}

/**
 * 转为存储键值对。
 *
 * @param entry 展示条目。
 * @returns 存储键值对。
 */
export function toStoragePair(entry: TranslationCacheViewEntry): [string, TranslationCacheEntry] {
  const input = {
    sourceText: entry.sourceText,
    targetLanguage: entry.targetLanguage,
    tid: entry.tid,
  };

  return [
    createScopedCacheKey(input),
    {
      key: entry.tid,
      sourceText: entry.sourceText,
      targetLanguage: normalizeTargetLanguage(entry.targetLanguage),
      text: entry.text,
      updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
    },
  ];
}

/**
 * 比较缓存展示条目。
 *
 * @param left 左侧条目。
 * @param right 右侧条目。
 * @param sortKey 排序字段。
 * @returns 排序结果。
 */
export function compareEntries(
  left: TranslationCacheViewEntry,
  right: TranslationCacheViewEntry,
  sortKey: TranslationCacheSortKey,
): number {
  return sortKey === 'tid'
    ? left.tid.localeCompare(right.tid)
    : left.sourceText.localeCompare(right.sourceText);
}
