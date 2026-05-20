import type { ApiConfig } from '../types/api';

const dashScopeThinkingModels = [
  /^deepseek-v4-(?:flash|pro)$/i,
  /^deepseek-v3\.2(?:-exp)?$/i,
  /^deepseek-v3\.1$/i,
];

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
    };
  }

  return payload;
}

function shouldDisableDashScopeThinking(config: ApiConfig, payload: Record<string, unknown>): boolean {
  return !Object.hasOwn(payload, 'enable_thinking')
    && isDashScopeBaseUrl(config.baseUrl)
    && isKnownThinkingModel(String(payload.model ?? config.model));
}

function isDashScopeBaseUrl(baseUrl: string): boolean {
  const normalizedUrl = baseUrl.trim().toLowerCase();
  return normalizedUrl.includes('dashscope.aliyuncs.com') || normalizedUrl.includes('bailian.aliyuncs.com');
}

function isKnownThinkingModel(model: string): boolean {
  return dashScopeThinkingModels.some((pattern) => pattern.test(model.trim()));
}
