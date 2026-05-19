/**
 * 文本解析模式标识。
 */
export type TextParseModeKey = 'visible' | 'full' | 'structured';

/**
 * 结构化解析保留选项。
 */
export interface TextParseModeOptions {
  preserveId: boolean;
  preserveClass: boolean;
  preserveStyle: boolean;
  preserveUrl: boolean;
  showTextMarker: boolean;
}

/**
 * 单个文本解析模式配置。
 */
export interface TextParseModeConfig {
  mode: TextParseModeKey;
  autoParseDelayMs: number;
  options: TextParseModeOptions;
}

/**
 * 文本解析模式配置集合。
 */
export type TextParseModeConfigMap = Record<TextParseModeKey, TextParseModeConfig>;
