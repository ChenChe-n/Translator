import { parseCompleteTranslationResults, parseTranslationResults, readSseContent } from './translationJsonlParser';

export interface TranslationStreamReaderOptions {
  idSet: Set<string>;
  onContent: (content: string) => void | Promise<void>;
  onResult: (tid: string, text: string | null) => void;
  release: () => void;
  response: Response;
}

/**
 * 读取流式 JSONL 翻译结果。
 *
 * @param options 流式读取选项。
 * @returns 无返回值。
 */
export async function readJsonlTranslationStream(options: TranslationStreamReaderOptions): Promise<void> {
  try {
    await readStream(options);
  } finally {
    options.release();
  }
}

async function readStream(options: TranslationStreamReaderOptions): Promise<void> {
  const reader = options.response.body?.getReader();
  const decoder = new TextDecoder();
  let eventBuffer = '';
  let jsonlBuffer = '';

  if (!reader) {
    return;
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    eventBuffer += decoder.decode(value, { stream: true });
    const parsed = readSseContent(eventBuffer);
    eventBuffer = parsed.rest;
    if (parsed.content) {
      await options.onContent(parsed.content);
    }
    jsonlBuffer = parseTranslationResults(`${jsonlBuffer}${parsed.content}`, options.idSet, options.onResult);
  }

  const parsed = readSseContent(`${eventBuffer}${decoder.decode()}\n\n`);
  if (parsed.content) {
    await options.onContent(parsed.content);
  }
  parseCompleteTranslationResults(`${jsonlBuffer}${parsed.content}`, options.idSet, options.onResult);
}
