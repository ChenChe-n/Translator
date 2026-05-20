/**
 * 校验翻译批次是否返回所有必需结果。
 *
 * @param results 已解析结果。
 * @param idSet 必需翻译 ID 集合。
 * @returns 无返回值。
 */
export function ensureCompleteTranslationResults(
  results: Map<string, string | null>,
  idSet: Set<string>,
): void {
  const missingIds = [...idSet].filter((tid) => !results.has(tid));

  if (missingIds.length === 0) {
    return;
  }

  throw new Error('api.errors.incompleteTranslationResult');
}

/**
 * 校验流式响应是否包含可用文本。
 *
 * @param streamOutput 流式输出文本。
 * @returns 无返回值。
 */
export function ensureNonEmptyStreamOutput(streamOutput: string): void {
  if (streamOutput.trim()) {
    return;
  }

  throw new Error('api.errors.emptyStreamOutput');
}
