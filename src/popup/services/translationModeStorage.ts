import type {
  TranslationModeConfig,
  TranslationModeConfigMap,
  TranslationModeKey,
} from '../types/translationMode';
import { clearConfigMapStorage, loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

export const DEFAULT_NORMAL_TRANSLATION_PROMPT =
  'You are a translation engine.\n' +
  'Target locale: {TARGET_LOCALE}. Format mode: {FORMAT_MODE}.\n' +
  'Input is JSONL: one object per line, one Tid key per object.\n' +
  'Output only JSONL, one object per input line, no markdown, no extra text, no trailing commas.\n' +
  'Keep each Tid exactly as given. Translate values only when the source text is not already in the target locale.\n' +
  'Use null when the value is already in the target locale, empty, non-text noise, or should not be translated.';

export const TRANSLATION_MODE_KEYS: TranslationModeKey[] = ['normal', 'context'];
export const TRANSLATION_MODE_STORAGE_KEYS: Record<TranslationModeKey, string> = {
  normal: 'Translator.translationMode.normal',
  context: 'Translator.translationMode.context',
};
const storageOptions = {
  modes: TRANSLATION_MODE_KEYS,
  storageKeys: TRANSLATION_MODE_STORAGE_KEYS,
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
    context: createModeConfig('context', ''),
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

/**
 * 清空翻译模式配置。
 *
 * @returns 默认翻译模式配置集合。
 */
export async function clearTranslationModeConfigMap(): Promise<TranslationModeConfigMap> {
  await clearConfigMapStorage(storageOptions);
  return createDefaultTranslationModeConfigMap();
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
      enableCache: mode === 'normal',
      showTranslatingMarker: false,
    },
  };
}

function normalizeConfigMap(configMap: Partial<TranslationModeConfigMap> | undefined): TranslationModeConfigMap {
  const defaultConfigMap = createDefaultTranslationModeConfigMap();

  return TRANSLATION_MODE_KEYS.reduce((result, mode) => {
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
      enableCache: mode === 'normal' ? config?.options?.enableCache ?? defaultConfig.options.enableCache : false,
      showTranslatingMarker: mode === 'normal'
        ? config?.options?.showTranslatingMarker ?? defaultConfig.options.showTranslatingMarker
        : false,
    },
  };
}

function normalizeNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
