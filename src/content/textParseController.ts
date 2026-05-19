import { applyTextMarkers, clearTextMarkers } from './textMarker';
import { scanTextReferences } from './textNodeScanner';
import { loadTextParseRuntimeConfig } from './textParseConfig';
import type { ParsedTextReference, TextParseRuntimeConfig, TextReferenceOwner } from './textParseTypes';
import {
  createTextOverwriteState,
  overwriteTextReferences,
  restoreOverwrittenReferences,
  writeTextReference,
} from './textWriter';
import { appendTextParseMetric } from '../popup/services/textParseMetricsStorage';
import { translateNormalMode } from '../popup/services/normalTranslationService';

const minimumDelayMs = 100;

interface TranslationTracker {
  attributes: WeakMap<TextReferenceOwner, Set<string>>;
  textNodes: WeakSet<Text>;
}

/**
 * 创建文本解析控制器。
 *
 * @returns 文本解析控制器。
 */
export function createTextParseController(): { start: () => void } {
  const references = new Map<string, ParsedTextReference>();
  const testOverwriteState = createTextOverwriteState();
  const translationOverwriteState = createTextOverwriteState();
  let translatedReferences = createTranslationTracker();
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
      restoreOverwrittenReferences(testOverwriteState);
      restoreOverwrittenReferences(translationOverwriteState);
      translatedReferences = createTranslationTracker();
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
        restoreOverwrittenReferences(translationOverwriteState);
        translatedReferences = createTranslationTracker();
        overwriteTextReferences([...references.values()], config.activeConfig.options.testText, testOverwriteState);
      } else {
        restoreOverwrittenReferences(testOverwriteState);
        translateReferences([...references.values()], config, translatedReferences, translationOverwriteState);
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

    if (shouldResetTranslations(changes)) {
      restoreOverwrittenReferences(translationOverwriteState);
      translatedReferences = createTranslationTracker();
    }

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

function shouldReloadConfig(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return Object.keys(changes).some(
    (key) =>
      key.startsWith('Translator.textParseMode.') ||
      key.startsWith('Translator.translationMode.') ||
      key === 'Translator.themeSchemeState' ||
      key === 'Translator.apiConfigState' ||
      key === 'Translator.locale' ||
      key === 'Translator.runtimeSettings',
  );
}

function shouldResetTranslations(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return Object.keys(changes).some(
    (key) =>
      key.startsWith('Translator.textParseMode.') ||
      key.startsWith('Translator.translationMode.') ||
      key === 'Translator.apiConfigState' ||
      key === 'Translator.locale' ||
      key === 'Translator.runtimeSettings',
  );
}

function translateReferences(
  items: ParsedTextReference[],
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  if (!runtimeConfig.runtimeSettings.translationEnabled || !isApiConfigReady(runtimeConfig)) {
    restoreOverwrittenReferences(overwriteState);
    return;
  }

  items.forEach((reference) => {
    if (hasTranslated(reference, translatedReferences)) {
      return;
    }

    markTranslated(reference, translatedReferences);
    void translateAndWrite(reference, runtimeConfig, translatedReferences, overwriteState);
  });
}

async function translateAndWrite(
  reference: ParsedTextReference,
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): Promise<void> {
  try {
    const result = await translateNormalMode(
      runtimeConfig.apiConfig,
      runtimeConfig.translationConfig,
      { text: reference.text },
      runtimeConfig.targetLanguage,
    );

    if (result.text && isReferenceConnected(reference)) {
      writeTextReference(reference, result.text, overwriteState);
    }
  } catch {
    unmarkTranslated(reference, translatedReferences);
  }
}

function isReferenceConnected(reference: ParsedTextReference): boolean {
  return reference.owner.isConnected && (reference.kind === 'attribute' || reference.node.isConnected);
}

function isApiConfigReady(runtimeConfig: TextParseRuntimeConfig): boolean {
  return Boolean(runtimeConfig.apiConfig.baseUrl && runtimeConfig.apiConfig.apiKey && runtimeConfig.apiConfig.model);
}

function createTranslationTracker(): TranslationTracker {
  return {
    attributes: new WeakMap<TextReferenceOwner, Set<string>>(),
    textNodes: new WeakSet<Text>(),
  };
}

function hasTranslated(reference: ParsedTextReference, tracker: TranslationTracker): boolean {
  if (reference.kind === 'text') {
    return tracker.textNodes.has(reference.node);
  }

  return tracker.attributes.get(reference.owner)?.has(reference.attributeName) ?? false;
}

function markTranslated(reference: ParsedTextReference, tracker: TranslationTracker): void {
  if (reference.kind === 'text') {
    tracker.textNodes.add(reference.node);
    return;
  }

  const attributes = tracker.attributes.get(reference.owner) ?? new Set<string>();
  attributes.add(reference.attributeName);
  tracker.attributes.set(reference.owner, attributes);
}

function unmarkTranslated(reference: ParsedTextReference, tracker: TranslationTracker): void {
  if (reference.kind === 'text') {
    tracker.textNodes.delete(reference.node);
    return;
  }

  tracker.attributes.get(reference.owner)?.delete(reference.attributeName);
}
