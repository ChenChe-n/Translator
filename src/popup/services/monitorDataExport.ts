import type { ModelCallLog } from '../types/modelCall';
import type { ModelDailyUsage, UsageStatsSettings } from '../types/api';
import type { TextParseMetric } from '../types/textParseMetrics';
import { loadModelCallLogs } from './modelCallLogStorage';
import { loadModelDailyUsage, loadUsageStatsSettings } from './modelUsageStorage';
import { loadTextParseMetrics } from './textParseMetricsStorage';
import { loadTranslationCacheStats, type TranslationCacheStats } from './translationCacheStorage';

/**
 * 监控数据导出包。
 */
export interface ExportedMonitorDataPackage {
  cacheStats: {
    context: TranslationCacheStats;
    normal: TranslationCacheStats;
  };
  exportedAt: string;
  modelCallLogs: ModelCallLog[];
  modelUsage: ModelDailyUsage[];
  schemaVersion: 1;
  textParseMetrics: TextParseMetric[];
  usageSettings: UsageStatsSettings;
}

/**
 * 导出监控页数据。
 *
 * @returns 监控数据 JSON 文本。
 */
export async function exportMonitorDataJson(): Promise<string> {
  const [textParseMetrics, modelCallLogs, modelUsage, usageSettings, normalStats, contextStats] = await Promise.all([
    loadTextParseMetrics(),
    loadModelCallLogs(),
    loadModelDailyUsage(),
    loadUsageStatsSettings(),
    loadTranslationCacheStats('normal'),
    loadTranslationCacheStats('context'),
  ]);

  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    textParseMetrics,
    modelCallLogs,
    modelUsage,
    usageSettings,
    cacheStats: {
      normal: normalStats,
      context: contextStats,
    },
  } satisfies ExportedMonitorDataPackage, null, 2);
}
