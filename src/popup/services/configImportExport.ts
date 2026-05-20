import { LOCALE_STORAGE_KEY, loadLocale, saveLocale } from '../../i18n/localeStorage';
import type { LocaleCode } from '../../i18n';
import { CONFIG_STATE_STORAGE_KEY, loadApiConfigState, saveApiConfigState } from './apiConfigStorage';
import { RUNTIME_SETTINGS_KEY, loadRuntimeSettings, saveRuntimeSettings } from './runtimeSettingsStorage';
import { ACTIVE_TEXT_PARSE_MODE_KEY, loadActiveTextParseMode, loadTextParseModeConfigMap, saveActiveTextParseMode, saveTextParseModeConfigMap, TEXT_PARSE_MODE_STORAGE_KEYS } from './textParseModeStorage';
import { THEME_STORAGE_KEY, loadThemeSchemeState, saveThemeSchemeState } from './themeSchemeStorage';
import { TRANSLATION_MODE_STORAGE_KEYS, loadTranslationModeConfigMap, saveTranslationModeConfigMap } from './translationModeStorage';
import type { ApiConfigState } from '../types/api';
import type { RuntimeSettings } from '../types/runtimeSettings';
import type { TextParseModeConfigMap, TextParseModeKey } from '../types/textParseMode';
import type { ThemeSchemeState } from '../types/theme';
import type { TranslationModeConfigMap } from '../types/translationMode';

export interface ExportedConfigPackage {
  apiConfigState: ApiConfigState;
  exportedAt: string;
  locale: LocaleCode;
  runtimeSettings: RuntimeSettings;
  schemaVersion: 1;
  textParseMode: {
    activeMode: TextParseModeKey;
    configMap: TextParseModeConfigMap;
  };
  themeSchemeState: ThemeSchemeState;
  translationModeConfigMap: TranslationModeConfigMap;
}

/**
 * 导出当前插件配置。
 *
 * @returns JSON 配置文本。
 */
export async function exportConfigJson(): Promise<string> {
  const [locale, themeSchemeState, runtimeSettings, translationModeConfigMap, textParseModeConfigMap, activeTextParseMode, apiConfigState] = await Promise.all([
    loadLocale(),
    loadThemeSchemeState(),
    loadRuntimeSettings(),
    loadTranslationModeConfigMap(),
    loadTextParseModeConfigMap(),
    loadActiveTextParseMode(),
    loadApiConfigState(),
  ]);

  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    locale,
    themeSchemeState,
    runtimeSettings,
    translationModeConfigMap,
    textParseMode: {
      activeMode: activeTextParseMode,
      configMap: textParseModeConfigMap,
    },
    apiConfigState,
  } satisfies ExportedConfigPackage, null, 2);
}

/**
 * 导入插件配置。
 *
 * @param json 配置 JSON 文本。
 * @returns 标准化后的配置包。
 */
export async function importConfigJson(json: string): Promise<ExportedConfigPackage> {
  const configPackage = parseConfigPackage(json);

  await Promise.all([
    saveLocale(configPackage.locale),
    saveThemeSchemeState(configPackage.themeSchemeState),
    saveRuntimeSettings(configPackage.runtimeSettings),
    saveTranslationModeConfigMap(configPackage.translationModeConfigMap),
    saveTextParseModeConfigMap(configPackage.textParseMode.configMap),
    saveActiveTextParseMode(configPackage.textParseMode.activeMode),
    saveApiConfigState(configPackage.apiConfigState),
  ]);

  return loadConfigPackage();
}

async function loadConfigPackage(): Promise<ExportedConfigPackage> {
  const json = await exportConfigJson();
  return JSON.parse(json) as ExportedConfigPackage;
}

function parseConfigPackage(json: string): ExportedConfigPackage {
  try {
    return normalizeConfigPackage(JSON.parse(json) as Partial<ExportedConfigPackage>);
  } catch {
    throw new Error('configImport.errors.invalidJson');
  }
}

function normalizeConfigPackage(input: Partial<ExportedConfigPackage>): ExportedConfigPackage {
  if (!input || typeof input !== 'object') {
    throw new Error('configImport.errors.invalidJson');
  }

  const locale = input.locale;
  const activeMode = input.textParseMode?.activeMode;

  if (locale !== 'zh-hans' && locale !== 'en-us') {
    throw new Error('configImport.errors.invalidJson');
  }

  if (activeMode !== 'visible' && activeMode !== 'full' && activeMode !== 'structured') {
    throw new Error('configImport.errors.invalidJson');
  }

  return {
    schemaVersion: 1,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
    locale,
    themeSchemeState: requireObject(input.themeSchemeState, THEME_STORAGE_KEY),
    runtimeSettings: requireObject(input.runtimeSettings, RUNTIME_SETTINGS_KEY),
    translationModeConfigMap: requireObject(input.translationModeConfigMap, TRANSLATION_MODE_STORAGE_KEYS.normal),
    textParseMode: {
      activeMode,
      configMap: requireObject(input.textParseMode?.configMap, TEXT_PARSE_MODE_STORAGE_KEYS.visible),
    },
    apiConfigState: requireObject(input.apiConfigState, CONFIG_STATE_STORAGE_KEY),
  };
}

function requireObject<T>(value: T | undefined, fieldName: string): T {
  if (!value || typeof value !== 'object') {
    throw new Error(`configImport.errors.missing:${fieldName}`);
  }

  return value;
}

/**
 * 读取配置导入导出的存储键。
 *
 * @returns 配置存储键列表。
 */
export function getConfigStorageKeys(): string[] {
  return [
    LOCALE_STORAGE_KEY,
    THEME_STORAGE_KEY,
    RUNTIME_SETTINGS_KEY,
    ...Object.values(TRANSLATION_MODE_STORAGE_KEYS),
    ACTIVE_TEXT_PARSE_MODE_KEY,
    ...Object.values(TEXT_PARSE_MODE_STORAGE_KEYS),
    CONFIG_STATE_STORAGE_KEY,
  ];
}
