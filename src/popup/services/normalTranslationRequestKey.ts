import type { ApiConfig } from '../types/api';
import type { TranslationModeConfig } from '../types/translationMode';

/**
 * 创建普通翻译请求身份键。
 *
 * @param apiConfig API 配置。
 * @param modeConfig 翻译模式配置。
 * @param text 原文。
 * @param targetLanguage 目标语言。
 * @param tid 翻译 TID。
 * @returns 请求身份键。
 */
export function createNormalTranslationRequestKey(
  apiConfig: ApiConfig,
  modeConfig: TranslationModeConfig,
  text: string,
  targetLanguage: string,
  tid: string,
): string {
  return JSON.stringify([
    normalizeEndpoint(apiConfig.baseUrl),
    apiConfig.model.trim(),
    normalizeTargetLanguage(targetLanguage),
    modeConfig.mode,
    modeConfig.prompt,
    modeConfig.parameters.temperature,
    modeConfig.parameters.maxTokens,
    modeConfig.options.preserveFormatting,
    tid,
    text,
  ]);
}

function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function normalizeTargetLanguage(targetLanguage: string): string {
  return targetLanguage.trim().toLowerCase() || 'default';
}
