import type { ApiConfig } from './api';
import type { TranslationModeConfig } from './translationMode';

/**
 * 普通模式翻译输入。
 */
export interface NormalTranslationInput {
  text: string;
}

/**
 * 普通模式翻译结果。
 */
export interface NormalTranslationResult {
  tid: string;
  text: string | null;
}

/**
 * 普通模式待翻译条目。
 */
export interface NormalTranslationPendingItem {
  apiConfig: ApiConfig;
  config: TranslationModeConfig;
  depth?: number;
  id: string;
  promise?: Promise<NormalTranslationResult>;
  targetLanguage: string;
  text: string;
  resolve: (result: NormalTranslationResult) => void;
  reject: (error: unknown) => void;
}
