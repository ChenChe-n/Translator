import {
  markTranslatingText,
  unmarkTranslatingText,
} from './textMarker';
import { translateParagraphGroupAndWrite } from './paragraphTranslationWriter';
import {
  createTranslationTracker,
  hasTranslated,
  markTranslated,
  unmarkTranslated,
  type TranslationTracker,
} from './translationReferenceState';
import { isApiConfigReady, isReferenceWritable } from './translationReferenceUtils';
import type {
  ParsedParagraphGroup,
  ParsedTextReference,
  TextParseRuntimeConfig,
} from './textParseTypes';
import {
  createTextOverwriteState,
  restoreOverwrittenReferences,
  writeTextReference,
} from './textWriter';
import { translateNormalMode } from '../popup/services/normalTranslationService';

const dispatchChunkSize = 512;
let queueRunning = false;
let queueGeneration = 0;

interface TranslationTask {
  generation: number;
  overwriteState: ReturnType<typeof createTextOverwriteState>;
  group?: ParsedParagraphGroup;
  reference?: ParsedTextReference;
  runtimeConfig: TextParseRuntimeConfig;
  translatedReferences: TranslationTracker;
}

const translationQueue: TranslationTask[] = [];

export { createTranslationTracker };

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

/**
 * 将段落上下文组加入普通翻译调度队列。
 *
 * @param groups 段落上下文组。
 * @param runtimeConfig 文本解析运行配置。
 * @param translatedReferences 已提交翻译的引用追踪器。
 * @param overwriteState 翻译写入状态。
 * @returns 无返回值。
 */
export function queueTranslateParagraphGroups(
  groups: ParsedParagraphGroup[],
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  if (!runtimeConfig.runtimeSettings.translationEnabled || !isApiConfigReady(runtimeConfig)) {
    restoreOverwrittenReferences(overwriteState);
    return;
  }

  groups.forEach((group) => queueParagraphGroup(group, runtimeConfig, translatedReferences, overwriteState));
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

function queueParagraphGroup(
  group: ParsedParagraphGroup,
  runtimeConfig: TextParseRuntimeConfig,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): void {
  const references = group.references
    .map((item) => item.reference)
    .filter((reference) => !hasTranslated(reference, translatedReferences) && isReferenceWritable(reference));

  if (references.length === 0) {
    return;
  }

  references.forEach((reference) => markTranslated(reference, translatedReferences));
  translationQueue.push({
    generation: queueGeneration,
    group: {
      ...group,
      references: group.references.filter((item) => references.includes(item.reference)),
    },
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
  if (task.group) {
    await translateParagraphGroupAndWrite(
      task.group,
      task.runtimeConfig,
      task.generation,
      () => queueGeneration,
      task.translatedReferences,
      task.overwriteState,
    );
    return;
  }

  const { reference, runtimeConfig, translatedReferences, overwriteState } = task;

  if (!reference) {
    return;
  }

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
