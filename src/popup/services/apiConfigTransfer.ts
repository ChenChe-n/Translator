import type { ApiCheckResultMap, ApiConfigState, ModelDailyUsage, UsageStatsSettings } from '../types/api';
import {
  CHECK_RESULT_MAP_STORAGE_KEY,
  CHECK_RESULTS_STORAGE_KEY,
  loadApiConfigState,
  saveApiConfigState,
} from './apiConfigStorage';
import {
  USAGE_SETTINGS_STORAGE_KEY,
  USAGE_STORAGE_KEY,
  loadModelDailyUsage,
  loadUsageStatsSettings,
} from './modelUsageStorage';

/**
 * API 配置导出包。
 */
export interface ExportedApiConfigPackage {
  apiConfigState: ApiConfigState;
  checkResults: ApiCheckResultMap;
  exportedAt: string;
  modelUsage: ModelDailyUsage[];
  schemaVersion: 1;
  usageSettings: UsageStatsSettings;
}

/**
 * 导出 API 配置。
 *
 * @returns API 配置 JSON 文本。
 */
export async function exportApiConfigJson(): Promise<string> {
  const [apiConfigState, checkResults, modelUsage, usageSettings] = await Promise.all([
    loadApiConfigState(),
    loadApiCheckResultMap(),
    loadModelDailyUsage(),
    loadUsageStatsSettings(),
  ]);

  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    apiConfigState,
    checkResults,
    modelUsage,
    usageSettings,
  } satisfies ExportedApiConfigPackage, null, 2);
}

/**
 * 导入 API 配置。
 *
 * @param json API 配置 JSON 文本。
 * @returns 标准化后的 API 配置集合。
 */
export async function importApiConfigJson(json: string): Promise<ApiConfigState> {
  const configPackage = parsePackage(json);
  await Promise.all([
    saveApiConfigState(configPackage.apiConfigState),
    saveApiPageData(configPackage),
  ]);
  return loadApiConfigState();
}

async function loadApiCheckResultMap(): Promise<ApiCheckResultMap> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewObject(CHECK_RESULT_MAP_STORAGE_KEY);
  }

  const stored = await chrome.storage.local.get([CHECK_RESULT_MAP_STORAGE_KEY, CHECK_RESULTS_STORAGE_KEY]);
  const resultMap = stored[CHECK_RESULT_MAP_STORAGE_KEY] as ApiCheckResultMap | undefined;
  const legacyResults = stored[CHECK_RESULTS_STORAGE_KEY];
  return resultMap ?? (Array.isArray(legacyResults) ? { default: legacyResults } : {});
}

async function saveApiPageData(configPackage: ExportedApiConfigPackage): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(CHECK_RESULT_MAP_STORAGE_KEY, JSON.stringify(configPackage.checkResults));
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(configPackage.modelUsage));
    localStorage.setItem(USAGE_SETTINGS_STORAGE_KEY, JSON.stringify(configPackage.usageSettings));
    return;
  }

  await chrome.storage.local.set({
    [CHECK_RESULT_MAP_STORAGE_KEY]: configPackage.checkResults,
    [USAGE_STORAGE_KEY]: configPackage.modelUsage,
    [USAGE_SETTINGS_STORAGE_KEY]: configPackage.usageSettings,
  });
}

function parsePackage(json: string): ExportedApiConfigPackage {
  try {
    const input = JSON.parse(json) as Partial<ExportedApiConfigPackage>;
    return {
      schemaVersion: 1,
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
      apiConfigState: requireObject(input.apiConfigState),
      checkResults: normalizeCheckResults(input.checkResults),
      modelUsage: normalizeModelUsage(input.modelUsage),
      usageSettings: normalizeUsageSettings(input.usageSettings),
    };
  } catch {
    throw new Error('jsonTransfer.importFailed');
  }
}

function requireObject<T>(value: T | undefined): T {
  if (!value || typeof value !== 'object') {
    throw new Error('jsonTransfer.importFailed');
  }

  return value;
}

function normalizeCheckResults(value: unknown): ApiCheckResultMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ApiCheckResultMap : {};
}

function normalizeModelUsage(value: unknown): ModelDailyUsage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    const usage = item as Partial<ModelDailyUsage>;
    return {
      date: String(usage.date ?? ''),
      model: String(usage.model ?? ''),
      inputTokens: normalizeNumber(usage.inputTokens),
      cachedInputTokens: normalizeNumber(usage.cachedInputTokens),
      outputTokens: normalizeNumber(usage.outputTokens),
    };
  });
}

function normalizeUsageSettings(value: unknown): UsageStatsSettings {
  const settings = value as Partial<UsageStatsSettings> | undefined;
  return {
    retentionDays: normalizeNumber(settings?.retentionDays, 30),
  };
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function loadPreviewObject<T>(key: string): T {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) as T : {} as T;
}
