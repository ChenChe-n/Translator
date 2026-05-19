/**
 * 解析聊天响应中的 JSONL 翻译结果。
 *
 * @param data 聊天响应数据。
 * @param idSet 有效输入 ID。
 * @returns 翻译结果。
 */
export function parseChatJsonlResults(data: unknown, idSet: Set<string>): Map<string, string | null> {
  const results = new Map<string, string | null>();
  parseJsonlLines(`${readChatContent(data)}\n`, idSet, (tid, value) => results.set(tid, value));
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

  try {
    const parsed = JSON.parse(text) as Record<string, string | null>;
    Object.entries(parsed).forEach(([tid, value]) => {
      if (idSet.has(tid)) {
        onResult(tid, value);
      }
    });
  } catch {
    // 忽略未完成或非 JSONL 行。
  }
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
