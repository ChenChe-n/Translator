import type { ApiCheckResult, ApiConfig, DisableThinkingStrategy } from '../types/api';
import { createApiConfigSignature } from './apiConfigSignature';

const requiredCheckKeys: ApiCheckResult['key'][] = [
  'thinkingMode',
  'basicText',
  'jsonOutput',
  'streamOutput',
  'tokenThroughput',
];

/**
 * 从测试结果读取思考模式兼容策略。
 *
 * @param results API 测试结果列表。
 * @returns 测试得到的思考模式兼容策略。
 */
export function getTestedDisableThinkingStrategy(results: ApiCheckResult[]): DisableThinkingStrategy {
  return results.find((item) => item.key === 'thinkingMode')?.disableThinkingStrategy ?? 'none';
}

/**
 * 判断当前 API 配置是否已通过必需测试。
 *
 * @param config API 配置。
 * @param results API 测试结果列表。
 * @returns 是否可以用于真实模型调用。
 */
export function isApiConfigTestPassed(config: ApiConfig, results: ApiCheckResult[]): boolean {
  const signature = createApiConfigSignature(config);
  return requiredCheckKeys.every((key) => {
    const result = results.find((item) => item.key === key);
    return result?.status === 'finished' && result.passed && result.configSignature === signature;
  });
}

/**
 * 重置与当前配置不匹配的 API 测试结果。
 *
 * @param config API 配置。
 * @param results API 测试结果列表。
 * @returns 已清理过期结果后的测试结果列表。
 */
export function resetMismatchedApiCheckResults(config: ApiConfig, results: ApiCheckResult[]): ApiCheckResult[] {
  const signature = createApiConfigSignature(config);
  return results.map((result) => (isCurrentResult(result, signature) ? result : resetCheckResult(result)));
}

function isCurrentResult(result: ApiCheckResult, signature: string): boolean {
  return result.status !== 'finished' || result.configSignature === signature;
}

function resetCheckResult(result: ApiCheckResult): ApiCheckResult {
  return {
    key: result.key,
    label: result.label,
    status: 'pending',
    passed: false,
    message: 'api.checks.pending',
  };
}
