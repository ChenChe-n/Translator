import type { ApiCheckResult, ApiConfig } from '../types/api';

const CONFIG_STORAGE_KEY = 'Translator.apiConfig';
const CHECK_RESULTS_STORAGE_KEY = 'Translator.apiCheckResults';

const defaultConfig: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
};

/**
 * 读取 API 配置。
 *
 * @returns API 配置。
 */
export async function loadApiConfig(): Promise<ApiConfig> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return defaultConfig;
  }

  const stored = await chrome.storage.local.get(CONFIG_STORAGE_KEY);
  return {
    ...defaultConfig,
    ...(stored[CONFIG_STORAGE_KEY] as Partial<ApiConfig> | undefined),
  };
}

/**
 * 保存 API 配置。
 *
 * @param config API 配置。
 * @returns 无返回值。
 */
export async function saveApiConfig(config: ApiConfig): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({
    [CONFIG_STORAGE_KEY]: config,
  });
}

/**
 * 读取上一次 API 测试结果。
 *
 * @returns API 测试结果列表。
 */
export async function loadApiCheckResults(): Promise<ApiCheckResult[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return [];
  }

  const stored = await chrome.storage.local.get(CHECK_RESULTS_STORAGE_KEY);
  return (stored[CHECK_RESULTS_STORAGE_KEY] as ApiCheckResult[] | undefined) ?? [];
}

/**
 * 保存上一次 API 测试结果。
 *
 * @param results API 测试结果列表。
 * @returns 无返回值。
 */
export async function saveApiCheckResults(results: ApiCheckResult[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({
    [CHECK_RESULTS_STORAGE_KEY]: results,
  });
}
