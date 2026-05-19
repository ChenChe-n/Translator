import type {
  TranslationModeConfig,
  TranslationModeConfigMap,
  TranslationModeKey,
} from '../types/translationMode';

const translationModeKeys: TranslationModeKey[] = ['normal', 'batch', 'context'];
const translationModeStorageKeys: Record<TranslationModeKey, string> = {
  normal: 'Translator.translationMode.normal',
  batch: 'Translator.translationMode.batch',
  context: 'Translator.translationMode.context',
};

/**
 * 创建默认翻译模式配置。
 *
 * @returns 翻译模式配置集合。
 */
export function createDefaultTranslationModeConfigMap(): TranslationModeConfigMap {
  return {
    normal: createModeConfig('normal', 'translator/cache/normal'),
    batch: createModeConfig('batch', 'translator/cache/batch'),
    context: createModeConfig('context', 'translator/cache/context'),
  };
}

/**
 * 读取翻译模式配置。
 *
 * @returns 翻译模式配置集合。
 */
export async function loadTranslationModeConfigMap(): Promise<TranslationModeConfigMap> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewConfigMap();
  }

  const stored = await chrome.storage.local.get(Object.values(translationModeStorageKeys));
  return normalizeConfigMap(readStoredConfigMap(stored));
}

/**
 * 保存翻译模式配置。
 *
 * @param configMap 翻译模式配置集合。
 * @returns 无返回值。
 */
export async function saveTranslationModeConfigMap(configMap: TranslationModeConfigMap): Promise<void> {
  const nextConfigMap = normalizeConfigMap(configMap);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewConfigMap(nextConfigMap);
    return;
  }

  await chrome.storage.local.set(buildStoragePayload(nextConfigMap));
}

function createModeConfig(mode: TranslationModeKey, cachePath: string): TranslationModeConfig {
  return {
    mode,
    cachePath,
    parameters: {
      temperature: 0.3,
      maxTokens: 2048,
    },
    options: {
      preserveFormatting: true,
      enableCache: true,
    },
  };
}

function loadPreviewConfigMap(): TranslationModeConfigMap {
  return normalizeConfigMap(
    translationModeKeys.reduce((result, mode) => {
      const value = localStorage.getItem(translationModeStorageKeys[mode]);

      if (value) {
        result[mode] = JSON.parse(value) as TranslationModeConfig;
      }

      return result;
    }, {} as Partial<TranslationModeConfigMap>),
  );
}

function savePreviewConfigMap(configMap: TranslationModeConfigMap): void {
  translationModeKeys.forEach((mode) => {
    localStorage.setItem(translationModeStorageKeys[mode], JSON.stringify(configMap[mode]));
  });
}

function readStoredConfigMap(stored: Record<string, unknown>): Partial<TranslationModeConfigMap> {
  return translationModeKeys.reduce((result, mode) => {
    result[mode] = stored[translationModeStorageKeys[mode]] as TranslationModeConfig | undefined;
    return result;
  }, {} as Partial<TranslationModeConfigMap>);
}

function buildStoragePayload(configMap: TranslationModeConfigMap): Record<string, TranslationModeConfig> {
  return translationModeKeys.reduce(
    (result, mode) => ({
      ...result,
      [translationModeStorageKeys[mode]]: configMap[mode],
    }),
    {},
  );
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
    parameters: {
      ...defaultConfig.parameters,
      ...config?.parameters,
    },
    options: {
      ...defaultConfig.options,
      ...config?.options,
    },
  };
}
