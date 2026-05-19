import type { ParsedTextReference, TextReferenceOwner } from './textParseTypes';

interface MarkedElementState {
  previousColor: string;
}

const markedElements = new Map<TextReferenceOwner, MarkedElementState>();

/**
 * 清理文本标记。
 *
 * @returns 无返回值。
 */
export function clearTextMarkers(): void {
  markedElements.forEach((state, element) => {
    if (element.isConnected) {
      element.style.color = state.previousColor;
    }
  });
  markedElements.clear();
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
