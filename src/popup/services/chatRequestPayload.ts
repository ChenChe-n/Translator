import type { ApiConfig } from '../types/api';

const dashScopeThinkingModels = [
  /^deepseek-v4-(?:flash|pro)$/i,
  /^deepseek-v3\.2(?:-exp)?$/i,
  /^deepseek-v3\.1$/i,
];
const deepSeekThinkingModels = [
  /^deepseek-v4-(?:flash|pro)$/i,
];
const dashScopeHosts = ['dashscope.aliyuncs.com', 'bailian.aliyuncs.com'];
const deepSeekHosts = ['api.deepseek.com'];

/**
 * 创建实际发送给聊天接口的请求体。
 *
 * @param config API 配置。
 * @param body 调用方请求体。
 * @returns 聊天接口请求体。
 */
export function createChatRequestPayload(config: ApiConfig, body: Record<string, unknown>): Record<string, unknown> {
  const payload = {
    model: config.model,
    ...body,
  };

  if (shouldDisableDashScopeThinking(config, payload)) {
    return {
      ...payload,
      enable_thinking: false,
      thinking: {
        type: 'disabled',
      },
    };
  }

  if (shouldDisableDeepSeekThinking(config, payload)) {
    return {
      ...payload,
      thinking: {
        type: 'disabled',
      },
    };
  }

  return payload;
}

function shouldDisableDashScopeThinking(config: ApiConfig, payload: Record<string, unknown>): boolean {
  return !Object.hasOwn(payload, 'enable_thinking')
    && isDashScopeBaseUrl(config.baseUrl)
    && isKnownThinkingModel(String(payload.model ?? config.model));
}

function shouldDisableDeepSeekThinking(config: ApiConfig, payload: Record<string, unknown>): boolean {
  return !Object.hasOwn(payload, 'thinking')
    && isDeepSeekBaseUrl(config.baseUrl)
    && deepSeekThinkingModels.some((pattern) => pattern.test(String(payload.model ?? config.model).trim()));
}

function isDashScopeBaseUrl(baseUrl: string): boolean {
  return isAllowedHost(baseUrl, dashScopeHosts);
}

function isDeepSeekBaseUrl(baseUrl: string): boolean {
  return isAllowedHost(baseUrl, deepSeekHosts);
}

function isKnownThinkingModel(model: string): boolean {
  return dashScopeThinkingModels.some((pattern) => pattern.test(model.trim()));
}

function isAllowedHost(baseUrl: string, allowedHosts: string[]): boolean {
  const host = readUrlHost(baseUrl);
  return Boolean(host && allowedHosts.includes(host));
}

function readUrlHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl.trim()).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}
