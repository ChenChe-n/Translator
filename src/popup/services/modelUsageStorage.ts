import type { ModelDailyUsage, ModelUsageRecordInput, UsageStatsSettings } from '../types/api';

export const USAGE_STORAGE_KEY = 'Translator.modelDailyUsage';
const SETTINGS_STORAGE_KEY = 'Translator.usageStatsSettings';
const DEFAULT_RETENTION_DAYS = 30;

/**
 * 读取统计设置。
 *
 * @returns 统计设置。
 */
export async function loadUsageStatsSettings(): Promise<UsageStatsSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewSettings();
  }

  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  return {
    ...createDefaultSettings(),
    ...(stored[SETTINGS_STORAGE_KEY] as Partial<UsageStatsSettings> | undefined),
  };
}

/**
 * 保存统计设置。
 *
 * @param settings 统计设置。
 * @returns 无返回值。
 */
export async function saveUsageStatsSettings(settings: UsageStatsSettings): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewSettings(settings);
    savePreviewUsage(pruneUsage(loadPreviewUsage(), settings.retentionDays));
    return;
  }

  const usage = await loadModelDailyUsage();
  await chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: settings,
    [USAGE_STORAGE_KEY]: pruneUsage(usage, settings.retentionDays),
  });
}

/**
 * 读取模型使用统计。
 *
 * @returns 模型每日 token 使用量列表。
 */
export async function loadModelDailyUsage(): Promise<ModelDailyUsage[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewUsage();
  }

  const stored = await chrome.storage.local.get(USAGE_STORAGE_KEY);
  return (stored[USAGE_STORAGE_KEY] as ModelDailyUsage[] | undefined) ?? [];
}

/**
 * 记录一次模型调用。
 *
 * @param input 模型调用统计输入。
 * @returns 无返回值。
 */
export async function recordModelUsage(input: ModelUsageRecordInput): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewUsage(upsertTodayUsage(loadPreviewUsage(), input));
    return;
  }

  const [settings, usage] = await Promise.all([loadUsageStatsSettings(), loadModelDailyUsage()]);
  const nextUsage = upsertTodayUsage(usage, input);
  await saveModelDailyUsage(pruneUsage(nextUsage, settings.retentionDays));
}

/**
 * 清空模型使用统计。
 *
 * @returns 无返回值。
 */
export async function clearModelDailyUsage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(USAGE_STORAGE_KEY);
    return;
  }

  await chrome.storage.local.remove(USAGE_STORAGE_KEY);
}

/**
 * 清空模型使用统计设置。
 *
 * @returns 默认统计设置。
 */
export async function clearUsageStatsSettings(): Promise<UsageStatsSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    return createDefaultSettings();
  }

  await chrome.storage.local.remove(SETTINGS_STORAGE_KEY);
  return createDefaultSettings();
}

/**
 * 按保留天数裁剪模型使用统计。
 *
 * @param usage 模型每日 token 使用量列表。
 * @param retentionDays 保留天数。
 * @returns 裁剪后的统计列表。
 */
export function pruneUsage(usage: ModelDailyUsage[], retentionDays: number): ModelDailyUsage[] {
  const startDate = getRetentionStartDate(retentionDays);
  return usage.filter((item) => item.date >= startDate);
}

async function saveModelDailyUsage(usage: ModelDailyUsage[]): Promise<void> {
  await chrome.storage.local.set({
    [USAGE_STORAGE_KEY]: usage,
  });
}

function upsertTodayUsage(usage: ModelDailyUsage[], input: ModelUsageRecordInput): ModelDailyUsage[] {
  const today = getTodayKey();
  const found = usage.find((item) => item.date === today && item.model === input.model);

  if (found) {
    return usage.map((item) =>
      item === found
        ? {
            ...item,
            inputTokens: item.inputTokens + input.inputTokens,
            outputTokens: item.outputTokens + input.outputTokens,
          }
        : item,
    );
  }

  return [
    ...usage,
    {
      date: today,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    },
  ];
}

function createDefaultSettings(): UsageStatsSettings {
  return {
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

function loadPreviewSettings(): UsageStatsSettings {
  const value = localStorage.getItem(SETTINGS_STORAGE_KEY);
  return value ? { ...createDefaultSettings(), ...JSON.parse(value) } : createDefaultSettings();
}

function savePreviewSettings(settings: UsageStatsSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadPreviewUsage(): ModelDailyUsage[] {
  const value = localStorage.getItem(USAGE_STORAGE_KEY);
  return value ? (JSON.parse(value) as ModelDailyUsage[]) : [];
}

function savePreviewUsage(usage: ModelDailyUsage[]): void {
  localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
}

function getRetentionStartDate(retentionDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.max(1, retentionDays) + 1);
  return formatLocalDate(date);
}

function getTodayKey(): string {
  return formatLocalDate(new Date());
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
