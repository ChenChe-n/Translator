import type { TextParseModeConfig, TextParseModeConfigMap, TextParseModeKey } from '../popup/types/textParseMode';
import type { RuntimeSettings } from '../popup/types/runtimeSettings';
import type { ApiConfig } from '../popup/types/api';
import type { TranslationModeConfig, TranslationModeKey } from '../popup/types/translationMode';

/**
 * 可标记文本宿主元素。
 */
export type TextReferenceOwner = HTMLElement | SVGElement;

/**
 * 已解析文本引用。
 */
export type ParsedTextReference = ParsedTextNodeReference | ParsedTextAttributeReference;

/**
 * 段落上下文文本引用。
 */
export interface ParsedParagraphReference {
  reference: ParsedTextReference;
}

/**
 * 段落上下文翻译组。
 */
export interface ParsedParagraphGroup {
  id: string;
  references: ParsedParagraphReference[];
}

/**
 * 已解析文本节点引用。
 */
export interface ParsedTextNodeReference {
  id: string;
  kind: 'text';
  node: Text;
  owner: TextReferenceOwner;
  text: string;
}

/**
 * 已解析文本属性引用。
 */
export interface ParsedTextAttributeReference {
  id: string;
  kind: 'attribute';
  attributeName: string;
  owner: TextReferenceOwner;
  text: string;
}

/**
 * 文本解析运行状态。
 */
export interface TextParseRuntimeConfig {
  activeMode: TextParseModeKey;
  activeConfig: TextParseModeConfig;
  configMap: TextParseModeConfigMap;
  markerColor: string;
  runtimeSettings: RuntimeSettings;
  translationMode: TranslationModeKey;
  translationConfig: TranslationModeConfig;
  apiConfig: ApiConfig;
  targetLanguage: string;
}
