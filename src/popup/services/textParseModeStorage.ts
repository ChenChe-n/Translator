import type {
  TextParseModeConfig,
  TextParseModeConfigMap,
  TextParseModeKey,
  TextParseModeOptions,
} from '../types/textParseMode';
import { loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

const textParseModeKeys: TextParseModeKey[] = ['visible', 'full', 'structured'];
const textParseModeStorageKeys: Record<TextParseModeKey, string> = {
  visible: 'Translator.textParseMode.visible',
  full: 'Translator.textParseMode.full',
  structured: 'Translator.textParseMode.structured',
};
const storageOptions = {
  modes: textParseModeKeys,
  storageKeys: textParseModeStorageKeys,
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
    structured: createModeConfig('structured', 500, createStructuredOptions(true)),
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
  };
}

function normalizeConfigMap(configMap: Partial<TextParseModeConfigMap> | undefined): TextParseModeConfigMap {
  const defaultConfigMap = createDefaultTextParseModeConfigMap();

  return textParseModeKeys.reduce((result, mode) => {
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
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
