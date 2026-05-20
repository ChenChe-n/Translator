/**
 * OpenAI 兼容接口配置。
 */
export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxConcurrency: number;
}

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
  outputTokens: number;
}

/**
 * API 测试项标识。
 */
export type ApiCheckKey =
  | 'basicText'
  | 'jsonOutput'
  | 'imageUnderstanding'
  | 'streamOutput'
  | 'tokenThroughput';

/**
 * API 测试运行状态。
 */
export type ApiCheckStatus = 'pending' | 'running' | 'finished';
