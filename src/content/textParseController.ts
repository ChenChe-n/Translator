import {
  applyTextMarkers,
  clearTextMarkers,
  clearTranslatingTextMarkers,
} from './textMarker';
import { scanParagraphGroups } from './paragraphTextScanner';
import { scanTextReferences } from './textNodeScanner';
import { loadTextParseRuntimeConfig } from './textParseConfig';
import type { ParsedParagraphGroup, ParsedTextReference, TextParseRuntimeConfig } from './textParseTypes';
import {
  createTextOverwriteState,
  overwriteTextReferences,
  restoreOverwrittenReferences,
} from './textWriter';
import {
  clearTranslationQueue,
  createTranslationTracker,
  queueTranslateParagraphGroups,
  queueTranslateReferences,
} from './translationTaskQueue';
import { appendTextParseMetric } from '../popup/services/textParseMetricsStorage';

const minimumDelayMs = 100;

interface ScanResult {
  paragraphGroups: ParsedParagraphGroup[];
  references: ParsedTextReference[];
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
      clearTranslationQueue();
      clearTranslatingTextMarkers();
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
      const scanResult = scanText(config);
      const nextReferences = scanResult.references;
      references.clear();
      nextReferences.forEach((reference) => references.set(reference.id, reference));

      if (config.activeConfig.options.showTextMarker) {
        applyTextMarkers([...references.values()], config.markerColor);
      } else {
        clearTextMarkers();
      }

      if (config.activeConfig.options.overwriteWithTestText) {
        clearTranslationQueue();
        clearTranslatingTextMarkers();
        restoreOverwrittenReferences(translationOverwriteState);
        translatedReferences = createTranslationTracker();
        overwriteTextReferences([...references.values()], config.activeConfig.options.testText, testOverwriteState);
      } else {
        restoreOverwrittenReferences(testOverwriteState);
        queueScannedTranslations(config, scanResult, translatedReferences, translationOverwriteState);
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
      clearTranslationQueue();
      clearTranslatingTextMarkers();
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

function scanText(config: TextParseRuntimeConfig): ScanResult {
  if (shouldUseParagraphInput(config)) {
    const paragraphGroups = scanParagraphGroups(config);
    return {
      paragraphGroups,
      references: paragraphGroups.flatMap((group) => group.references.map((item) => item.reference)),
    };
  }

  return {
    paragraphGroups: [],
    references: scanTextReferences(config),
  };
}

function queueScannedTranslations(
  config: TextParseRuntimeConfig,
  scanResult: ScanResult,
  translatedReferences: ReturnType<typeof createTranslationTracker>,
  translationOverwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  if (shouldUseParagraphInput(config)) {
    queueTranslateParagraphGroups(scanResult.paragraphGroups, config, translatedReferences, translationOverwriteState);
    return;
  }

  queueTranslateReferences(scanResult.references, config, translatedReferences, translationOverwriteState);
}

function shouldUseParagraphInput(config: TextParseRuntimeConfig): boolean {
  return config.translationMode === 'normal' && config.translationConfig.options.paragraphInput;
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
