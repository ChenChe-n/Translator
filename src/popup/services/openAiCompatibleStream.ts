/**
 * 读取 OpenAI 兼容接口的 SSE 文本输出。
 *
 * @param response 接口响应。
 * @param onContent 内容更新回调。
 * @param release 连接释放回调。
 * @returns 完整输出文本。
 */
export async function readChatStreamContent(
  response: Response,
  onContent?: (content: string) => void | Promise<void>,
  release: () => void = () => undefined,
): Promise<string> {
  try {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let content = '';
    let buffer = '';

    if (!reader) {
      throw new Error('api.errors.streamUnsupported');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseStreamBuffer(buffer);
      buffer = parsed.rest;
      content += parsed.content;
      if (parsed.content) {
        await onContent?.(content);
      }
    }

    buffer += decoder.decode();
    const parsed = parseStreamBuffer(`${buffer}\n`);
    content += parsed.content;
    if (parsed.content) {
      await onContent?.(content);
    }
    return content;
  } finally {
    release();
  }
}

function parseStreamBuffer(buffer: string): {
  content: string;
  rest: string;
} {
  let content = '';
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.startsWith('data: ')) {
      continue;
    }

    const payload = line.slice(6).trim();

    if (payload === '[DONE]') {
      continue;
    }

    content += readStreamDelta(payload);
  }

  return {
    content,
    rest,
  };
}

function readStreamDelta(payload: string): string {
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
