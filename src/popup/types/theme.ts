/**
 * 配色方案颜色。
 */
export interface ThemeColors {
  background: string;
  container: string;
  shadow: string;
  text: string;
  muted: string;
  marker: string;
  button: string;
  keyButton: string;
  border: string;
}

/**
 * 配色方案类型。
 */
export type ThemeSchemeKind = 'system' | 'preset' | 'custom';

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
