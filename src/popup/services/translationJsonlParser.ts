/**
 * 解析聊天响应中的 JSONL 翻译结果。
 *
 * @param data 聊天响应数据。
 * @param idSet 有效输入 ID。
 * @returns 翻译结果。
 */
export function parseChatJsonlResults(data: unknown, idSet: Set<string>): Map<string, string | null> {
  const results = new Map<string, string | null>();
  parseCompleteTranslationResults(readChatContent(data), idSet, (tid, value) => results.set(tid, value));
  return results;
}

/**
 * 解析 JSONL 文本片段。
 *
 * @param content 文本片段。
 * @param idSet 有效输入 ID。
 * @param onResult 结果回调。
 * @returns 尚未完整成行的剩余文本。
 */
export function parseJsonlLines(
  content: string,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
): string {
  const lines = content.split('\n');
  const rest = lines.pop() ?? '';

  lines.forEach((line) => parseJsonlLine(line, idSet, onResult));
  return rest;
}

/**
 * 解析模型返回的翻译结果。
 *
 * @param content 模型文本内容。
 * @param idSet 有效输入 ID。
 * @param onResult 结果回调。
 * @returns 尚未完整成行的剩余文本。
 */
export function parseTranslationResults(
  content: string,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
): string {
  const rest = parseJsonlLines(content, idSet, onResult);

  if (!content.includes('\n') && tryParseJsonLikeContent(content, idSet, onResult)) {
    return '';
  }

  return rest;
}

/**
 * 解析完整模型翻译结果。
 *
 * @param content 模型文本内容。
 * @param idSet 有效输入 ID。
 * @param onResult 结果回调。
 * @returns 无返回值。
 */
export function parseCompleteTranslationResults(
  content: string,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
): void {
  parseJsonlLines(`${content}\n`, idSet, onResult);
  tryParseJsonLikeContent(content, idSet, onResult);
}

/**
 * 读取 SSE 内容片段。
 *
 * @param buffer SSE 缓冲。
 * @returns 模型文本内容与剩余缓冲。
 */
export function readSseContent(buffer: string): { content: string; rest: string } {
  const chunks = buffer.split('\n\n');
  const rest = chunks.pop() ?? '';
  const content = chunks.map(readSseChunkContent).join('');

  return {
    content,
    rest,
  };
}

function parseJsonlLine(line: string, idSet: Set<string>, onResult: (tid: string, text: string | null) => void): void {
  const text = normalizeJsonlLine(line);

  if (!text || text === '[DONE]') {
    return;
  }

  const parsed = parseJsonValue(text);

  if (parsed) {
    collectTranslationValues(parsed, idSet, onResult);
  }
}

function tryParseJsonLikeContent(
  content: string,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
): boolean {
  const parsed = parseJsonValue(content);

  if (!parsed) {
    return false;
  }

  return collectTranslationValues(parsed, idSet, onResult) > 0;
}

function parseJsonValue(content: string): unknown {
  const candidates = createJsonCandidates(content);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 继续尝试下一个候选片段。
    }
  }

  return undefined;
}

function createJsonCandidates(content: string): string[] {
  const text = stripCodeFence(content.trim());
  const objectText = sliceBetween(text, '{', '}');
  const arrayText = sliceBetween(text, '[', ']');
  return [text, objectText, arrayText].filter((item): item is string => Boolean(item));
}

function stripCodeFence(content: string): string {
  return content
    .replace(/^```(?:jsonl|json)?/i, '')
    .replace(/```$/g, '')
    .trim();
}

function sliceBetween(content: string, start: string, end: string): string | undefined {
  const startIndex = content.indexOf(start);
  const endIndex = content.lastIndexOf(end);

  if (startIndex < 0 || endIndex <= startIndex) {
    return undefined;
  }

  return content.slice(startIndex, endIndex + 1);
}

function collectTranslationValues(
  value: unknown,
  idSet: Set<string>,
  onResult: (tid: string, text: string | null) => void,
): number {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + collectTranslationValues(item, idSet, onResult), 0);
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  const objectValue = value as Record<string, unknown>;
  const structuredResult = readStructuredTranslationResult(objectValue, idSet);

  if (structuredResult) {
    onResult(structuredResult.tid, structuredResult.text);
    return 1;
  }

  return Object.entries(objectValue).reduce((count, [key, item]) => {
    if (idSet.has(key)) {
      onResult(key, normalizeTranslationValue(item));
      return count + 1;
    }

    return count + collectTranslationValues(item, idSet, onResult);
  }, 0);
}

function readStructuredTranslationResult(
  value: Record<string, unknown>,
  idSet: Set<string>,
): { tid: string; text: string | null } | undefined {
  const tid = [value.tid, value.id, value.key].find((item): item is string => typeof item === 'string' && idSet.has(item));

  if (!tid) {
    return undefined;
  }

  return {
    tid,
    text: normalizeTranslationValue(value.text ?? value.translation ?? value.value),
  };
}

function normalizeTranslationValue(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value);
}

function normalizeJsonlLine(line: string): string {
  return line
    .trim()
    .replace(/^```(?:jsonl|json)?/i, '')
    .replace(/```$/g, '')
    .replace(/^data:\s*/, '')
    .replace(/,$/, '')
    .trim();
}

function readSseChunkContent(chunk: string): string {
  return chunk
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => readStreamDelta(line.slice(6).trim()))
    .join('');
}

function readStreamDelta(payload: string): string {
  if (!payload || payload === '[DONE]') {
    return '';
  }

  try {
    const data = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string;
        };
      }>;
    };

    return data.choices?.[0]?.delta?.content ?? '';
  } catch {
    return '';
  }
}

function readChatContent(data: unknown): string {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return response.choices?.[0]?.message?.content ?? '';
}
