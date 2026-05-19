import {
  loadActiveTextParseMode,
  loadTextParseModeConfigMap,
} from '../popup/services/textParseModeStorage';
import { dayColors, loadThemeSchemeState } from '../popup/services/themeSchemeStorage';
import type { TextParseRuntimeConfig } from './textParseTypes';

/**
 * 读取内容脚本文本解析运行配置。
 *
 * @returns 文本解析运行配置。
 */
export async function loadTextParseRuntimeConfig(): Promise<TextParseRuntimeConfig> {
  const [configMap, activeMode, themeState] = await Promise.all([
    loadTextParseModeConfigMap(),
    loadActiveTextParseMode(),
    loadThemeSchemeState(),
  ]);
  const activeScheme = themeState.schemes.find((item) => item.id === themeState.activeSchemeId);

  return {
    activeMode,
    activeConfig: configMap[activeMode],
    configMap,
    markerColor: activeScheme?.colors.marker ?? dayColors.marker,
  };
}
