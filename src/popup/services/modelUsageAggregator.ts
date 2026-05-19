import type { ModelDailyUsage } from '../types/api';

/**
 * 模型使用排行项。
 */
export interface ModelUsageRankItem {
  model: string;
  tokens: number;
  percent: number;
}

/**
 * 每日图表数据。
 */
export interface DailyUsageChartItem {
  date: string;
  totalTokens: number;
}

/**
 * 聚合每日总用量。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 每日图表数据。
 */
export function aggregateDailyUsage(usage: ModelDailyUsage[]): DailyUsageChartItem[] {
  const map = new Map<string, number>();

  for (const item of usage) {
    map.set(item.date, (map.get(item.date) ?? 0) + getTotalTokens(item));
  }

  return [...map.entries()]
    .map(([date, totalTokens]) => ({
      date,
      totalTokens,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * 聚合当天模型排行。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 当天模型排行。
 */
export function aggregateTodayRanking(usage: ModelDailyUsage[]): ModelUsageRankItem[] {
  const today = formatLocalDate(new Date());
  return aggregateModelRanking(usage.filter((item) => item.date === today));
}

/**
 * 聚合全部模型排行。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 全部模型排行。
 */
export function aggregateModelRanking(usage: ModelDailyUsage[]): ModelUsageRankItem[] {
  const map = new Map<string, number>();

  for (const item of usage) {
    map.set(item.model, (map.get(item.model) ?? 0) + getTotalTokens(item));
  }

  const total = [...map.values()].reduce((sum, value) => sum + value, 0);
  return [...map.entries()]
    .map(([model, tokens]) => ({
      model,
      tokens,
      percent: total > 0 ? Math.round((tokens / total) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.tokens - left.tokens);
}

function getTotalTokens(item: ModelDailyUsage): number {
  return item.inputTokens + item.outputTokens;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
