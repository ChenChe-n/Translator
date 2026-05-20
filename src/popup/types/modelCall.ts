/**
 * 大模型调用状态。
 */
export type ModelCallStatus = 'running' | 'finished' | 'error';

/**
 * 大模型调用记录。
 */
export interface ModelCallLog {
  id: string;
  model: string;
  input: string;
  output: string;
  status: ModelCallStatus;
  createdAt: number;
  updatedAt: number;
  requestTokens?: number;
  responseTokens?: number;
  durationMs?: number;
  errorMessage?: string;
}

/**
 * 创建大模型调用记录输入。
 */
export interface CreateModelCallLogInput {
  model: string;
  input: string;
  requestTokens?: number;
}

/**
 * 更新大模型调用记录输入。
 */
export interface UpdateModelCallLogInput {
  output?: string;
  responseTokens?: number;
  status?: ModelCallStatus;
  errorMessage?: string;
}
