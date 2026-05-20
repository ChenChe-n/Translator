import type { CreateModelCallLogInput, ModelCallLog, UpdateModelCallLogInput } from '../types/modelCall';

export const MODEL_CALL_LOG_KEY = 'Translator.modelCallLogs';
const maxLogCount = 50;
let writeQueue = Promise.resolve();

/**
 * 读取大模型调用记录。
 *
 * @returns 最近大模型调用记录。
 */
export async function loadModelCallLogs(): Promise<ModelCallLog[]> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeLogs(readPreviewLogs());
  }

  const stored = await chrome.storage.local.get(MODEL_CALL_LOG_KEY);
  return normalizeLogs(stored[MODEL_CALL_LOG_KEY] as ModelCallLog[] | undefined);
}

/**
 * 创建大模型调用记录。
 *
 * @param input 创建调用记录输入。
 * @returns 调用记录。
 */
export async function createModelCallLog(input: CreateModelCallLogInput): Promise<ModelCallLog> {
  const now = Date.now();
  const log: ModelCallLog = {
    id: `model-call-${now}-${Math.random().toString(36).slice(2, 8)}`,
    model: input.model,
    input: input.input,
    output: '',
    status: 'running',
    createdAt: now,
    updatedAt: now,
    requestTokens: input.requestTokens,
  };

  await mutateLogs((logs) => [...logs, log]);
  return log;
}

/**
 * 更新大模型调用记录。
 *
 * @param id 调用记录 ID。
 * @param input 更新调用记录输入。
 * @returns 无返回值。
 */
export async function updateModelCallLog(id: string, input: UpdateModelCallLogInput): Promise<void> {
  await mutateLogs((logs) => logs.map((item) => (item.id === id ? mergeLogUpdate(item, input) : item)));
}

/**
 * 清空大模型调用记录。
 *
 * @returns 无返回值。
 */
export async function clearModelCallLogs(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(MODEL_CALL_LOG_KEY);
    return;
  }

  await chrome.storage.local.remove(MODEL_CALL_LOG_KEY);
}

function readPreviewLogs(): ModelCallLog[] | undefined {
  const value = localStorage.getItem(MODEL_CALL_LOG_KEY);
  return value ? (JSON.parse(value) as ModelCallLog[]) : undefined;
}

async function saveLogs(logs: ModelCallLog[]): Promise<void> {
  const nextLogs = normalizeLogs(logs);

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(MODEL_CALL_LOG_KEY, JSON.stringify(nextLogs));
    return;
  }

  await chrome.storage.local.set({
    [MODEL_CALL_LOG_KEY]: nextLogs,
  });
}

async function mutateLogs(mutator: (logs: ModelCallLog[]) => ModelCallLog[]): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    await saveLogs(mutator(await loadModelCallLogs()));
  });
  await writeQueue;
}

function normalizeLogs(logs: ModelCallLog[] | undefined): ModelCallLog[] {
  return (logs ?? []).map(normalizeLog).sort((a, b) => a.createdAt - b.createdAt).slice(-maxLogCount);
}

function normalizeLog(log: ModelCallLog): ModelCallLog {
  const createdAt = Number.isFinite(log.createdAt) ? log.createdAt : Date.now();
  const updatedAt = Number.isFinite(log.updatedAt) ? log.updatedAt : createdAt;
  const status = normalizeLogStatus(log);

  return {
    id: log.id || `model-call-${Date.now()}`,
    model: log.model || '',
    input: log.input || '',
    output: log.output || '',
    status,
    createdAt,
    updatedAt,
    requestTokens: readOptionalNumber(log.requestTokens),
    responseTokens: readOptionalNumber(log.responseTokens),
    durationMs: status === 'running' ? undefined : Math.max(0, updatedAt - createdAt),
    errorMessage: readErrorMessage(log),
  };
}

function mergeLogUpdate(log: ModelCallLog, input: UpdateModelCallLogInput): ModelCallLog {
  const keepFinalStatus = shouldKeepFinalStatus(log, input);
  const updatedAt = Date.now();

  return normalizeLog({
    ...log,
    ...(keepFinalStatus ? {} : input),
    status: keepFinalStatus ? log.status : input.status ?? log.status,
    updatedAt,
  });
}

function shouldKeepFinalStatus(log: ModelCallLog, input: UpdateModelCallLogInput): boolean {
  return (log.status === 'finished' || log.status === 'error') && input.status === 'running';
}

function readOptionalNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeStatus(status: ModelCallLog['status']): ModelCallLog['status'] {
  return status === 'finished' || status === 'error' ? status : 'running';
}

function normalizeLogStatus(log: ModelCallLog): ModelCallLog['status'] {
  const status = normalizeStatus(log.status);
  return status === 'running' && hasCompletedRawStream(log.output) ? 'error' : status;
}

function hasCompletedRawStream(output: string): boolean {
  return output.includes('data: [DONE]') || output.includes('"finish_reason":"stop"');
}

function readErrorMessage(log: ModelCallLog): string | undefined {
  if (log.errorMessage) {
    return log.errorMessage;
  }

  return normalizeLogStatus(log) === 'error' && hasCompletedRawStream(log.output)
    ? 'api.errors.incompleteTranslationResult'
    : undefined;
}
