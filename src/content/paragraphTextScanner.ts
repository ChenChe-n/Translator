import type {
  ParsedParagraphGroup,
  ParsedParagraphReference,
  ParsedTextAttributeReference,
  ParsedTextReference,
  TextParseRuntimeConfig,
  TextReferenceOwner,
} from './textParseTypes';
import { scanTextReferences } from './textNodeScanner';

const estimatedJsonlOverhead = 24;
const rectEqualThreshold = 1;

interface ParagraphScanIndex {
  elementRefs: WeakMap<Element, ParsedTextReference[]>;
  elementTokens: WeakMap<Element, number>;
  grouped: GroupedReferenceSet;
  references: ParsedTextReference[];
  visualReferences: ParsedTextReference[];
}

interface GroupedReferenceSet {
  attributes: WeakMap<TextReferenceOwner, Set<string>>;
  textNodes: WeakSet<Text>;
}

interface ParagraphRoot {
  element?: Element;
  overflowElement?: Element;
}

/**
 * 扫描段落上下文翻译组。
 *
 * @param config 文本解析运行配置。
 * @returns 段落上下文翻译组。
 */
export function scanParagraphGroups(config: TextParseRuntimeConfig): ParsedParagraphGroup[] {
  const index = createParagraphScanIndex(scanTextReferences(config));
  const groups: ParsedParagraphGroup[] = [];
  let groupIndex = 0;

  index.visualReferences.forEach((reference) => {
    if (isGrouped(reference, index.grouped)) {
      return;
    }

    const groupReferences = selectParagraphReferences(reference, index, config.translationConfig.parameters.batchMaxTokens);
    markGrouped(groupReferences, index.grouped);
    groups.push({
      id: `paragraph-${Date.now()}-${groupIndex}`,
      references: groupReferences,
    });
    groupIndex += 1;
  });

  return groups;
}

function createParagraphScanIndex(references: ParsedTextReference[]): ParagraphScanIndex {
  const index: ParagraphScanIndex = {
    elementRefs: new WeakMap<Element, ParsedTextReference[]>(),
    elementTokens: new WeakMap<Element, number>(),
    grouped: {
      attributes: new WeakMap<TextReferenceOwner, Set<string>>(),
      textNodes: new WeakSet<Text>(),
    },
    references,
    visualReferences: sortReferencesByVisualOrder(references),
  };

  references.forEach((reference) => addReferenceToAncestors(reference, index));
  return index;
}

function addReferenceToAncestors(reference: ParsedTextReference, index: ParagraphScanIndex): void {
  const tokens = estimateTextTokens(reference.text) + estimatedJsonlOverhead;
  let element: Element | null = reference.owner;

  while (element && element !== document.body.parentElement) {
    readElementRefs(element, index).push(reference);
    index.elementTokens.set(element, (index.elementTokens.get(element) ?? 0) + tokens);
    element = element.parentElement;
  }
}

function readElementRefs(element: Element, index: ParagraphScanIndex): ParsedTextReference[] {
  const references = index.elementRefs.get(element) ?? [];
  index.elementRefs.set(element, references);
  return references;
}

function selectParagraphReferences(
  reference: ParsedTextReference,
  index: ParagraphScanIndex,
  maxTokens: number,
): ParsedParagraphReference[] {
  const root = findParagraphRoot(reference.owner, index, maxTokens);
  const references = root.element ? index.elementRefs.get(root.element) ?? [reference] : [reference];
  const elementReferences = sortReferencesByVisualOrder(
    references.filter((item) => !isGrouped(item, index.grouped)),
  );
  const selectedReferences = elementReferences.length > 1
    ? elementReferences
    : selectOverflowContainerReferences(reference, root.overflowElement, index, maxTokens);

  return selectedReferences.map((item) => ({
    reference: item,
  }));
}

function findParagraphRoot(
  owner: TextReferenceOwner,
  index: ParagraphScanIndex,
  maxTokens: number,
): ParagraphRoot {
  let highest: Element | undefined;
  let element: Element | null = owner;

  while (element && element !== document.body.parentElement) {
    if ((index.elementTokens.get(element) ?? 0) > maxTokens) {
      return {
        element: highest,
        overflowElement: element,
      };
    }

    highest = element;
    element = element.parentElement;
  }

  return { element: highest };
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function selectOverflowContainerReferences(
  reference: ParsedTextReference,
  overflowElement: Element | undefined,
  index: ParagraphScanIndex,
  maxTokens: number,
): ParsedTextReference[] {
  const sourceReferences = overflowElement
    ? sortReferencesByVisualOrder(index.elementRefs.get(overflowElement) ?? [])
    : index.visualReferences;
  const references: ParsedTextReference[] = [];
  let tokens = 0;
  let started = false;

  for (const item of sourceReferences) {
    if (isGrouped(item, index.grouped)) {
      continue;
    }

    started = started || item === reference;

    if (!started) {
      continue;
    }

    const nextTokens = estimateReferenceTokens(item);

    if (references.length > 0 && tokens + nextTokens > maxTokens) {
      break;
    }

    references.push(item);
    tokens += nextTokens;
  }

  return references.length > 0 ? references : [reference];
}

function estimateReferenceTokens(reference: ParsedTextReference): number {
  return estimateTextTokens(reference.text) + estimatedJsonlOverhead;
}

function sortReferencesByVisualOrder(references: ParsedTextReference[]): ParsedTextReference[] {
  return [...references].sort((left, right) => compareReferencePosition(left, right));
}

function compareReferencePosition(left: ParsedTextReference, right: ParsedTextReference): number {
  const leftRect = readReferenceRect(left);
  const rightRect = readReferenceRect(right);

  if (!leftRect || !rightRect) {
    return 0;
  }

  const topDiff = leftRect.top - rightRect.top;

  if (Math.abs(topDiff) > rectEqualThreshold) {
    return topDiff;
  }

  return leftRect.left - rightRect.left;
}

function readReferenceRect(reference: ParsedTextReference): DOMRect | undefined {
  if (reference.kind === 'attribute') {
    return reference.owner.getClientRects()[0];
  }

  const range = document.createRange();

  try {
    range.selectNodeContents(reference.node);
    return Array.from(range.getClientRects())[0] ?? reference.owner.getClientRects()[0];
  } finally {
    range.detach();
  }
}

function isGrouped(reference: ParsedTextReference, grouped: GroupedReferenceSet): boolean {
  return reference.kind === 'text'
    ? grouped.textNodes.has(reference.node)
    : grouped.attributes.get(reference.owner)?.has(reference.attributeName) ?? false;
}

function markGrouped(items: ParsedParagraphReference[], grouped: GroupedReferenceSet): void {
  items.forEach(({ reference }) => {
    if (reference.kind === 'text') {
      grouped.textNodes.add(reference.node);
      return;
    }

    markGroupedAttribute(reference, grouped);
  });
}

function markGroupedAttribute(reference: ParsedTextAttributeReference, grouped: GroupedReferenceSet): void {
  const attributes = grouped.attributes.get(reference.owner) ?? new Set<string>();
  attributes.add(reference.attributeName);
  grouped.attributes.set(reference.owner, attributes);
}
