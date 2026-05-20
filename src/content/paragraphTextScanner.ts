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

interface ParagraphScanIndex {
  elementRefs: WeakMap<Element, ParsedTextReference[]>;
  elementTokens: WeakMap<Element, number>;
  grouped: GroupedReferenceSet;
  references: ParsedTextReference[];
}

interface GroupedReferenceSet {
  attributes: WeakMap<TextReferenceOwner, Set<string>>;
  textNodes: WeakSet<Text>;
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

  index.references.forEach((reference) => {
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
  const element = findHighestFittingElement(reference.owner, index, maxTokens);
  const references = element ? index.elementRefs.get(element) ?? [reference] : [reference];
  return normalizeDepth(
    references
      .filter((item) => !isGrouped(item, index.grouped))
      .map((item) => ({
        depth: element ? readReferenceDepth(item, element) : 0,
        reference: item,
      })),
  );
}

function findHighestFittingElement(
  owner: TextReferenceOwner,
  index: ParagraphScanIndex,
  maxTokens: number,
): Element | undefined {
  let highest: Element | undefined;
  let element: Element | null = owner;

  while (element && element !== document.body.parentElement) {
    if ((index.elementTokens.get(element) ?? 0) > maxTokens) {
      break;
    }

    highest = element;
    element = element.parentElement;
  }

  return highest;
}

function readReferenceDepth(reference: ParsedTextReference, root: Element): number {
  let depth = 0;
  let element: Element | null = reference.owner;

  while (element && element !== root) {
    depth += 1;
    element = element.parentElement;
  }

  return depth;
}

function normalizeDepth(items: ParsedParagraphReference[]): ParsedParagraphReference[] {
  const minDepth = Math.min(...items.map((item) => item.depth));
  return items.map((item) => ({
    ...item,
    depth: item.depth - minDepth,
  }));
}

function estimateTextTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
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
