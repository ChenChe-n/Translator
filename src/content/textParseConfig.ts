import {
  loadActiveTextParseMode,
  loadTextParseModeConfigMap,
} from '../popup/services/textParseModeStorage';
import { loadTestedApiConfig } from '../popup/services/apiConfigStorage';
import { loadLocale } from '../i18n/localeStorage';
import { loadRuntimeSettings } from '../popup/services/runtimeSettingsStorage';
import { loadActiveTranslationMode, loadTranslationModeConfigMap } from '../popup/services/translationModeStorage';
import { dayColors, loadThemeSchemeState } from '../popup/services/themeSchemeStorage';
import type { TextParseRuntimeConfig } from './textParseTypes';

/**
 * 读取内容脚本文本解析运行配置。
 *
 * @returns 文本解析运行配置。
 */
export async function loadTextParseRuntimeConfig(): Promise<TextParseRuntimeConfig> {
  const [
    configMap,
    activeMode,
    themeState,
    runtimeSettings,
    translationConfigMap,
    activeTranslationMode,
    apiConfig,
    targetLanguage,
  ] = await Promise.all([
    loadTextParseModeConfigMap(),
    loadActiveTextParseMode(),
    loadThemeSchemeState(),
    loadRuntimeSettings(),
    loadTranslationModeConfigMap(),
    loadActiveTranslationMode(),
    loadTestedApiConfig(),
    loadLocale(),
  ]);
  const activeScheme = themeState.schemes.find((item) => item.id === themeState.activeSchemeId);

  return {
    activeMode,
    activeConfig: configMap[activeMode],
    configMap,
    markerColor: activeScheme?.colors.marker ?? dayColors.marker,
    runtimeSettings,
    translationMode: activeTranslationMode,
    translationConfig: translationConfigMap[activeTranslationMode],
    apiConfig,
    targetLanguage,
  };
}
