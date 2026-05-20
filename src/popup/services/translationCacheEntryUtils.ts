import type {
  NormalTranslationCacheInput,
  TranslationCacheEntry,
  TranslationCacheIndex,
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheViewEntry,
} from '../types/translationCache';

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
    sourceTextHash: input.sourceTextHash,
    targetLanguage: normalizeTargetLanguage(input.targetLanguage),
    text,
    updatedAt: Date.now(),
  };
}

/**
 * 创建空缓存索引。
 *
 * @param mode 翻译模式。
 * @returns 缓存索引。
 */
export function createEmptyCacheIndex(mode: TranslationCacheMode): TranslationCacheIndex {
  return {
    count: 0,
    languages: [],
    mode,
    schemaVersion: 2,
    updatedAt: Date.now(),
  };
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
      && entry.sourceTextHash === input.sourceTextHash
      && normalizeTargetLanguage(entry.targetLanguage) === normalizeTargetLanguage(input.targetLanguage),
  );
}

/**
 * 将语言写入索引。
 *
 * @param index 缓存索引。
 * @param targetLanguage 目标语言。
 * @returns 更新后的索引。
 */
export function addLanguageToIndex(index: TranslationCacheIndex, targetLanguage: string): TranslationCacheIndex {
  const language = normalizeTargetLanguage(targetLanguage);

  if (index.languages.includes(language)) {
    return {
      ...index,
      updatedAt: Date.now(),
    };
  }

  return {
    ...index,
    languages: [...index.languages, language].sort((left, right) => left.localeCompare(right)),
    updatedAt: Date.now(),
  };
}

/**
 * 调整缓存总数。
 *
 * @param index 缓存索引。
 * @param delta 数量变化。
 * @returns 更新后的索引。
 */
export function changeIndexCount(index: TranslationCacheIndex, delta: number): TranslationCacheIndex {
  return {
    ...index,
    count: Math.max(0, index.count + delta),
    updatedAt: Date.now(),
  };
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
