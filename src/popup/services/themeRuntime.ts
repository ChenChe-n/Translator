import type { ThemeColors, ThemeScheme } from '../types/theme';

const lightSystemColors: ThemeColors = {
  primary: '#1f2937',
  background: '#f8fafc',
  accent: '#3b82f6',
};

const darkSystemColors: ThemeColors = {
  primary: '#e5e7eb',
  background: '#0f172a',
  accent: '#60a5fa',
};

/**
 * 解析方案实际颜色。
 *
 * @param scheme 配色方案。
 * @returns 实际颜色。
 */
export function resolveThemeColors(scheme: ThemeScheme): ThemeColors {
  if (scheme.kind !== 'system') {
    return scheme.colors;
  }

  return getSystemThemeColors();
}

/**
 * 应用配色变量。
 *
 * @param colors 配色。
 * @returns 无返回值。
 */
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  root.style.setProperty('--translator-primary', colors.primary);
  root.style.setProperty('--translator-bg', colors.background);
  root.style.setProperty('--translator-accent', colors.accent);
  root.style.setProperty('--translator-surface', getSurfaceColor(colors.background));
}

/**
 * 监听系统明暗变化。
 *
 * @param callback 回调。
 * @returns 取消监听函数。
 */
export function watchSystemTheme(callback: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function getSystemThemeColors(): ThemeColors {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colors = dark ? darkSystemColors : lightSystemColors;

  return {
    primary: readSystemColor('CanvasText') ?? colors.primary,
    background: readSystemColor('Canvas') ?? colors.background,
    accent: getBrowserAccentColor() ?? colors.accent,
  };
}

function getBrowserAccentColor(): string | undefined {
  return getMetaThemeColor() ?? readSystemColor('AccentColor') ?? readChromiumAccentColor();
}

function getMetaThemeColor(): string | undefined {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  return normalizeColor(meta?.content);
}

function readChromiumAccentColor(): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue('accent-color');
  return normalizeColor(value);
}

function readSystemColor(name: string): string | undefined {
  const probe = document.createElement('span');
  probe.style.color = name;
  probe.style.display = 'none';
  document.body.append(probe);
  const color = normalizeColor(getComputedStyle(probe).color);
  probe.remove();
  return color;
}

function normalizeColor(value: string | undefined): string | undefined {
  const color = value?.trim();
  return color && color !== 'auto' ? color : undefined;
}

function getSurfaceColor(background: string): string {
  return isDarkColor(background) ? '#111827' : '#ffffff';
}

function isDarkColor(color: string): boolean {
  const numbers = color.match(/\d+/g)?.map(Number);

  if (!numbers || numbers.length < 3) {
    return color.toLowerCase() === '#0f172a';
  }

  const [red, green, blue] = numbers;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}
