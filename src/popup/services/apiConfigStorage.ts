import type { ApiCheckResult, ApiCheckResultMap, ApiConfig, ApiConfigState } from '../types/api';
import { getTestedDisableThinkingStrategy, isApiConfigTestPassed } from './apiConfigValidation';

export const CONFIG_STORAGE_KEY = 'Translator.apiConfig';
export const CONFIG_STATE_STORAGE_KEY = 'Translator.apiConfigState';
export const CHECK_RESULTS_STORAGE_KEY = 'Translator.apiCheckResults';
export const CHECK_RESULT_MAP_STORAGE_KEY = 'Translator.apiCheckResultMap';

const defaultConfig: ApiConfig = {
  id: 'default',
  name: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  maxConcurrency: 4,
  inputTokenPrice: 0,
  cachedInputTokenPrice: 0,
  outputTokenPrice: 0,
};

/**
 * 读取 API 配置。
 *
 * @returns API 配置。
 */
export async function loadApiConfig(): Promise<ApiConfig> {
  const state = await loadApiConfigState();
  return getActiveConfig(state);
}

/**
 * 读取已通过测试的 API 配置。
 *
 * @returns 已附带测试兼容策略的 API 配置。
 */
export async function loadTestedApiConfig(): Promise<ApiConfig> {
  const config = await loadApiConfig();
  const results = await loadApiCheckResults(config.id);

  if (!isApiConfigTestPassed(config, results)) {
    throw new Error('api.errors.configNotTested');
  }

  return {
    ...config,
    disableThinkingStrategy: getTestedDisableThinkingStrategy(results),
  };
}

/**
 * 保存 API 配置。
 *
 * @param config API 配置。
 * @returns 无返回值。
 */
export async function saveApiConfig(config: ApiConfig): Promise<void> {
  const state = await loadApiConfigState();
  await saveApiConfigState({
    activeConfigId: config.id,
    configs: state.configs.map((item) => (item.id === config.id ? normalizeConfig(config) : item)),
  });
}

/**
 * 读取 API 配置集合。
 *
 * @returns API 配置集合。
 */
export async function loadApiConfigState(): Promise<ApiConfigState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewConfigState();
  }

  const stored = await chrome.storage.local.get([CONFIG_STATE_STORAGE_KEY, CONFIG_STORAGE_KEY]);
  const state = stored[CONFIG_STATE_STORAGE_KEY] as ApiConfigState | undefined;

  if (state?.configs?.length) {
    return normalizeState(state);
  }

  const legacyConfig = stored[CONFIG_STORAGE_KEY] as Partial<ApiConfig> | undefined;
  return normalizeState({
    activeConfigId: defaultConfig.id,
    configs: [
      {
        ...defaultConfig,
        ...legacyConfig,
      },
    ],
  });
}

/**
 * 保存 API 配置集合。
 *
 * @param state API 配置集合。
 * @returns 无返回值。
 */
export async function saveApiConfigState(state: ApiConfigState): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewConfigState(state);
    return;
  }

  await chrome.storage.local.set({
    [CONFIG_STATE_STORAGE_KEY]: normalizeState(state),
  });
}

/**
 * 清空 API 配置集合。
 *
 * @returns 默认 API 配置集合。
 */
export async function clearApiConfigState(): Promise<ApiConfigState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(CONFIG_STATE_STORAGE_KEY);
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    return createDefaultApiConfigState();
  }

  await chrome.storage.local.remove([CONFIG_STATE_STORAGE_KEY, CONFIG_STORAGE_KEY]);
  return createDefaultApiConfigState();
}

/**
 * 创建新的 API 配置。
 *
 * @returns API 配置。
 */
