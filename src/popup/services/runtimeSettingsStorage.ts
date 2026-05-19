import type { RuntimeSettings, SettingsUpdateScope } from '../types/runtimeSettings';

export const RUNTIME_SETTINGS_KEY = 'Translator.runtimeSettings';

/**
 * 创建默认运行配置。
 *
 * @returns 运行配置。
 */
export function createDefaultRuntimeSettings(): RuntimeSettings {
  return {
    enabled: true,
    updateScope: 'foreground',
  };
}

/**
 * 读取运行配置。
 *
 * @returns 运行配置。
 */
export async function loadRuntimeSettings(): Promise<RuntimeSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    const value = localStorage.getItem(RUNTIME_SETTINGS_KEY);
    return normalizeSettings(value ? (JSON.parse(value) as Partial<RuntimeSettings>) : undefined);
  }

  const stored = await chrome.storage.local.get(RUNTIME_SETTINGS_KEY);
  return normalizeSettings(stored[RUNTIME_SETTINGS_KEY] as Partial<RuntimeSettings> | undefined);
}

/**
 * 保存运行配置。
 *
 * @param settings 运行配置。
 * @returns 无返回值。
 */
export async function saveRuntimeSettings(settings: RuntimeSettings): Promise<void> {
  const nextSettings = normalizeSettings(settings);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(RUNTIME_SETTINGS_KEY, JSON.stringify(nextSettings));
    return;
  }

  await chrome.storage.local.set({
    [RUNTIME_SETTINGS_KEY]: nextSettings,
  });
}

function normalizeSettings(settings: Partial<RuntimeSettings> | undefined): RuntimeSettings {
  const defaultSettings = createDefaultRuntimeSettings();

  return {
    enabled: settings?.enabled ?? defaultSettings.enabled,
    updateScope: normalizeUpdateScope(settings?.updateScope),
  };
}

function normalizeUpdateScope(value: SettingsUpdateScope | undefined): SettingsUpdateScope {
  return value === 'all' ? 'all' : 'foreground';
}
