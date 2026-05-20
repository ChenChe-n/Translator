import type { ApiConfig } from '../types/api';
import type { ModelCallLog } from '../types/modelCall';
import { createChatRequestPayload } from './chatRequestPayload';
import { createModelCallLog, updateModelCallLog } from './modelCallLogStorage';

/**
 * 创建请求调用记录。
 *
 * @param config API 配置。
 * @param body 请求体。
 * @returns 调用记录。
 */
export async function createRequestLog(config: ApiConfig, body: Record<string, unknown>): Promise<ModelCallLog> {
  return createModelCallLog({
    model: config.model,
    input: JSON.stringify(createChatRequestPayload(config, body), null, 2),
  });
}

/**
 * 更新调用输出。
 *
 * @param callLog 调用记录。
 * @param output 输出内容。
 * @param finished 是否完成。
 * @returns 无返回值。
 */
export async function updateRequestOutput(callLog: ModelCallLog, output: string, finished = false): Promise<void> {
  await updateModelCallLog(callLog.id, {
    output,
    status: finished ? 'finished' : 'running',
  });
}

/**
 * 标记调用失败。
 *
 * @param callLog 调用记录。
 * @param error 错误对象。
 * @returns 无返回值。
 */
export async function failRequestLog(callLog: ModelCallLog, error: unknown): Promise<void> {
  await updateModelCallLog(callLog.id, {
    status: 'error',
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}
