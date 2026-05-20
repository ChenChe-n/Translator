import type {
  TranslationModeConfig,
  TranslationModeConfigMap,
  TranslationModeKey,
} from '../types/translationMode';
import { clearConfigMapStorage, loadConfigMapFromStorage, saveConfigMapToStorage } from './configMapStorage';

export const DEFAULT_NORMAL_TRANSLATION_PROMPT =
  '你是翻译引擎。\n' +
  '目标语言：{TARGET_LOCALE}。格式要求：{FORMAT_MODE}。\n' +
  '输入是 JSONL，每行一个对象，每个对象只有一个 TID 键。\n' +
  '输入顺序就是局部上下文顺序，按页面从左到右、从上到下排列。\n' +
  '输出也必须是 JSONL，每个输入行对应一个输出行，TID 必须完全不变。\n' +
  '除非整句已经是目标语言，或整句是领域关键词、专有名词、代码、数字、符号，否则都应该翻译。\n' +
  '整句无需翻译时输出 JSON null；不要输出“不翻译”等说明文字。\n' +
  '需要翻译时只输出译文字符串。\n' +
  '示例：\n{OUTPUT_EXAMPLE}';

export const TRANSLATION_MODE_KEYS: TranslationModeKey[] = ['normal', 'context'];
export const ACTIVE_TRANSLATION_MODE_KEY = 'Translator.translationMode.activeMode';
export const TRANSLATION_MODE_STORAGE_KEYS: Record<TranslationModeKey, string> = {
  normal: 'Translator.translationMode.normal',
  context: 'Translator.translationMode.context',
};
const legacyNormalPromptSnippets = [
  '输入行前的空格表示局部上下文层级。',
];
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
 * 读取当前启用的翻译模式。
 *
 * @returns 当前翻译模式。
 */
export async function loadActiveTranslationMode(): Promise<TranslationModeKey> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeMode(localStorage.getItem(ACTIVE_TRANSLATION_MODE_KEY));
  }

  const stored = await chrome.storage.local.get(ACTIVE_TRANSLATION_MODE_KEY);
  return normalizeMode(stored[ACTIVE_TRANSLATION_MODE_KEY]);
}

/**
 * 保存当前启用的翻译模式。
 *
 * @param mode 翻译模式。
 * @returns 标准化后的翻译模式。
 */
export async function saveActiveTranslationMode(mode: TranslationModeKey): Promise<TranslationModeKey> {
  const nextMode = normalizeMode(mode);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(ACTIVE_TRANSLATION_MODE_KEY, nextMode);
    return nextMode;
  }

  await chrome.storage.local.set({
    [ACTIVE_TRANSLATION_MODE_KEY]: nextMode,
  });
  return nextMode;
}

/**
 * 清空翻译模式配置。
 *
 * @returns 默认翻译模式配置集合。
 */
export async function clearTranslationModeConfigMap(): Promise<TranslationModeConfigMap> {
  await clearConfigMapStorage(storageOptions);
  await saveActiveTranslationMode('normal');
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
      paragraphInput: false,
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
    prompt: normalizePrompt(mode, config?.prompt, defaultConfig.prompt),
    parameters: {
      ...defaultConfig.parameters,
      ...config?.parameters,
      batchMaxItems: isParagraphInputEnabled(mode, config)
        ? 1
        : normalizeNumber(config?.parameters?.batchMaxItems, 1, 1024, defaultConfig.parameters.batchMaxItems),
      batchMaxTokens: normalizeNumber(config?.parameters?.batchMaxTokens, 1, 128000, defaultConfig.parameters.batchMaxTokens),
      batchWaitMs: normalizeNumber(config?.parameters?.batchWaitMs, 0, 60000, defaultConfig.parameters.batchWaitMs),
    },
    options: {
      ...defaultConfig.options,
      ...config?.options,
      enableCache: mode === 'normal' ? config?.options?.enableCache ?? defaultConfig.options.enableCache : false,
      paragraphInput: mode === 'normal' ? config?.options?.paragraphInput ?? defaultConfig.options.paragraphInput : false,
      showTranslatingMarker: mode === 'normal'
        ? config?.options?.showTranslatingMarker ?? defaultConfig.options.showTranslatingMarker
        : false,
    },
  };
}

function normalizePrompt(mode: TranslationModeKey, prompt: string | undefined, fallback: string): string {
  if (!prompt) {
    return fallback;
  }

  return mode === 'normal' && legacyNormalPromptSnippets.some((snippet) => prompt.includes(snippet))
    ? fallback
    : prompt;
}

function normalizeNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function isParagraphInputEnabled(
  mode: TranslationModeKey,
  config: Partial<TranslationModeConfig> | undefined,
): boolean {
  return mode === 'normal' && Boolean(config?.options?.paragraphInput);
}

function normalizeMode(_value: unknown): TranslationModeKey {
  return 'normal';
}
