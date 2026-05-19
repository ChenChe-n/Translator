import type { ThemeColors, ThemeScheme, ThemeSchemeState } from '../types/theme';

const THEME_STORAGE_KEY = 'Translator.themeSchemeState';
const SYSTEM_SCHEME_ID = 'system';

const defaultSystemColors: ThemeColors = {
  primary: '#1f2937',
  background: '#f8fafc',
  accent: '#3b82f6',
};

const defaultCustomColors: ThemeColors = {
  primary: '#1f2937',
  background: '#ffffff',
  accent: '#409eff',
};

/**
 * 系统配色方案。
 */
export const systemThemeScheme: ThemeScheme = {
  id: SYSTEM_SCHEME_ID,
  name: '系统',
  kind: 'system',
  colors: defaultSystemColors,
};

/**
 * 创建默认配色状态。
 *
 * @returns 配色状态。
 */
export function createDefaultThemeSchemeState(): ThemeSchemeState {
  return {
    activeSchemeId: SYSTEM_SCHEME_ID,
    schemes: [systemThemeScheme],
  };
}

/**
 * 创建自定义配色方案。
 *
 * @param index 方案序号。
 * @returns 自定义配色方案。
 */
export function createThemeScheme(index: number): ThemeScheme {
  return {
    id: `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `方案${index}`,
    kind: 'custom',
    colors: defaultCustomColors,
  };
}

/**
 * 读取配色状态。
 *
 * @returns 配色状态。
 */
export async function loadThemeSchemeState(): Promise<ThemeSchemeState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return loadPreviewThemeSchemeState();
  }

  const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
  return normalizeState(stored[THEME_STORAGE_KEY] as ThemeSchemeState | undefined);
}

/**
 * 保存配色状态。
 *
 * @param state 配色状态。
 * @returns 无返回值。
 */
export async function saveThemeSchemeState(state: ThemeSchemeState): Promise<void> {
  const nextState = normalizeState(state);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(nextState));
    return;
  }

  await chrome.storage.local.set({
    [THEME_STORAGE_KEY]: nextState,
  });
}

function loadPreviewThemeSchemeState(): ThemeSchemeState {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return normalizeState(value ? (JSON.parse(value) as ThemeSchemeState) : undefined);
}

function normalizeState(state: ThemeSchemeState | undefined): ThemeSchemeState {
  const customSchemes = state?.schemes.filter((item) => item.kind !== 'system') ?? [];
  const schemes = [systemThemeScheme, ...customSchemes.map(normalizeCustomScheme)];
  const activeSchemeId = schemes.some((item) => item.id === state?.activeSchemeId)
    ? String(state?.activeSchemeId)
    : SYSTEM_SCHEME_ID;

  return {
    activeSchemeId,
    schemes,
  };
}

function normalizeCustomScheme(scheme: ThemeScheme): ThemeScheme {
  return {
    ...scheme,
    kind: 'custom',
    name: scheme.name || '方案',
    colors: {
      ...defaultCustomColors,
      ...scheme.colors,
    },
  };
}
