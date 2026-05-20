const nullTextLiterals = new Set(['null']);
const skipTranslationMarkers = new Set([
  '不翻译',
  '无需翻译',
  '无须翻译',
  '不用翻译',
  '不需要翻译',
  '不需翻译',
  '无需译文',
  '跳过',
  '跳过翻译',
  '保持原文',
  '原文不变',
  'donottranslate',
  'notranslation',
  'notranslationneeded',
  'nottranslated',
  'noneedtotranslate',
  'translationnotneeded',
  'skip',
  'skiptranslation',
]);

/**
 * 标准化模型返回的原始译文值。
 *
 * @param value 原始译文。
 * @returns 标准化后的译文。
 */
export function normalizeTranslationTextLiteral(value: string): string | null {
  const literal = normalizeLiteral(value);

  if (!literal || nullTextLiterals.has(literal.toLowerCase())) {
    return null;
  }

  return value;
}

/**
 * 根据原文和目标语言识别模型误返回的跳过翻译文案。
 *
 * @param text 模型返回译文。
 * @param sourceText 原文。
 * @param targetLanguage 目标语言。
 * @returns 标准化后的译文。
 */
export function normalizeNoTranslationResult(
  text: string | null,
  sourceText: string,
  targetLanguage: string,
): string | null {
  if (text === null) {
    return null;
  }

  const literalResult = normalizeTranslationTextLiteral(text);

  if (literalResult === null) {
    return null;
  }

  return shouldTreatSkipMarkerAsNull(sourceText, targetLanguage, literalResult)
    ? null
    : literalResult;
}

function shouldTreatSkipMarkerAsNull(sourceText: string, targetLanguage: string, text: string): boolean {
  return (sourceAlreadyLooksTargetLanguage(sourceText, targetLanguage) || sourceLooksUntranslatable(sourceText))
    && skipTranslationMarkers.has(normalizeSkipMarker(text));
}

function sourceAlreadyLooksTargetLanguage(sourceText: string, targetLanguage: string): boolean {
  return isChineseTarget(targetLanguage) && /[\u3400-\u9fff\uf900-\ufaff]/u.test(sourceText);
}

function isChineseTarget(targetLanguage: string): boolean {
  const language = targetLanguage.trim().toLowerCase();
  return language.startsWith('zh') || language.includes('chinese') || language.includes('中文');
}

function sourceLooksUntranslatable(sourceText: string): boolean {
  return !/[\p{Letter}\p{Number}]/u.test(sourceText) || /^[\p{Number}\s.,!?，。！？:：;；()[\]{}"'`“”‘’+\-*/\\|_=<>#$%^&~@]+$/u.test(sourceText);
}

function normalizeLiteral(value: string): string {
  return value.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

function normalizeSkipMarker(value: string): string {
  return normalizeLiteral(value)
    .toLowerCase()
    .replace(/[\s.,!?，。！？:：;；()[\]{}"'`“”‘’]/g, '');
}
