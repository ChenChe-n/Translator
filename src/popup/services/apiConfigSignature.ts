import type { ApiConfig } from '../types/api';

/**
 * 创建 API 配置测试签名。
 *
 * @param config API 配置。
 * @returns 当前配置对应的测试签名。
 */
export function createApiConfigSignature(config: ApiConfig): string {
  return simpleHash([
    normalizeUrl(config.baseUrl),
    config.model.trim(),
    config.apiKey.trim(),
  ].join('\n'));
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function simpleHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}
