import type { ApiConfig } from '../types/api';
import type { ModelCallLog } from '../types/modelCall';
import { createRequestLog, failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface StreamTextOptions {
  onContent?: (content: string) => void | Promise<void>;
}

export interface LoggedChatResponse {
  callLog: ModelCallLog;
  response: Response;
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
  const inputTokens = estimateTokenCount(prompt);
  const body = createTextBody(prompt);
  const callLog = await createRequestLog(config, body);

  try {
    const response = await requestChat(config, body);
    return await readAndRecordChatContent(config, response, inputTokens, callLog);
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
}

/**
 * 请求 JSON 结构化输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 模型输出文本。
 */
export async function requestJson(config: ApiConfig, prompt: string): Promise<string> {
  const inputTokens = estimateTokenCount(prompt);
  const body = {
    response_format: {
      type: 'json_object',
    },
    ...createTextBody(prompt),
  };
  const callLog = await createRequestLog(config, body);

  try {
    const response = await requestChat(config, body);
    return await readAndRecordChatContent(config, response, inputTokens, callLog);
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
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
  const inputTokens = estimateTokenCount(prompt) + estimateImageInputTokens(imageUrl);
  const body = {
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
  };
  const callLog = await createRequestLog(config, body);

  try {
    const response = await requestChat(config, body);
    return await readAndRecordChatContent(config, response, inputTokens, callLog);
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
}

/**
 * 请求流式输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 完整流式输出文本。
 */
export async function requestStream(config: ApiConfig, prompt: string, options: StreamTextOptions = {}): Promise<string> {
  const inputTokens = estimateTokenCount(prompt);
  const body = {
    stream: true,
    ...createTextBody(prompt),
  };
  const callLog = await createRequestLog(config, body);

  try {
    const response = await requestChat(config, body);
    const content = await readStreamContent(response, async (nextContent) => {
      options.onContent?.(nextContent);
      await updateRequestOutput(callLog, nextContent);
    });
    await updateRequestOutput(callLog, content, true);
    await recordUsage(config, inputTokens, content);
    return content;
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
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

/**
 * 请求 OpenAI 兼容聊天接口。
 *
 * @param config API 配置。
 * @param body 请求体。
 * @returns API 响应。
 */
export async function requestChatResponse(config: ApiConfig, body: Record<string, unknown>): Promise<LoggedChatResponse> {
  const callLog = await createRequestLog(config, body);

  try {
    return {
      callLog,
      response: await requestChat(config, body),
    };
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
}

async function readAndRecordChatContent(
  config: ApiConfig,
  response: Response,
  inputTokens: number,
  callLog: ModelCallLog,
): Promise<string> {
  const data = (await response.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content ?? '';
  await updateRequestOutput(callLog, content, true);
  await recordUsage(config, data.usage?.prompt_tokens ?? inputTokens, content, data.usage?.completion_tokens);
  return content;
}

async function readStreamContent(
  response: Response,
  onContent?: (content: string) => void | Promise<void>,
): Promise<string> {
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

function createTextBody(prompt: string): Record<string, unknown> {
  return {
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };
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

async function recordUsage(
  config: ApiConfig,
  inputTokens: number,
  content: string,
  outputTokens = estimateTokenCount(content),
): Promise<void> {
  await recordModelUsage({
    model: config.model,
    inputTokens,
    outputTokens,
  });
}

function estimateImageInputTokens(imageUrl: string): number {
  return imageUrl.startsWith('data:') ? Math.max(85, Math.round(imageUrl.length / 600)) : 85;
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.round(content.trim().length / 4));
}
