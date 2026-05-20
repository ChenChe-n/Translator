import type { ApiConfig } from '../types/api';
import type { ModelCallLog } from '../types/modelCall';
import { createRequestLog, failRequestLog, updateRequestOutput } from './modelCallRecorder';
import { recordModelUsage } from './modelUsageStorage';
import { readChatStreamContent } from './openAiCompatibleStream';
import { requestChat } from './openAiCompatibleTransport';

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
  shouldRecordUsage?: () => boolean;
}

export interface RequestUsageOptions {
  shouldRecordUsage?: () => boolean;
}

export interface LoggedChatResponse {
  callLog: ModelCallLog;
  release: () => void;
  response: Response;
}

/**
 * 请求普通文本输出。
 *
 * @param config API 配置。
 * @param prompt 提示词。
 * @returns 模型输出文本。
 */
export async function requestText(config: ApiConfig, prompt: string, options: RequestUsageOptions = {}): Promise<string> {
  const inputTokens = estimateTokenCount(prompt);
  const body = createTextBody(prompt);
  const callLog = await createRequestLog(config, body);

  try {
    const chatResponse = await requestChat(config, body);
    return await readAndRecordChatContent(
      config,
      chatResponse.response,
      inputTokens,
      callLog,
      chatResponse.release,
      options.shouldRecordUsage,
    );
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
export async function requestJson(config: ApiConfig, prompt: string, options: RequestUsageOptions = {}): Promise<string> {
  const inputTokens = estimateTokenCount(prompt);
  const body = {
    response_format: {
      type: 'json_object',
    },
    ...createTextBody(prompt),
  };
  const callLog = await createRequestLog(config, body);

  try {
    const chatResponse = await requestChat(config, body);
    return await readAndRecordChatContent(
      config,
      chatResponse.response,
      inputTokens,
      callLog,
      chatResponse.release,
      options.shouldRecordUsage,
    );
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
export async function requestImage(
  config: ApiConfig,
  prompt: string,
  imageUrl: string,
  options: RequestUsageOptions = {},
): Promise<string> {
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
    const chatResponse = await requestChat(config, body);
    return await readAndRecordChatContent(
      config,
      chatResponse.response,
      inputTokens,
      callLog,
      chatResponse.release,
      options.shouldRecordUsage,
    );
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
    const chatResponse = await requestChat(config, body);
    let rawOutput = '';
    const content = await readChatStreamContent(chatResponse.response, async (nextContent) => {
      options.onContent?.(nextContent);
    }, chatResponse.release, async (chunk) => {
      rawOutput += chunk;
      await updateRequestOutput(callLog, rawOutput);
    });
    await updateRequestOutput(callLog, rawOutput || content, true);
    if (shouldRecordUsage(options.shouldRecordUsage)) {
      await recordUsage(config, inputTokens, content);
    }
    return content;
  } catch (error) {
    await failRequestLog(callLog, error);
    throw error;
  }
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
    const chatResponse = await requestChat(config, body);
    return {
      callLog,
      release: chatResponse.release,
      response: chatResponse.response,
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
  release: () => void,
  shouldRecordUsageCallback?: () => boolean,
): Promise<string> {
  try {
    const data = (await response.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    await updateRequestOutput(callLog, JSON.stringify(data, null, 2), true);
    if (shouldRecordUsage(shouldRecordUsageCallback)) {
      await recordUsage(config, data.usage?.prompt_tokens ?? inputTokens, content, data.usage?.completion_tokens);
    }
    return content;
  } finally {
    release();
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

function shouldRecordUsage(callback: (() => boolean) | undefined): boolean {
  return callback?.() !== false;
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.round(content.trim().length / 4));
}
