import type { ApiConfig } from '../types/api';
import { acquireApiConcurrency } from './apiConcurrencyLimiter';
import { createChatRequestPayload } from './chatRequestPayload';

export interface ChatTransportResponse {
  response: Response;
  release: () => void;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * 请求 OpenAI 兼容聊天传输层。
 *
 * @param config API 配置。
 * @param body 请求体。
 * @returns 响应与并发释放函数。
 */
export async function requestChat(config: ApiConfig, body: Record<string, unknown>): Promise<ChatTransportResponse> {
  const release = createReleaseOnce(await acquireApiConcurrency(config));

  try {
    const response = await fetch(buildChatUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(createChatRequestPayload(config, body)),
    });

    if (!response.ok) {
      const message = await readErrorText(response);
      release();
      throw new Error(message);
    }

    return {
      response,
      release,
    };
  } catch (error) {
    release();
    throw error;
  }
}

function createReleaseOnce(release: () => void): () => void {
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    release();
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
