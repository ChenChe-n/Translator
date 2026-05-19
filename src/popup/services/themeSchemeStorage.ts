import type { ThemeColors, ThemeScheme, ThemeSchemeState } from '../types/theme';

const THEME_STORAGE_KEY = 'Translator.themeSchemeState';
const SYSTEM_SCHEME_ID = 'system';

export const dayColors: ThemeColors = {
  background: '#f8fafc',
  container: '#ffffff',
  shadow: '#d6dee8',
  text: '#111827',
  muted: '#64748b',
  marker: '#16a34a',
  button: '#ffffff',
  keyButton: '#1f2937',
  border: '#dbe4ef',
};

export const nightColors: ThemeColors = {
  background: '#0f172a',
  container: '#111827',
  shadow: '#020617',
  text: '#e5e7eb',
  muted: '#94a3b8',
  marker: '#38bdf8',
  button: '#1e293b',
  keyButton: '#2563eb',
  border: '#334155',
};

export const sakuraColors: ThemeColors = {
  background: '#fff7fb',
  container: '#ffffff',
  shadow: '#f6c5d8',
  text: '#3f2632',
  muted: '#9b6478',
  marker: '#f472b6',
  button: '#fff0f6',
  keyButton: '#db2777',
  border: '#f8bfd5',
};

export const presetThemeSchemes: ThemeScheme[] = [
  {
    id: SYSTEM_SCHEME_ID,
    name: '系统',
    kind: 'system',
    colors: dayColors,
  },
  {
    id: 'day',
    name: '白天',
    kind: 'preset',
    colors: dayColors,
  },
  {
    id: 'night',
    name: '黑夜',
    kind: 'preset',
    colors: nightColors,
  },
  {
    id: 'sakura',
    name: '樱花',
    kind: 'preset',
    colors: sakuraColors,
  },
];

/**
 * 创建默认配色状态。
 *
 * @returns 配色状态。
 */
export function createDefaultThemeSchemeState(): ThemeSchemeState {
  return {
    activeSchemeId: SYSTEM_SCHEME_ID,
    schemes: presetThemeSchemes,
  };
}

/**
 * 创建自定义配色方案。
 *
 * @param index 方案序号。
 * @returns 自定义配色方案。
 */
export function createThemeScheme(index: number, name = `Scheme ${index}`): ThemeScheme {
  return {
    id: `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    kind: 'custom',
    colors: dayColors,
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

/**
 * 清空配色状态。
 *
 * @returns 默认配色状态。
 */
export async function clearThemeSchemeState(): Promise<ThemeSchemeState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(THEME_STORAGE_KEY);
    return createDefaultThemeSchemeState();
  }

  await chrome.storage.local.remove(THEME_STORAGE_KEY);
  return createDefaultThemeSchemeState();
}

function loadPreviewThemeSchemeState(): ThemeSchemeState {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return normalizeState(value ? (JSON.parse(value) as ThemeSchemeState) : undefined);
}

function normalizeState(state: ThemeSchemeState | undefined): ThemeSchemeState {
  const customSchemes = state?.schemes.filter((item) => item.kind === 'custom') ?? [];
  const schemes = [...presetThemeSchemes, ...customSchemes.map(normalizeCustomScheme)];
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
    name: scheme.name || 'Scheme',
    colors: normalizeColors(scheme.colors),
  };
}

function normalizeColors(colors: Partial<ThemeColors> & { primary?: string; accent?: string }): ThemeColors {
  return {
    ...dayColors,
    ...colors,
    text: colors.text ?? colors.primary ?? dayColors.text,
    marker: colors.marker ?? colors.accent ?? dayColors.marker,
    keyButton: colors.keyButton ?? colors.primary ?? dayColors.keyButton,
  };
}
