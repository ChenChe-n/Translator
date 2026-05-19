/**
 * 文本解析耗时记录。
 */
export interface TextParseMetric {
  id: string;
  mode: string;
  durationMs: number;
  textCount: number;
  createdAt: number;
}
