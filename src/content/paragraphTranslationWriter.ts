import {
  markTranslatingText,
  unmarkTranslatingText,
} from './textMarker';
import type { TranslationTracker } from './translationReferenceState';
import { unmarkTranslated } from './translationReferenceState';
import { isReferenceWritable } from './translationReferenceUtils';
import type { ParsedParagraphGroup, TextParseRuntimeConfig } from './textParseTypes';
import { createTextOverwriteState, writeTextReference } from './textWriter';
import { translateNormalParagraphMode } from '../popup/services/normalParagraphTranslationService';

/**
 * 翻译并写入段落上下文组。
 *
 * @param group 段落上下文组。
 * @param runtimeConfig 文本解析运行配置。
 * @param generation 队列代际。
 * @param currentGeneration 读取当前队列代际。
 * @param translatedReferences 已提交翻译的引用追踪器。
 * @param overwriteState 翻译写入状态。
 * @returns 无返回值。
 */
export async function translateParagraphGroupAndWrite(
  group: ParsedParagraphGroup,
  runtimeConfig: TextParseRuntimeConfig,
  generation: number,
  currentGeneration: () => number,
  translatedReferences: TranslationTracker,
  overwriteState: ReturnType<typeof createTextOverwriteState>,
): Promise<void> {
  if (runtimeConfig.translationMode !== 'normal') {
    return;
  }

  markGroupTranslating(group, runtimeConfig);

  try {
    const results = await translateNormalParagraphMode(
      runtimeConfig.apiConfig,
      runtimeConfig.translationConfig,
      group.references.map((item) => ({
        text: item.reference.text,
      })),
      runtimeConfig.targetLanguage,
    );

    results.forEach((result, index) => {
      const reference = group.references[index]?.reference;

      if (reference && result.text && generation === currentGeneration() && isReferenceWritable(reference)) {
        writeTextReference(reference, result.text, overwriteState);
      }
    });
  } catch {
    group.references.forEach((item) => unmarkTranslated(item.reference, translatedReferences));
  } finally {
    unmarkGroupTranslating(group);
  }
}

function markGroupTranslating(group: ParsedParagraphGroup, runtimeConfig: TextParseRuntimeConfig): void {
  if (!runtimeConfig.translationConfig.options.showTranslatingMarker) {
    return;
  }

  group.references.forEach((item) => markTranslatingText(item.reference, runtimeConfig.markerColor));
}

function unmarkGroupTranslating(group: ParsedParagraphGroup): void {
  group.references.forEach((item) => unmarkTranslatingText(item.reference));
}
