import { readSseContent } from './sseContentReader';

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
  onRawChunk?: (content: string) => void | Promise<void>,
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

      const chunk = decoder.decode(value, { stream: true });
      await onRawChunk?.(chunk);
      buffer += chunk;
      const parsed = readSseContent(buffer);
      buffer = parsed.rest;
      content += parsed.content;
      if (parsed.content) {
        await onContent?.(content);
      }
    }

    const tail = decoder.decode();
    await onRawChunk?.(tail);
    buffer += tail;
    const parsed = readSseContent(`${buffer}\n\n`);
    content += parsed.content;
    if (parsed.content) {
      await onContent?.(content);
    }
    return content;
  } finally {
    release();
  }
}
