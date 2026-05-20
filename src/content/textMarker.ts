import type { ParsedTextReference, TextReferenceOwner } from './textParseTypes';

interface MarkedElementState {
  previousColor: string;
}

interface TranslatingElementState extends MarkedElementState {
  count: number;
}

const markedElements = new Map<TextReferenceOwner, MarkedElementState>();
const translatingElements = new Map<TextReferenceOwner, TranslatingElementState>();

/**
 * 清理文本标记。
 *
 * @returns 无返回值。
 */
export function clearTextMarkers(): void {
  restoreMarkedElements(markedElements);
}

/**
 * 标记正在翻译的文本引用。
 *
 * @param reference 文本引用。
 * @param color 标记色。
 * @returns 无返回值。
 */
export function markTranslatingText(reference: ParsedTextReference, color: string): void {
  if (!isReferenceConnected(reference)) {
    return;
  }

  const state = translatingElements.get(reference.owner);

  if (state) {
    state.count += 1;
    return;
  }

  translatingElements.set(reference.owner, {
    count: 1,
    previousColor: reference.owner.style.color,
  });
  reference.owner.style.color = color;
}

/**
 * 取消正在翻译的文本引用标记。
 *
 * @param reference 文本引用。
 * @returns 无返回值。
 */
export function unmarkTranslatingText(reference: ParsedTextReference): void {
  const state = translatingElements.get(reference.owner);

  if (!state) {
    return;
  }

  state.count -= 1;

  if (state.count > 0) {
    return;
  }

  if (reference.owner.isConnected) {
    reference.owner.style.color = state.previousColor;
  }

  translatingElements.delete(reference.owner);
}

/**
 * 清理正在翻译的文本标记。
 *
 * @returns 无返回值。
 */
export function clearTranslatingTextMarkers(): void {
  restoreMarkedElements(translatingElements);
}

function restoreMarkedElements(elements: Map<TextReferenceOwner, MarkedElementState | TranslatingElementState>): void {
  elements.forEach((state, element) => {
    if (element.isConnected) {
      element.style.color = state.previousColor;
    }
  });
  elements.clear();
}

/**
 * 应用文本标记色。
 *
 * @param references 文本引用集合。
 * @param color 标记色。
 * @returns 无返回值。
 */
export function applyTextMarkers(references: ParsedTextReference[], color: string): void {
  clearTextMarkers();

  references.forEach((reference) => {
    if (!isReferenceConnected(reference)) {
      return;
    }

    if (!markedElements.has(reference.owner)) {
      markedElements.set(reference.owner, {
        previousColor: reference.owner.style.color,
      });
    }

    reference.owner.style.color = color;
  });
}

function isReferenceConnected(reference: ParsedTextReference): boolean {
  if (!reference.owner.isConnected) {
    return false;
  }

  return reference.kind === 'attribute' || reference.node.isConnected;
}
