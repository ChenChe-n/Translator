import type { ApiConfig, DisableThinkingStrategy } from '../types/api';

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

  return applyDisableThinkingStrategy(payload, config.disableThinkingStrategy ?? 'none');
}

function applyDisableThinkingStrategy(
  payload: Record<string, unknown>,
  strategy: DisableThinkingStrategy,
): Record<string, unknown> {
  if (strategy === 'none') {
    return payload;
  }

  return {
    ...payload,
    ...createThinkingPayload(payload, strategy),
  };
}

function createThinkingPayload(
  payload: Record<string, unknown>,
  strategy: DisableThinkingStrategy,
): Record<string, unknown> {
  return {
    ...createEnableThinkingPayload(payload, strategy),
    ...createThinkingObjectPayload(payload, strategy),
  };
}

function createEnableThinkingPayload(
  payload: Record<string, unknown>,
  strategy: DisableThinkingStrategy,
): Record<string, unknown> {
  return shouldUseEnableThinking(strategy) && !Object.hasOwn(payload, 'enable_thinking')
    ? { enable_thinking: false }
    : {};
}

function createThinkingObjectPayload(
  payload: Record<string, unknown>,
  strategy: DisableThinkingStrategy,
): Record<string, unknown> {
  return shouldUseThinkingObject(strategy) && !Object.hasOwn(payload, 'thinking')
    ? { thinking: { type: 'disabled' } }
    : {};
}

function shouldUseEnableThinking(strategy: DisableThinkingStrategy): boolean {
  return strategy === 'enableThinking' || strategy === 'both';
}

function shouldUseThinkingObject(strategy: DisableThinkingStrategy): boolean {
  return strategy === 'thinking' || strategy === 'both';
}
