import type { ApiConfig } from '../types/api';

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
 * 请求普通文本输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 模型输出文本。
 */
export async function requestText(config: ApiConfig, prompt: string): Promise<string> {
  const response = await requestChat(config, {
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return readChatContent(response);
}

/**
 * 请求 JSON 结构化输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 模型输出文本。
 */
export async function requestJson(config: ApiConfig, prompt: string): Promise<string> {
  const response = await requestChat(config, {
    response_format: {
      type: 'json_object',
    },
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return readChatContent(response);
}

/**
 * 请求图片理解输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @param imageUrl 图片地址。
 * @returns 模型输出文本。
 */
export async function requestImage(config: ApiConfig, prompt: string, imageUrl: string): Promise<string> {
  const response = await requestChat(config, {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
  });

  return readChatContent(response);
}

/**
 * 请求流式输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 完整流式输出文本。
 */
export async function requestStream(config: ApiConfig, prompt: string): Promise<string> {
  const response = await requestChat(config, {
    stream: true,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  return readStreamContent(response);
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

async function readChatContent(response: Response): Promise<string> {
  const data = (await response.json()) as ChatResponse;
  return data.choices?.[0]?.message?.content ?? '';
}

async function readStreamContent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';

  if (!reader) {
    throw new Error('当前环境不支持读取流式响应。');
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
  }

  buffer += decoder.decode();
  content += parseStreamBuffer(`${buffer}\n`).content;
  return content;
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
