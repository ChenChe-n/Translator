import { applyTextMarkers, clearTextMarkers } from './textMarker';
import { scanTextReferences } from './textNodeScanner';
import { loadTextParseRuntimeConfig } from './textParseConfig';
import type { ParsedTextReference, TextParseRuntimeConfig, TextReferenceOwner } from './textParseTypes';
import { appendTextParseMetric } from '../popup/services/textParseMetricsStorage';

const minimumDelayMs = 100;

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
 * 创建文本解析控制器。
 *
 * @returns 文本解析控制器。
 */
export function createTextParseController(): { start: () => void } {
  const references = new Map<string, ParsedTextReference>();
  const overwriteState: TextOverwriteState = {
    attributes: new WeakMap<TextReferenceOwner, Map<string, OverwrittenAttributeState>>(),
    attributeOwners: new Set<TextReferenceOwner>(),
    textNodes: new WeakMap<Text, OverwrittenTextNodeState>(),
    textNodeRefs: new Set<Text>(),
  };
  let config: TextParseRuntimeConfig | undefined;
  let scanTimer: number | undefined;
  let scanning = false;

  const observer = new MutationObserver(() => scheduleScan());

  async function start(): Promise<void> {
    try {
      config = await loadTextParseRuntimeConfig();
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      window.addEventListener('scroll', scheduleScan, { passive: true, capture: true });
      window.addEventListener('resize', scheduleScan, { passive: true });
      chrome.storage.onChanged.addListener(handleStorageChanged);
      scheduleScan();
    } catch {
      clearTextMarkers();
    }
  }

  function scheduleScan(): void {
    if (!config) {
      return;
    }

    if (!config.runtimeSettings.parseEnabled) {
      window.clearTimeout(scanTimer);
      clearTextMarkers();
      restoreOverwrittenReferences(overwriteState);
      return;
    }

    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => void scan(), Math.max(config.activeConfig.autoParseDelayMs, minimumDelayMs));
  }

  async function scan(): Promise<void> {
    if (!config || scanning || !config.runtimeSettings.parseEnabled) {
      return;
    }

    scanning = true;

    try {
      const startedAt = performance.now();
      references.clear();
      scanTextReferences(config).forEach((reference) => references.set(reference.id, reference));

      if (config.activeConfig.options.showTextMarker) {
        applyTextMarkers([...references.values()], config.markerColor);
      } else {
        clearTextMarkers();
      }

      if (config.activeConfig.options.overwriteWithTestText) {
        overwriteTextReferences([...references.values()], config.activeConfig.options.testText, overwriteState);
      } else {
        restoreOverwrittenReferences(overwriteState);
      }

      await appendTextParseMetric({
        id: `parse-${Date.now()}`,
        mode: config.activeMode,
        durationMs: performance.now() - startedAt,
        textCount: references.size,
        createdAt: Date.now(),
      });
    } finally {
      scanning = false;
    }
  }

  async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
    if (areaName !== 'local' || !shouldReloadConfig(changes)) {
      return;
    }

    config = await loadTextParseRuntimeConfig();

    if (config.runtimeSettings.updateScope === 'foreground' && document.visibilityState !== 'visible') {
      clearTextMarkers();
      return;
    }

    scheduleScan();
  }

  return {
    start: () => {
      void start();
    },
  };
}

function overwriteTextReferences(references: ParsedTextReference[], text: string, state: TextOverwriteState): void {
  references.forEach((reference) => {
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
  });
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

function restoreOverwrittenReferences(state: TextOverwriteState): void {
  state.textNodeRefs.forEach((node) => restoreTextNode(node, state));
  state.attributeOwners.forEach((owner) => restoreOwnerAttributes(owner, state));
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

function shouldReloadConfig(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return Object.keys(changes).some(
    (key) =>
      key.startsWith('Translator.textParseMode.') ||
      key === 'Translator.themeSchemeState' ||
      key === 'Translator.runtimeSettings',
  );
}
