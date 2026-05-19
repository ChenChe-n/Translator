import type {
  TranslationModeConfig,
  TranslationModeConfigMap,
  TranslationModeKey,
} from '../types/translationMode';
import { loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

export const DEFAULT_NORMAL_TRANSLATION_PROMPT =
  '你是一个翻译机器，{是否保留原文格式}，将输入翻译为{目标语言(默认为界面语言)}，使用jsonl格式，每一行是一个输入或输出。如果输入不需要翻译，请原样复制 Tid。\n' +
  '输入实例:\n' +
  '{"2Bfn1lac-0001": "测试文本"},\n' +
  '输出实例:\n' +
  '{"2Bfn1lac-0001": "test text"},\n' +
  'or\n' +
  '{"2Bfn1lac-0001": null},';

const translationModeKeys: TranslationModeKey[] = ['normal', 'context'];
const translationModeStorageKeys: Record<TranslationModeKey, string> = {
  normal: 'Translator.translationMode.normal',
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
    normal: createModeConfig('normal', DEFAULT_NORMAL_TRANSLATION_PROMPT),
    context: createModeConfig('context', DEFAULT_NORMAL_TRANSLATION_PROMPT),
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

function createModeConfig(mode: TranslationModeKey, prompt: string): TranslationModeConfig {
  return {
    mode,
    prompt,
    parameters: {
      temperature: 0.3,
      maxTokens: 2048,
      batchMaxItems: 1,
      batchMaxTokens: 16 * 1024,
      batchWaitMs: 300,
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
    prompt: config?.prompt || defaultConfig.prompt,
    parameters: {
      ...defaultConfig.parameters,
      ...config?.parameters,
      batchMaxItems: normalizeNumber(config?.parameters?.batchMaxItems, 1, 1024, defaultConfig.parameters.batchMaxItems),
      batchMaxTokens: normalizeNumber(config?.parameters?.batchMaxTokens, 1, 128000, defaultConfig.parameters.batchMaxTokens),
      batchWaitMs: normalizeNumber(config?.parameters?.batchWaitMs, 0, 60000, defaultConfig.parameters.batchWaitMs),
    },
    options: {
      ...defaultConfig.options,
      ...config?.options,
    },
  };
}

function normalizeNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
