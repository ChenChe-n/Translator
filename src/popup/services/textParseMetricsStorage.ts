import type { TextParseMetric } from '../types/textParseMetrics';

export const TEXT_PARSE_METRICS_KEY = 'Translator.textParseMetrics';
const maxMetricCount = 50;

/**
 * 读取文本解析耗时记录。
 *
 * @returns 最近文本解析耗时记录。
 */
export async function loadTextParseMetrics(): Promise<TextParseMetric[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeMetrics(readPreviewMetrics());
  }

  const stored = await chrome.storage.local.get(TEXT_PARSE_METRICS_KEY);
  return normalizeMetrics(stored[TEXT_PARSE_METRICS_KEY] as TextParseMetric[] | undefined);
}

/**
 * 追加文本解析耗时记录。
 *
 * @param metric 文本解析耗时记录。
 * @returns 无返回值。
 */
export async function appendTextParseMetric(metric: TextParseMetric): Promise<void> {
  const metrics = [...(await loadTextParseMetrics()), normalizeMetric(metric)].slice(-maxMetricCount);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(TEXT_PARSE_METRICS_KEY, JSON.stringify(metrics));
    return;
  }

  await chrome.storage.local.set({
    [TEXT_PARSE_METRICS_KEY]: metrics,
  });
}

function readPreviewMetrics(): TextParseMetric[] | undefined {
  const value = localStorage.getItem(TEXT_PARSE_METRICS_KEY);
  return value ? (JSON.parse(value) as TextParseMetric[]) : undefined;
}

function normalizeMetrics(metrics: TextParseMetric[] | undefined): TextParseMetric[] {
  return (metrics ?? []).map(normalizeMetric).slice(-maxMetricCount);
}

function normalizeMetric(metric: TextParseMetric): TextParseMetric {
  return {
    id: metric.id || `metric-${Date.now()}`,
    mode: metric.mode || 'visible',
    durationMs: Math.max(0, Math.round(metric.durationMs)),
    textCount: Math.max(0, Math.round(metric.textCount)),
    createdAt: Number.isFinite(metric.createdAt) ? metric.createdAt : Date.now(),
  };
}
