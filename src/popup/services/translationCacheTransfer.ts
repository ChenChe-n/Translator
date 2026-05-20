import type { TranslationCacheMode, TranslationCacheViewEntry } from '../types/translationCache';
import { exportTranslationCacheEntries, importTranslationCacheEntries } from './translationCacheCatalog';

/**
 * 翻译缓存导出包。
 */
export interface ExportedTranslationCachePackage {
  entries: TranslationCacheViewEntry[];
  exportedAt: string;
  mode: TranslationCacheMode;
  schemaVersion: 1;
}

/**
 * 导出指定翻译模式的缓存。
 *
 * @param mode 翻译模式。
 * @returns 缓存 JSON 文本。
 */
export async function exportTranslationCacheJson(mode: TranslationCacheMode): Promise<string> {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    mode,
    entries: await exportTranslationCacheEntries(mode),
  } satisfies ExportedTranslationCachePackage, null, 2);
}

/**
 * 导入指定翻译模式的缓存。
 *
 * @param json 缓存 JSON 文本。
 * @param fallbackMode 未声明模式时使用的翻译模式。
 * @returns 导入的翻译模式。
 */
export async function importTranslationCacheJson(
  json: string,
  fallbackMode: TranslationCacheMode,
): Promise<TranslationCacheMode> {
  const configPackage = parsePackage(json, fallbackMode);
  await importTranslationCacheEntries(configPackage.mode, configPackage.entries);
  return configPackage.mode;
}

function parsePackage(json: string, fallbackMode: TranslationCacheMode): ExportedTranslationCachePackage {
  try {
    const input = JSON.parse(json) as Partial<ExportedTranslationCachePackage>;

    return {
      schemaVersion: 1,
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
      mode: normalizeMode(input.mode, fallbackMode),
      entries: normalizeEntries(input.entries),
    };
  } catch {
    throw new Error('jsonTransfer.importFailed');
  }
}

function normalizeMode(value: unknown, fallbackMode: TranslationCacheMode): TranslationCacheMode {
  return value === 'normal' || value === 'context' ? value : fallbackMode;
}

function normalizeEntries(entries: unknown): TranslationCacheViewEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error('jsonTransfer.importFailed');
  }

  return entries.map((entry) => {
    const item = entry as Partial<TranslationCacheViewEntry>;
    return {
      sourceText: String(item.sourceText ?? ''),
      targetLanguage: String(item.targetLanguage ?? ''),
      text: typeof item.text === 'string' ? item.text : null,
      tid: String(item.tid ?? ''),
      updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    };
  });
}
