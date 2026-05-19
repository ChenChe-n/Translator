interface ConfigMapStorageOptions<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>> {
  modes: readonly TMode[];
  storageKeys: Record<TMode, string>;
  normalizeConfigMap: (configMap: Partial<TConfigMap> | undefined) => TConfigMap;
}

/**
 * 读取按模式拆分存储的配置集合。
 *
 * @param options 配置存储选项。
 * @returns 标准化后的配置集合。
 */
export async function loadConfigMapFromStorage<
  TMode extends string,
  TConfig,
  TConfigMap extends Record<TMode, TConfig>,
>(options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>): Promise<TConfigMap> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewConfigMap(options);
  }

  const stored = await chrome.storage.local.get(getStorageKeyList(options));
  return options.normalizeConfigMap(readStoredConfigMap(options, stored));
}

/**
 * 保存按模式拆分存储的配置集合。
 *
 * @param options 配置存储选项。
 * @param configMap 配置集合。
 * @returns 无返回值。
 */
export async function saveConfigMapToStorage<
  TMode extends string,
  TConfig,
  TConfigMap extends Record<TMode, TConfig>,
>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
  configMap: TConfigMap,
): Promise<void> {
  const nextConfigMap = options.normalizeConfigMap(configMap);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    savePreviewConfigMap(options, nextConfigMap);
    return;
  }

  await chrome.storage.local.set(buildStoragePayload(options, nextConfigMap));
}

/**
 * 清空按模式拆分存储的配置集合。
 *
 * @param options 配置存储选项。
 * @returns 无返回值。
 */
export async function clearConfigMapStorage<
  TMode extends string,
  TConfig,
  TConfigMap extends Record<TMode, TConfig>,
>(options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>): Promise<void> {
  const keys = getStorageKeyList(options);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    keys.forEach((key) => localStorage.removeItem(key));
    return;
  }

  await chrome.storage.local.remove(keys);
}

function loadPreviewConfigMap<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
): TConfigMap {
  const configMap = {} as Partial<TConfigMap>;

  options.modes.forEach((mode) => {
    const value = localStorage.getItem(options.storageKeys[mode]);
    const parsed = parsePreviewValue<TConfigMap[TMode]>(value);

    if (parsed) {
      configMap[mode] = parsed;
    }
  });

  return options.normalizeConfigMap(configMap);
}

function savePreviewConfigMap<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
  configMap: TConfigMap,
): void {
  options.modes.forEach((mode) => {
    localStorage.setItem(options.storageKeys[mode], JSON.stringify(configMap[mode]));
  });
}

function readStoredConfigMap<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
  stored: Record<string, unknown>,
): Partial<TConfigMap> {
  const configMap = {} as Partial<TConfigMap>;

  options.modes.forEach((mode) => {
    configMap[mode] = stored[options.storageKeys[mode]] as TConfigMap[TMode] | undefined;
  });

  return configMap;
}

function buildStoragePayload<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
  configMap: TConfigMap,
): Record<string, TConfig> {
  return options.modes.reduce((result, mode) => {
    result[options.storageKeys[mode]] = configMap[mode];
    return result;
  }, {} as Record<string, TConfig>);
}

function getStorageKeyList<TMode extends string, TConfig, TConfigMap extends Record<TMode, TConfig>>(
  options: ConfigMapStorageOptions<TMode, TConfig, TConfigMap>,
): string[] {
  return options.modes.map((mode) => options.storageKeys[mode]);
}

function parsePreviewValue<TValue>(value: string | null): TValue | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as TValue;
  } catch {
    return undefined;
  }
}
