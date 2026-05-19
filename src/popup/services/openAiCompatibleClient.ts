import type { ApiConfig, ApiTestResult, ImageTestInput, StreamTestInput, TextTestInput } from '../types/api';

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * 测试文本请求。
 *
 * @param config API 配置。
 * @param input 文本测试输入。
 * @returns 测试结果。
 */
export async function testText(config: ApiConfig, input: TextTestInput): Promise<ApiTestResult> {
  const response = await requestChat(config, {
    messages: [
      {
        role: 'user',
        content: input.prompt,
      },
    ],
  });

  return readChatResponse(response);
}

/**
 * 测试图片请求。
 *
 * @param config API 配置。
 * @param input 图片测试输入。
 * @returns 测试结果。
 */
export async function testImage(config: ApiConfig, input: ImageTestInput): Promise<ApiTestResult> {
  const response = await requestChat(config, {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: input.prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: input.imageUrl,
            },
          },
        ],
      },
    ],
  });

  return readChatResponse(response);
}

/**
 * 测试流式请求。
 *
 * @param config API 配置。
 * @param input 流式测试输入。
 * @param onDelta 增量内容回调。
 * @returns 测试结果。
 */
export async function testStream(
  config: ApiConfig,
  input: StreamTestInput,
  onDelta: (delta: string) => void,
): Promise<ApiTestResult> {
  const response = await requestChat(config, {
    stream: true,
    messages: [
      {
        role: 'user',
        content: input.prompt,
      },
    ],
  });

  return readStreamResponse(response, onDelta);
}

async function requestChat(config: ApiConfig, body: Record<string, unknown>): Promise<Response> {
  const response = await fetch(buildChatUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      ...body,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorText(response));
  }

  return response;
}

async function readChatResponse(response: Response): Promise<ApiTestResult> {
  const data = (await response.json()) as ChatResponse;
  return {
    ok: true,
    content: data.choices?.[0]?.message?.content ?? '',
  };
}

async function readStreamResponse(
  response: Response,
  onDelta: (delta: string) => void,
): Promise<ApiTestResult> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';

  if (!reader) {
    return {
      ok: false,
      content: '当前环境不支持读取流式响应。',
    };
  }

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseStreamBuffer(buffer, onDelta);
    buffer = parsed.rest;
    content += parsed.content;
  }

  buffer += decoder.decode();
  const parsedRest = parseStreamBuffer(`${buffer}\n`, onDelta);
  content += parsedRest.content;

  return {
    ok: true,
    content,
  };
}

function parseStreamBuffer(
  buffer: string,
  onDelta: (delta: string) => void,
): {
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

    const delta = readStreamDelta(payload);
    content += delta;
    onDelta(delta);
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

async function readErrorText(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    return data.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function buildChatUrl(url: string): string {
  const normalizedUrl = url.trim().replace(/\/+$/, '');

  if (normalizedUrl.endsWith('/chat/completions')) {
    return normalizedUrl;
  }

  return `${normalizedUrl}/chat/completions`;
}
