import type {
  TextParseModeConfig,
  TextParseModeConfigMap,
  TextParseModeKey,
  TextParseModeOptions,
} from '../types/textParseMode';
import { loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

export const ACTIVE_TEXT_PARSE_MODE_KEY = 'Translator.textParseMode.active';
export const TEXT_PARSE_MODE_KEYS: TextParseModeKey[] = ['visible', 'full', 'structured'];
export const TEXT_PARSE_MODE_STORAGE_KEYS: Record<TextParseModeKey, string> = {
  visible: 'Translator.textParseMode.visible',
  full: 'Translator.textParseMode.full',
  structured: 'Translator.textParseMode.structured',
};

const storageOptions = {
  modes: TEXT_PARSE_MODE_KEYS,
  storageKeys: TEXT_PARSE_MODE_STORAGE_KEYS,
  normalizeConfigMap,
};

/**
 * 创建默认文本解析模式配置。
 *
 * @returns 文本解析模式配置集合。
 */
export function createDefaultTextParseModeConfigMap(): TextParseModeConfigMap {
  return {
    visible: createModeConfig('visible', 500, createStructuredOptions(false)),
    full: createModeConfig('full', 500, createStructuredOptions(false)),
    structured: createModeConfig('structured', 500, createStructuredOptions(false)),
  };
}

/**
 * 读取文本解析模式配置。
 *
 * @returns 文本解析模式配置集合。
 */
export async function loadTextParseModeConfigMap(): Promise<TextParseModeConfigMap> {
  return loadConfigMapFromStorage(storageOptions);
}

/**
 * 保存文本解析模式配置。
 *
 * @param configMap 文本解析模式配置集合。
 * @returns 无返回值。
 */
export async function saveTextParseModeConfigMap(configMap: TextParseModeConfigMap): Promise<void> {
  await saveConfigMapToStorage(storageOptions, configMap);
}

/**
 * 读取当前文本解析模式。
 *
 * @returns 当前文本解析模式。
 */
export async function loadActiveTextParseMode(): Promise<TextParseModeKey> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeMode(localStorage.getItem(ACTIVE_TEXT_PARSE_MODE_KEY));
  }

  const stored = await chrome.storage.local.get(ACTIVE_TEXT_PARSE_MODE_KEY);
  return normalizeMode(stored[ACTIVE_TEXT_PARSE_MODE_KEY]);
}

/**
 * 保存当前文本解析模式。
 *
 * @param mode 当前文本解析模式。
 * @returns 无返回值。
 */
export async function saveActiveTextParseMode(mode: TextParseModeKey): Promise<void> {
  const nextMode = normalizeMode(mode);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(ACTIVE_TEXT_PARSE_MODE_KEY, nextMode);
    return;
  }

  await chrome.storage.local.set({
    [ACTIVE_TEXT_PARSE_MODE_KEY]: nextMode,
  });
}

function createModeConfig(
  mode: TextParseModeKey,
  autoParseDelayMs: number,
  options: TextParseModeOptions,
): TextParseModeConfig {
  return {
    mode,
    autoParseDelayMs,
    options,
  };
}

function createStructuredOptions(enabled: boolean): TextParseModeOptions {
  return {
    preserveId: enabled,
    preserveClass: enabled,
    preserveStyle: false,
    preserveUrl: enabled,
    showTextMarker: false,
    overwriteWithTestText: false,
    testText: 'test text',
  };
}

function normalizeConfigMap(configMap: Partial<TextParseModeConfigMap> | undefined): TextParseModeConfigMap {
  const defaultConfigMap = createDefaultTextParseModeConfigMap();

  return TEXT_PARSE_MODE_KEYS.reduce((result, mode) => {
    result[mode] = normalizeModeConfig(mode, defaultConfigMap[mode], configMap?.[mode]);
    return result;
  }, {} as TextParseModeConfigMap);
}

function normalizeModeConfig(
  mode: TextParseModeKey,
  defaultConfig: TextParseModeConfig,
  config: Partial<TextParseModeConfig> | undefined,
): TextParseModeConfig {
  return {
    ...defaultConfig,
    ...config,
    mode,
    autoParseDelayMs: normalizeDelay(config?.autoParseDelayMs, defaultConfig.autoParseDelayMs),
    options: {
      ...defaultConfig.options,
      ...config?.options,
    },
  };
}

function normalizeDelay(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 100 ? value : Math.max(fallback, 100);
}

function normalizeMode(value: unknown): TextParseModeKey {
  return TEXT_PARSE_MODE_KEYS.includes(value as TextParseModeKey) ? (value as TextParseModeKey) : 'visible';
}
