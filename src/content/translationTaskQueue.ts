import {
  markTranslatingText,
  unmarkTranslatingText,
} from './textMarker';
import type { ParsedTextReference, TextParseRuntimeConfig, TextReferenceOwner } from './textParseTypes';
import {
  createTextOverwriteState,
  restoreOverwrittenReferences,
  writeTextReference,
} from './textWriter';
import { translateNormalMode } from '../popup/services/normalTranslationService';

const dispatchChunkSize = 512;
let queueRunning = false;
let queueGeneration = 0;

/**
 * 已提交翻译的文本引用记录。
 */
export interface TranslationTracker {
  attributes: WeakMap<TextReferenceOwner, Set<string>>;
  textNodes: WeakSet<Text>;
}

interface TranslationTask {
  generation: number;
  overwriteState: ReturnType<typeof createTextOverwriteState>;
  reference: ParsedTextReference;
  runtimeConfig: TextParseRuntimeConfig;
  translatedReferences: TranslationTracker;
}

const translationQueue: TranslationTask[] = [];

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
 * 清空待调度的翻译队列。
 *
 * @returns 无返回值。
 */
export function clearTranslationQueue(): void {
  translationQueue.length = 0;
  queueGeneration += 1;
}

/**
 * 将文本引用加入普通翻译调度队列。
 *
 * @param items 文本引用列表。
 * @param runtimeConfig 文本解析运行配置。
 * @param translatedReferences 已提交翻译的引用追踪器。
 * @param overwriteState 翻译写入状态。
 * @returns 无返回值。
 */
export function queueTranslateReferences(
  items: ParsedTextReference[],
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  if (!runtimeConfig.runtimeSettings.translationEnabled || !isApiConfigReady(runtimeConfig)) {
    restoreOverwrittenReferences(overwriteState);
    return;
  }

  items.forEach((reference) => queueReference(reference, runtimeConfig, translatedReferences, overwriteState));
  runTranslationQueue();
}

function queueReference(
  reference: ParsedTextReference,
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  if (hasTranslated(reference, translatedReferences) || !isReferenceWritable(reference)) {
    return;
  }

  markTranslated(reference, translatedReferences);
  translationQueue.push({
    generation: queueGeneration,
    reference,
    runtimeConfig,
    translatedReferences,
    overwriteState,
  });
}

function runTranslationQueue(): void {
  if (queueRunning) {
    return;
  }

  queueRunning = true;
  void drainTranslationQueue();
}

async function drainTranslationQueue(): Promise<void> {
  try {
    while (translationQueue.length > 0) {
      translationQueue.splice(0, dispatchChunkSize).forEach((task) => {
        void translateAndWrite(task);
      });

      if (translationQueue.length > 0) {
        await waitForIdleSlice();
      }
    }
  } finally {
    queueRunning = false;

    if (translationQueue.length > 0) {
      runTranslationQueue();
    }
  }
}

function waitForIdleSlice(): Promise<void> {
  return new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => resolve(), { timeout: 50 });
      return;
    }

    window.setTimeout(resolve, 0);
  });
}

async function translateAndWrite(task: TranslationTask): Promise<void> {
  const { reference, runtimeConfig, translatedReferences, overwriteState } = task;

  if (runtimeConfig.translationConfig.options.showTranslatingMarker) {
    markTranslatingText(reference, runtimeConfig.markerColor);
  }

  try {
    if (runtimeConfig.translationMode !== 'normal') {
      return;
    }

    const result = await translateNormalMode(
      runtimeConfig.apiConfig,
      runtimeConfig.translationConfig,
      { text: reference.text },
      runtimeConfig.targetLanguage,
    );

    if (result.text && task.generation === queueGeneration && isReferenceWritable(reference)) {
      writeTextReference(reference, result.text, overwriteState);
    }
  } catch {
    unmarkTranslated(reference, translatedReferences);
  } finally {
    unmarkTranslatingText(reference);
  }
}

function isReferenceWritable(reference: ParsedTextReference): boolean {
  return isReferenceConnected(reference) && readCurrentReferenceText(reference) === reference.text;
}

function isReferenceConnected(reference: ParsedTextReference): boolean {
  return reference.owner.isConnected && (reference.kind === 'attribute' || reference.node.isConnected);
}

function readCurrentReferenceText(reference: ParsedTextReference): string {
  if (reference.kind === 'text') {
    return reference.node.nodeValue?.trim() ?? '';
  }

  return reference.owner.getAttribute(reference.attributeName)?.trim() ?? '';
}

function isApiConfigReady(runtimeConfig: TextParseRuntimeConfig): boolean {
  return Boolean(runtimeConfig.apiConfig.baseUrl && runtimeConfig.apiConfig.apiKey && runtimeConfig.apiConfig.model);
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
