import type {
  TranslationModeConfig,
  TranslationModeConfigMap,
  TranslationModeKey,
} from '../types/translationMode';
import { loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

const translationModeKeys: TranslationModeKey[] = ['normal', 'batch', 'context'];
const translationModeStorageKeys: Record<TranslationModeKey, string> = {
  normal: 'Translator.translationMode.normal',
  batch: 'Translator.translationMode.batch',
  context: 'Translator.translationMode.context',
};
const storageOptions = {
  modes: translationModeKeys,
  storageKeys: translationModeStorageKeys,
  normalizeConfigMap,
};

/**
 * 创建默认翻译模式配置。
 *
 * @returns 翻译模式配置集合。
 */
export function createDefaultTranslationModeConfigMap(): TranslationModeConfigMap {
  return {
    normal: createModeConfig('normal', 'translator/cache/normal'),
    batch: createModeConfig('batch', 'translator/cache/batch'),
    context: createModeConfig('context', 'translator/cache/context'),
  };
}

/**
 * 读取翻译模式配置。
 *
 * @returns 翻译模式配置集合。
 */
export async function loadTranslationModeConfigMap(): Promise<TranslationModeConfigMap> {
  return loadConfigMapFromStorage(storageOptions);
}

/**
 * 保存翻译模式配置。
 *
 * @param configMap 翻译模式配置集合。
 * @returns 无返回值。
 */
export async function saveTranslationModeConfigMap(configMap: TranslationModeConfigMap): Promise<void> {
  await saveConfigMapToStorage(storageOptions, configMap);
}

function createModeConfig(mode: TranslationModeKey, cachePath: string): TranslationModeConfig {
  return {
    mode,
    cachePath,
    parameters: {
      temperature: 0.3,
      maxTokens: 2048,
    },
    options: {
      preserveFormatting: true,
      enableCache: true,
    },
  };
}

function normalizeConfigMap(configMap: Partial<TranslationModeConfigMap> | undefined): TranslationModeConfigMap {
  const defaultConfigMap = createDefaultTranslationModeConfigMap();

  return translationModeKeys.reduce((result, mode) => {
    result[mode] = normalizeModeConfig(mode, defaultConfigMap[mode], configMap?.[mode]);
    return result;
  }, {} as TranslationModeConfigMap);
}

function normalizeModeConfig(
  mode: TranslationModeKey,
  defaultConfig: TranslationModeConfig,
  config: Partial<TranslationModeConfig> | undefined,
): TranslationModeConfig {
  return {
    ...defaultConfig,
    ...config,
    mode,
    parameters: {
      ...defaultConfig.parameters,
      ...config?.parameters,
    },
    options: {
      ...defaultConfig.options,
      ...config?.options,
    },
  };
}
