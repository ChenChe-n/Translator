import type { ApiCheckResult, ApiConfig, ApiConfigState } from '../types/api';

const CONFIG_STORAGE_KEY = 'Translator.apiConfig';
const CONFIG_STATE_STORAGE_KEY = 'Translator.apiConfigState';
const CHECK_RESULTS_STORAGE_KEY = 'Translator.apiCheckResults';

const defaultConfig: ApiConfig = {
  id: 'default',
  name: '',
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
  const state = await loadApiConfigState();
  return getActiveConfig(state);
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
  };
}

/**
 * 读取上一次 API 测试结果。
 *
 * @returns API 测试结果列表。
 */
export async function loadApiCheckResults(): Promise<ApiCheckResult[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewCheckResults();
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
    savePreviewCheckResults(results);
    return;
  }

  await chrome.storage.local.set({
    [CHECK_RESULTS_STORAGE_KEY]: results,
  });
}

function loadPreviewConfigState(): ApiConfigState {
  const value = localStorage.getItem(CONFIG_STATE_STORAGE_KEY);
  return value ? normalizeState(JSON.parse(value) as ApiConfigState) : createDefaultApiConfigState();
}

function savePreviewConfigState(state: ApiConfigState): void {
  localStorage.setItem(CONFIG_STATE_STORAGE_KEY, JSON.stringify(normalizeState(state)));
}

function loadPreviewCheckResults(): ApiCheckResult[] {
  const value = localStorage.getItem(CHECK_RESULTS_STORAGE_KEY);
  return value ? (JSON.parse(value) as ApiCheckResult[]) : [];
}

function savePreviewCheckResults(results: ApiCheckResult[]): void {
  localStorage.setItem(CHECK_RESULTS_STORAGE_KEY, JSON.stringify(results));
}
