/**
 * OpenAI 兼容接口配置。
 */
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 单项 API 测试状态。
 */
export interface ApiCheckResult {
  key: ApiCheckKey;
  label: string;
  passed: boolean;
  message: string;
}

/**
 * API 测试项标识。
 */
export type ApiCheckKey = 'basicText' | 'jsonOutput' | 'imageUnderstanding' | 'streamOutput';
