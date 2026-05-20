import type { ParsedTextReference, TextReferenceOwner } from './textParseTypes';

/**
 * 已提交翻译的文本引用记录。
 */
export interface TranslationTracker {
  attributes: WeakMap<TextReferenceOwner, Set<string>>;
  textNodes: WeakSet<Text>;
}

/**
 * 创建翻译引用追踪器。
 *
 * @returns 翻译引用追踪器。
 */
export function createTranslationTracker(): TranslationTracker {
  return {
    attributes: new WeakMap<TextReferenceOwner, Set<string>>(),
    textNodes: new WeakSet<Text>(),
  };
}

/**
 * 判断文本引用是否已提交翻译。
 *
 * @param reference 文本引用。
 * @param tracker 翻译引用追踪器。
 * @returns 是否已提交。
 */
export function hasTranslated(reference: ParsedTextReference, tracker: TranslationTracker): boolean {
  if (reference.kind === 'text') {
    return tracker.textNodes.has(reference.node);
  }

  return tracker.attributes.get(reference.owner)?.has(reference.attributeName) ?? false;
}

/**
 * 标记文本引用已提交翻译。
 *
 * @param reference 文本引用。
 * @param tracker 翻译引用追踪器。
 * @returns 无返回值。
 */
export function markTranslated(reference: ParsedTextReference, tracker: TranslationTracker): void {
  if (reference.kind === 'text') {
    tracker.textNodes.add(reference.node);
    return;
  }

  const attributes = tracker.attributes.get(reference.owner) ?? new Set<string>();
  attributes.add(reference.attributeName);
  tracker.attributes.set(reference.owner, attributes);
}

/**
 * 取消文本引用翻译标记。
 *
 * @param reference 文本引用。
 * @param tracker 翻译引用追踪器。
 * @returns 无返回值。
 */
export function unmarkTranslated(reference: ParsedTextReference, tracker: TranslationTracker): void {
  if (reference.kind === 'text') {
    tracker.textNodes.delete(reference.node);
    return;
  }

  tracker.attributes.get(reference.owner)?.delete(reference.attributeName);
}
