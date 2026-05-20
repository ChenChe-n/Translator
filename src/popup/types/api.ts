/**
 * OpenAI 兼容接口配置。
 */
export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  disableThinkingStrategy?: DisableThinkingStrategy;
  maxConcurrency: number;
  inputTokenPrice: number;
  cachedInputTokenPrice: number;
  outputTokenPrice: number;
}

/**
 * 模型 token 价格配置。
 */
export type ApiPriceConfig = Pick<ApiConfig, 'inputTokenPrice' | 'cachedInputTokenPrice' | 'outputTokenPrice'>;

/**
 * OpenAI 兼容接口配置集合。
 */
export interface ApiConfigState {
  activeConfigId: string;
  configs: ApiConfig[];
}

/**
 * 单项 API 测试状态。
 */
export interface ApiCheckResult {
  key: ApiCheckKey;
  label: string;
  status: ApiCheckStatus;
  passed: boolean;
  message: string;
  configSignature?: string;
  disableThinkingStrategy?: DisableThinkingStrategy;
  durationMs?: number;
  tokenPerSecond?: number;
}

/**
 * 按配置保存的 API 测试结果。
 */
export type ApiCheckResultMap = Record<string, ApiCheckResult[]>;

/**
 * 模型每日 token 使用量。
 */
export interface ModelDailyUsage {
  date: string;
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/**
 * 模型统计设置。
 */
export interface UsageStatsSettings {
  retentionDays: number;
}

/**
 * 模型调用记录输入。
 */
export interface ModelUsageRecordInput {
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}

/**
 * API 测试项标识。
 */
export type ApiCheckKey =
  | 'thinkingMode'
  | 'basicText'
  | 'jsonOutput'
  | 'imageUnderstanding'
  | 'streamOutput'
  | 'tokenThroughput';

/**
 * API 测试运行状态。
 */
export type ApiCheckStatus = 'pending' | 'running' | 'finished';

/**
 * 禁用模型思考模式的请求体策略。
 */
export type DisableThinkingStrategy = 'none' | 'thinking' | 'enableThinking' | 'both';
