import type { ApiConfig } from '../types/api';

const STORAGE_KEY = 'Translator.apiConfig';

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

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return {
    ...defaultConfig,
    ...(stored[STORAGE_KEY] as Partial<ApiConfig> | undefined),
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
    [STORAGE_KEY]: config,
  });
}
