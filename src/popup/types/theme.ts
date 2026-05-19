/**
 * 配色方案颜色。
 */
export interface ThemeColors {
  primary: string;
  background: string;
  accent: string;
}

/**
 * 配色方案类型。
 */
export type ThemeSchemeKind = 'system' | 'custom';

/**
 * 配色方案。
 */
export interface ThemeScheme {
  id: string;
  name: string;
  kind: ThemeSchemeKind;
  colors: ThemeColors;
}

/**
 * 配色方案集合。
 */
export interface ThemeSchemeState {
  activeSchemeId: string;
  schemes: ThemeScheme[];
}
