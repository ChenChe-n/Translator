/**
 * 读取 SSE 缓冲中的模型文本内容。
 *
 * @param buffer SSE 原始缓冲文本。
 * @returns 模型文本内容与尚未完整的 SSE 事件缓冲。
 */
export function readSseContent(buffer: string): { content: string; rest: string } {
  const chunks = buffer.split(/\r?\n\r?\n/);
  const rest = chunks.pop() ?? '';
  const content = chunks.map(readSseChunkContent).join('');

  return {
    content,
    rest,
  };
}

function readSseChunkContent(chunk: string): string {
  return chunk
    .split(/\r?\n/)
    .map(readSseDataPayload)
    .filter((payload): payload is string => Boolean(payload))
    .map(readStreamDelta)
    .join('');
}

function readSseDataPayload(line: string): string | undefined {
  const text = line.trimStart();

  if (!text.startsWith('data:')) {
    return undefined;
  }

  const payload = text.slice(5).trim();
  return payload && payload !== '[DONE]' ? payload : undefined;
}

function readStreamDelta(payload: string): string {
  try {
    const data = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string;
        };
        message?: {
          content?: string;
        };
        text?: string;
      }>;
      content?: string;
      text?: string;
    };

    return data.choices?.[0]?.delta?.content
      ?? data.choices?.[0]?.message?.content
      ?? data.choices?.[0]?.text
      ?? data.content
      ?? data.text
      ?? '';
  } catch {
    return payload;
  }
}
