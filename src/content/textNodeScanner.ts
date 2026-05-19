import type { ParsedTextReference, TextParseRuntimeConfig, TextReferenceOwner } from './textParseTypes';

const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
const textAttributeNames = ['title', 'aria-label', 'aria-description', 'alt', 'placeholder'];

/**
 * 扫描当前页面文本节点。
 *
 * @param config 文本解析运行配置。
 * @returns 文本引用集合。
 */
export function scanTextReferences(config: TextParseRuntimeConfig): ParsedTextReference[] {
  const references: ParsedTextReference[] = [];
  const scanId = Date.now();
  let textIndex = 0;
  let attributeIndex = 0;

  scanRoot(document.body, (node) => {
    const owner = getReferenceOwner(node.parentElement);
    const text = node.nodeValue?.trim();

    if (!owner || !text || !isScannableTextNode(node, owner, config)) {
      return;
    }

    references.push({
      id: `text-${scanId}-${textIndex}`,
      kind: 'text',
      node,
      owner,
      text,
    });
    textIndex += 1;
  });

  scanTextAttributes(document.body, config, (owner, attributeName, text) => {
    references.push({
      id: `attribute-${scanId}-${attributeIndex}`,
      kind: 'attribute',
      attributeName,
      owner,
      text,
    });
    attributeIndex += 1;
  });

  return references;
}

function scanRoot(root: ParentNode | undefined, callback: (node: Text) => void): void {
  if (!root) {
    return;
  }

  walkTextNodes(root, callback);
  getElements(root).forEach((element) => {
    if (element.shadowRoot) {
      scanRoot(element.shadowRoot, callback);
    }
  });
}

function walkTextNodes(root: Node | undefined, callback: (node: Text) => void): void {
  if (!root) {
    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });

  while (walker.nextNode()) {
    callback(walker.currentNode as Text);
  }
}

function shouldSkipNode(node: Node): boolean {
  const element = node.parentElement;
  return !element || ignoredTags.has(element.tagName);
}

function isScannableTextNode(node: Text, owner: TextReferenceOwner, config: TextParseRuntimeConfig): boolean {
  return node.isConnected && isElementVisible(owner) && isModeMatched(node, config);
}

function scanTextAttributes(
  root: ParentNode | undefined,
  config: TextParseRuntimeConfig,
  callback: (owner: TextReferenceOwner, attributeName: string, text: string) => void,
): void {
  if (!root) {
    return;
  }

  getElements(root).forEach((element) => {
    const owner = getReferenceOwner(element);

    if (!owner || !isElementVisible(owner) || (config.activeMode === 'visible' && !isElementInViewport(owner))) {
      return;
    }

    textAttributeNames.forEach((attributeName) => {
      const text = owner.getAttribute(attributeName)?.trim();

      if (text) {
        callback(owner, attributeName, text);
      }
    });

    if (owner.shadowRoot) {
      scanTextAttributes(owner.shadowRoot, config, callback);
    }
  });
}

function getElements(root: ParentNode): Element[] {
  const elements = Array.from(root.querySelectorAll('*'));
  return root instanceof Element ? [root, ...elements] : elements;
}

function getReferenceOwner(element: Element | null): TextReferenceOwner | undefined {
  if (element instanceof HTMLElement || element instanceof SVGElement) {
    return element;
  }

  return undefined;
}

function isElementVisible(element: TextReferenceOwner): boolean {
  const style = getComputedStyle(element);

  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }

  return element.getClientRects().length > 0;
}

function isModeMatched(node: Text, config: TextParseRuntimeConfig): boolean {
  if (config.activeMode === 'visible') {
    return isTextInViewport(node);
  }

  return true;
}

function isTextInViewport(node: Text): boolean {
  const range = document.createRange();

  try {
    range.selectNodeContents(node);
    return Array.from(range.getClientRects()).some(isRectInViewport);
  } finally {
    range.detach();
  }
}

function isRectInViewport(rect: DOMRect): boolean {
  return rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
}

function isElementInViewport(element: TextReferenceOwner): boolean {
  return Array.from(element.getClientRects()).some(isRectInViewport);
}
