import type { ParsedTextReference, TextParseRuntimeConfig } from './textParseTypes';

/**
 * 判断文本引用当前是否可写。
 *
 * @param reference 文本引用。
 * @returns 是否可写。
 */
export function isReferenceWritable(reference: ParsedTextReference): boolean {
  return isReferenceConnected(reference) && readCurrentReferenceText(reference) === reference.text;
}

/**
 * 判断文本引用是否仍连接在页面中。
 *
 * @param reference 文本引用。
 * @returns 是否连接。
 */
export function isReferenceConnected(reference: ParsedTextReference): boolean {
  return reference.owner.isConnected && (reference.kind === 'attribute' || reference.node.isConnected);
}

/**
 * 判断 API 配置是否可用于翻译。
 *
 * @param runtimeConfig 文本解析运行配置。
 * @returns 是否可用。
 */
export function isApiConfigReady(runtimeConfig: TextParseRuntimeConfig): boolean {
  return Boolean(runtimeConfig.apiConfig.baseUrl && runtimeConfig.apiConfig.apiKey && runtimeConfig.apiConfig.model);
}

function readCurrentReferenceText(reference: ParsedTextReference): string {
  if (reference.kind === 'text') {
    return reference.node.nodeValue?.trim() ?? '';
  }

  return reference.owner.getAttribute(reference.attributeName)?.trim() ?? '';
}
