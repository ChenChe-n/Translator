import {
  loadActiveTextParseMode,
  loadTextParseModeConfigMap,
} from '../popup/services/textParseModeStorage';
import { loadApiConfig } from '../popup/services/apiConfigStorage';
import { loadLocale } from '../i18n/localeStorage';
import { loadRuntimeSettings } from '../popup/services/runtimeSettingsStorage';
import { loadTranslationModeConfigMap } from '../popup/services/translationModeStorage';
import { dayColors, loadThemeSchemeState } from '../popup/services/themeSchemeStorage';
import type { TextParseRuntimeConfig } from './textParseTypes';

/**
 * 读取内容脚本文本解析运行配置。
 *
 * @returns 文本解析运行配置。
 */
export async function loadTextParseRuntimeConfig(): Promise<TextParseRuntimeConfig> {
  const [configMap, activeMode, themeState, runtimeSettings, translationConfigMap, apiConfig, targetLanguage] = await Promise.all([
    loadTextParseModeConfigMap(),
    loadActiveTextParseMode(),
    loadThemeSchemeState(),
    loadRuntimeSettings(),
    loadTranslationModeConfigMap(),
    loadApiConfig(),
    loadLocale(),
  ]);
  const activeScheme = themeState.schemes.find((item) => item.id === themeState.activeSchemeId);

  return {
    activeMode,
    activeConfig: configMap[activeMode],
    configMap,
    markerColor: activeScheme?.colors.marker ?? dayColors.marker,
    runtimeSettings,
    translationConfig: translationConfigMap.normal,
    apiConfig,
    targetLanguage,
  };
}
