import type { ParsedTextReference, TextReferenceOwner } from './textParseTypes';

interface OverwrittenTextNodeState {
  lastText: string;
  originalText: string;
}

interface OverwrittenAttributeState {
  attributeName: string;
  hadAttribute: boolean;
  lastText: string;
  originalText: string;
}

interface TextOverwriteState {
  attributes: WeakMap<TextReferenceOwner, Map<string, OverwrittenAttributeState>>;
  attributeOwners: Set<TextReferenceOwner>;
  textNodes: WeakMap<Text, OverwrittenTextNodeState>;
  textNodeRefs: Set<Text>;
}

/**
 * 创建文本写入状态。
 *
 * @returns 文本写入状态。
 */
export function createTextOverwriteState(): TextOverwriteState {
  return {
    attributes: new WeakMap<TextReferenceOwner, Map<string, OverwrittenAttributeState>>(),
    attributeOwners: new Set<TextReferenceOwner>(),
    textNodes: new WeakMap<Text, OverwrittenTextNodeState>(),
    textNodeRefs: new Set<Text>(),
  };
}

/**
 * 覆盖文本引用内容。
 *
 * @param references 文本引用集合。
 * @param text 覆盖文本。
 * @param state 文本写入状态。
 * @returns 无返回值。
 */
export function overwriteTextReferences(
  references: ParsedTextReference[],
  text: string,
  state: TextOverwriteState,
): void {
  references.forEach((reference) => writeTextReference(reference, text, state));
}

/**
 * 写入单个文本引用内容。
 *
 * @param reference 文本引用。
 * @param text 写入文本。
 * @param state 文本写入状态。
 * @returns 无返回值。
 */
export function writeTextReference(
  reference: ParsedTextReference,
  text: string,
  state: TextOverwriteState,
): void {
  if (!reference.owner.isConnected) {
    return;
  }

  if (reference.kind === 'text' && reference.node.isConnected) {
    overwriteTextNode(reference.node, text, state);
    return;
  }

  if (reference.kind === 'attribute') {
    overwriteAttribute(reference.owner, reference.attributeName, text, state);
  }
}

/**
 * 恢复被覆盖的文本引用。
 *
 * @param state 文本写入状态。
 * @returns 无返回值。
 */
export function restoreOverwrittenReferences(state: TextOverwriteState): void {
  state.textNodeRefs.forEach((node) => restoreTextNode(node, state));
  state.attributeOwners.forEach((owner) => restoreOwnerAttributes(owner, state));
}

function overwriteTextNode(node: Text, text: string, overwriteState: TextOverwriteState): void {
  const state = overwriteState.textNodes.get(node);
  const currentText = node.nodeValue ?? '';

  if (!state) {
    overwriteState.textNodes.set(node, {
      originalText: currentText,
      lastText: text,
    });
    overwriteState.textNodeRefs.add(node);
  } else {
    if (currentText !== state.lastText) {
      state.originalText = currentText;
    }

    state.lastText = text;
  }

  if (currentText !== text) {
    node.nodeValue = text;
  }
}

function overwriteAttribute(
  owner: TextReferenceOwner,
  attributeName: string,
  text: string,
  overwriteState: TextOverwriteState,
): void {
  const stateMap = getAttributeStateMap(owner, overwriteState);
  const attributeState = stateMap.get(attributeName);
  const hadAttribute = owner.hasAttribute(attributeName);
  const currentText = owner.getAttribute(attributeName) ?? '';

  if (!attributeState) {
    stateMap.set(attributeName, {
      attributeName,
      hadAttribute,
      originalText: currentText,
      lastText: text,
    });
  } else {
    if (currentText !== attributeState.lastText) {
      attributeState.hadAttribute = hadAttribute;
      attributeState.originalText = currentText;
    }

    attributeState.lastText = text;
  }

  if (currentText !== text) {
    owner.setAttribute(attributeName, text);
  }
}

function getAttributeStateMap(
  owner: TextReferenceOwner,
  state: TextOverwriteState,
): Map<string, OverwrittenAttributeState> {
  const stateMap = state.attributes.get(owner) ?? new Map<string, OverwrittenAttributeState>();
  state.attributes.set(owner, stateMap);
  state.attributeOwners.add(owner);
  return stateMap;
}

function restoreTextNode(node: Text, overwriteState: TextOverwriteState): void {
  const state = overwriteState.textNodes.get(node);

  if (!state || !node.isConnected) {
    overwriteState.textNodes.delete(node);
    overwriteState.textNodeRefs.delete(node);
    return;
  }

  if (node.nodeValue !== state.lastText) {
    overwriteState.textNodes.delete(node);
    overwriteState.textNodeRefs.delete(node);
    return;
  }

  node.nodeValue = state.originalText;
  overwriteState.textNodes.delete(node);
  overwriteState.textNodeRefs.delete(node);
}

function restoreOwnerAttributes(owner: TextReferenceOwner, state: TextOverwriteState): void {
  const stateMap = state.attributes.get(owner);

  if (!stateMap || !owner.isConnected) {
    state.attributes.delete(owner);
    state.attributeOwners.delete(owner);
    return;
  }

  stateMap.forEach((item) => restoreAttribute(owner, item.attributeName, state));

  if (stateMap.size === 0) {
    state.attributes.delete(owner);
    state.attributeOwners.delete(owner);
  }
}

function restoreAttribute(owner: TextReferenceOwner, attributeName: string, overwriteState: TextOverwriteState): void {
  const stateMap = overwriteState.attributes.get(owner);
  const attributeState = stateMap?.get(attributeName);

  if (!attributeState) {
    return;
  }

  if (owner.getAttribute(attributeName) !== attributeState.lastText) {
    stateMap?.delete(attributeName);
    return;
  }

  if (attributeState.hadAttribute) {
    owner.setAttribute(attributeName, attributeState.originalText);
  } else {
    owner.removeAttribute(attributeName);
  }

  stateMap?.delete(attributeName);
}
