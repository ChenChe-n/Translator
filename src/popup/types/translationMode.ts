/**
 * 翻译模式标识。
 */
export type TranslationModeKey = 'normal' | 'context';

/**
 * 翻译模式参数。
 */
export interface TranslationModeParameters {
  temperature: number;
  maxTokens: number;
  batchMaxItems: number;
  batchMaxTokens: number;
  batchWaitMs: number;
}

/**
 * 翻译模式选项。
 */
export interface TranslationModeOptions {
  preserveFormatting: boolean;
  enableCache: boolean;
  showTranslatingMarker: boolean;
}

/**
 * 单个翻译模式配置。
 */
export interface TranslationModeConfig {
  mode: TranslationModeKey;
  prompt: string;
  parameters: TranslationModeParameters;
  options: TranslationModeOptions;
}

/**
 * 翻译模式配置集合。
 */
export type TranslationModeConfigMap = Record<TranslationModeKey, TranslationModeConfig>;
