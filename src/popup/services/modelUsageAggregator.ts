import type { ModelDailyUsage } from '../types/api';

/**
 * 模型使用排行项。
 */
export interface ModelUsageRankItem {
  model: string;
  tokens: number;
  percent: number;
  color: string;
}

/**
 * 每日模型图表片段。
 */
export interface DailyUsageSegment {
  model: string;
  tokens: number;
  color: string;
}

/**
 * 每日图表数据。
 */
export interface DailyUsageChartItem {
  date: string;
  totalTokens: number;
  segments: DailyUsageSegment[];
}

const MODEL_COLOR_COUNT = 8;

/**
 * 聚合每日总用量。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 每日图表数据。
 */
export function aggregateDailyUsage(
  usage: ModelDailyUsage[],
  colorMap = createModelColorMap(usage),
): DailyUsageChartItem[] {
  const dayMap = new Map<string, Map<string, number>>();

  for (const item of usage) {
    const modelMap = dayMap.get(item.date) ?? new Map<string, number>();
    modelMap.set(item.model, (modelMap.get(item.model) ?? 0) + getTotalTokens(item));
    dayMap.set(item.date, modelMap);
  }

  return [...dayMap.entries()]
    .map(([date, modelMap]) => {
      const segments = [...modelMap.entries()]
        .map(([model, tokens]) => ({
          model,
          tokens,
          color: getModelColor(model, colorMap),
        }))
        .sort((left, right) => right.tokens - left.tokens);

      return {
        date,
        segments,
        totalTokens: segments.reduce((sum, item) => sum + item.tokens, 0),
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * 聚合当天模型排行。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 当天模型排行。
 */
export function aggregateTodayRanking(
  usage: ModelDailyUsage[],
  colorMap = createModelColorMap(usage),
): ModelUsageRankItem[] {
  const today = formatLocalDate(new Date());
  return aggregateModelRanking(
    usage.filter((item) => item.date === today),
    colorMap,
  );
}

/**
 * 聚合全部模型排行。
 *
 * @param usage 模型每日 token 使用量列表。
 * @returns 全部模型排行。
 */
export function aggregateModelRanking(
  usage: ModelDailyUsage[],
  colorMap = createModelColorMap(usage),
): ModelUsageRankItem[] {
  const map = new Map<string, number>();

  for (const item of usage) {
    map.set(item.model, (map.get(item.model) ?? 0) + getTotalTokens(item));
  }

  const total = [...map.values()].reduce((sum, value) => sum + value, 0);
  return [...map.entries()]
    .map(([model, tokens]) => ({
      model,
      tokens,
      color: getModelColor(model, colorMap),
      percent: total > 0 ? Math.round((tokens / total) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.tokens - left.tokens);
}

export function createModelColorMap(usage: ModelDailyUsage[]): Map<string, string> {
  const models = [...new Set(usage.map((item) => item.model))].sort();
  return new Map(models.map((model, index) => [model, `var(--translator-model-${index % MODEL_COLOR_COUNT})`]));
}

function getModelColor(model: string, colorMap: ReadonlyMap<string, string>): string {
  return colorMap.get(model) ?? 'var(--translator-model-0)';
}

function getTotalTokens(item: ModelDailyUsage): number {
  return item.inputTokens + item.cachedInputTokens + item.outputTokens;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
