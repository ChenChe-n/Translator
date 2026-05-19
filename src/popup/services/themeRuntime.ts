import type { ThemeColors, ThemeScheme } from '../types/theme';

const lightSystemColors: ThemeColors = {
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

const darkSystemColors: ThemeColors = {
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
  const nextColors = normalizeThemeColors(colors);
  root.style.setProperty('--translator-background', nextColors.background);
  root.style.setProperty('--translator-container', nextColors.container);
  root.style.setProperty('--translator-shadow', nextColors.shadow);
  root.style.setProperty('--translator-text', nextColors.text);
  root.style.setProperty('--translator-muted', nextColors.muted);
  root.style.setProperty('--translator-marker', nextColors.marker);
  root.style.setProperty('--translator-button', nextColors.button);
  root.style.setProperty('--translator-key-button', nextColors.keyButton);
  root.style.setProperty('--translator-border', nextColors.border);
  createModelColors(nextColors.marker).forEach((color, index) => {
    root.style.setProperty(`--translator-model-${index}`, color);
  });
}

function normalizeThemeColors(colors: ThemeColors): ThemeColors {
  return {
    background: toHexColor(colors.background),
    container: toHexColor(colors.container),
    shadow: toHexColor(colors.shadow),
    text: toHexColor(colors.text),
    muted: toHexColor(colors.muted),
    marker: toHexColor(colors.marker),
    button: toHexColor(colors.button),
    keyButton: toHexColor(colors.keyButton),
    border: toHexColor(colors.border),
  };
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
  const accent = getBrowserAccentColor();

  return {
    ...colors,
    background: readSystemColor('Canvas') ?? colors.background,
    text: readSystemColor('CanvasText') ?? colors.text,
    marker: accent ?? colors.marker,
    keyButton: accent ?? colors.keyButton,
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
  return color && color !== 'auto' ? toHexColor(color) : undefined;
}

function createModelColors(baseColor: string): string[] {
  const hue = extractHue(baseColor);
  return Array.from({ length: 8 }, (_, index) => `hsl(${(hue + index * 43) % 360} 70% 48%)`);
}

function toHexColor(color: string): string {
  const normalized = color.trim();
  const hexColor = normalizeHexColor(normalized);

  if (hexColor) {
    return hexColor;
  }

  const rgbParts = parseRgbColorParts(normalized);

  if (!rgbParts) {
    return normalized;
  }

  const [red, green, blue] = rgbParts;
  return `#${toHexPart(red)}${toHexPart(green)}${toHexPart(blue)}`;
}

function toHexPart(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

function extractHue(color: string): number {
  const hexColor = normalizeHexColor(color);
  const numbers = hexColor ? parseHexColorParts(hexColor) : parseRgbColorParts(color.trim());

  if (!numbers || numbers.length < 3) {
    return 210;
  }

  const [red, green, blue] = numbers.map((value) => value / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const diff = max - min;

  if (diff === 0) {
    return 210;
  }

  const hue =
    max === red
      ? (60 * ((green - blue) / diff) + 360) % 360
      : max === green
        ? 60 * ((blue - red) / diff) + 120
        : 60 * ((red - green) / diff) + 240;

  return Math.round(hue);
}

function normalizeHexColor(color: string): string | undefined {
  const shortHex = color.match(/^#([\da-f])([\da-f])([\da-f])$/i);

  if (shortHex) {
    const [, red, green, blue] = shortHex;
    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }

  return /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : undefined;
}

function parseHexColorParts(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function parseRgbColorParts(color: string): [number, number, number] | undefined {
  if (!/^rgba?\(/i.test(color)) {
    return undefined;
  }

  const parts = color.match(/[\d.]+%?/g)?.slice(0, 3).map(parseCssColorChannel);

  if (!parts || parts.length < 3) {
    return undefined;
  }

  return [parts[0], parts[1], parts[2]];
}

function parseCssColorChannel(value: string): number {
  if (value.endsWith('%')) {
    return Math.round((Number(value.slice(0, -1)) / 100) * 255);
  }

  return Math.round(Number(value));
}