export function createApiConfig(): ApiConfig {
  const id = `config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ...defaultConfig,
    id,
    name: '',
  };
}

/**
 * 创建默认 API 配置集合。
 *
 * @returns API 配置集合。
 */
export function createDefaultApiConfigState(): ApiConfigState {
  return {
    activeConfigId: defaultConfig.id,
    configs: [defaultConfig],
  };
}

function getActiveConfig(state: ApiConfigState): ApiConfig {
  return state.configs.find((item) => item.id === state.activeConfigId) ?? state.configs[0] ?? defaultConfig;
}

function normalizeState(state: ApiConfigState): ApiConfigState {
  const configs = state.configs.length > 0 ? state.configs.map(normalizeConfig) : [defaultConfig];
  const activeConfigId = configs.some((item) => item.id === state.activeConfigId)
    ? state.activeConfigId
    : configs[0].id;

  return {
    activeConfigId,
    configs,
  };
}

function normalizeConfig(config: Partial<ApiConfig>): ApiConfig {
  const configName = config.name === '未命名' ? '' : config.name;
  const nextConfig = {
    ...defaultConfig,
    ...config,
    id: config.id || defaultConfig.id,
    name: configName ?? defaultConfig.name,
  };

  return {
    ...nextConfig,
    name: nextConfig.name || nextConfig.model || '',
    maxConcurrency: normalizeConcurrency(nextConfig.maxConcurrency),
    inputTokenPrice: normalizePrice(nextConfig.inputTokenPrice),
    cachedInputTokenPrice: normalizePrice(nextConfig.cachedInputTokenPrice),
    outputTokenPrice: normalizePrice(nextConfig.outputTokenPrice),
  };
}

function normalizeConcurrency(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(65536, Math.max(1, Math.floor(value))) : 4;
}

function normalizePrice(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * 读取上一次 API 测试结果。
 *
 * @returns API 测试结果列表。
 */
export async function loadApiCheckResults(configId: string): Promise<ApiCheckResult[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewCheckResults(configId);
  }

  const stored = await chrome.storage.local.get([CHECK_RESULT_MAP_STORAGE_KEY, CHECK_RESULTS_STORAGE_KEY]);
  const resultMap = stored[CHECK_RESULT_MAP_STORAGE_KEY] as ApiCheckResultMap | undefined;
  const legacyResults = (stored[CHECK_RESULTS_STORAGE_KEY] as ApiCheckResult[] | undefined) ?? [];
  return resultMap?.[configId] ?? legacyResults;
}

/**
 * 保存上一次 API 测试结果。
 *
 * @param results API 测试结果列表。
 * @returns 无返回值。
 */
export async function saveApiCheckResults(configId: string, results: ApiCheckResult[]): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewCheckResults(configId, results);
    return;
  }

  const stored = await chrome.storage.local.get(CHECK_RESULT_MAP_STORAGE_KEY);
  const resultMap = (stored[CHECK_RESULT_MAP_STORAGE_KEY] as ApiCheckResultMap | undefined) ?? {};
  await chrome.storage.local.set({
    [CHECK_RESULT_MAP_STORAGE_KEY]: {
      ...resultMap,
      [configId]: results,
    },
  });
}

/**
 * 清空 API 检测结果。
 *
 * @returns 无返回值。
 */
export async function clearApiCheckResults(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(CHECK_RESULT_MAP_STORAGE_KEY);
    localStorage.removeItem(CHECK_RESULTS_STORAGE_KEY);
    return;
  }

  await chrome.storage.local.remove([CHECK_RESULT_MAP_STORAGE_KEY, CHECK_RESULTS_STORAGE_KEY]);
}

function loadPreviewConfigState(): ApiConfigState {
  const value = localStorage.getItem(CONFIG_STATE_STORAGE_KEY);
  return value ? normalizeState(JSON.parse(value) as ApiConfigState) : createDefaultApiConfigState();
}

function savePreviewConfigState(state: ApiConfigState): void {
  localStorage.setItem(CONFIG_STATE_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function loadPreviewCheckResults(configId: string): ApiCheckResult[] {
  const value = localStorage.getItem(CHECK_RESULT_MAP_STORAGE_KEY);
  const resultMap = value ? (JSON.parse(value) as ApiCheckResultMap) : {};
  const legacyValue = localStorage.getItem(CHECK_RESULTS_STORAGE_KEY);
  const legacyResults = legacyValue ? (JSON.parse(legacyValue) as ApiCheckResult[]) : [];
  return resultMap[configId] ?? legacyResults;
}

function savePreviewCheckResults(configId: string, results: ApiCheckResult[]): void {
  const value = localStorage.getItem(CHECK_RESULT_MAP_STORAGE_KEY);
  const resultMap = value ? (JSON.parse(value) as ApiCheckResultMap) : {};
  localStorage.setItem(
    CHECK_RESULT_MAP_STORAGE_KEY,
    JSON.stringify({
      ...resultMap,
      [configId]: results,
    }),
  );
}
