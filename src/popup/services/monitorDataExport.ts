import type { ModelCallLog } from '../types/modelCall';
import type { TextParseMetric } from '../types/textParseMetrics';
import { loadModelCallLogs } from './modelCallLogStorage';
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
  schemaVersion: 1;
  textParseMetrics: TextParseMetric[];
}

/**
 * 导出监控页数据。
 *
 * @returns 监控数据 JSON 文本。
 */
export async function exportMonitorDataJson(): Promise<string> {
  const [textParseMetrics, modelCallLogs, normalStats, contextStats] = await Promise.all([
    loadTextParseMetrics(),
    loadModelCallLogs(),
    loadTranslationCacheStats('normal'),
    loadTranslationCacheStats('context'),
  ]);

  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    textParseMetrics,
    modelCallLogs,
    cacheStats: {
      normal: normalStats,
      context: contextStats,
    },
  } satisfies ExportedMonitorDataPackage, null, 2);
}
