import type { ApiConfig } from '../types/api';

interface WaitingRequest {
  reject: (error: Error) => void;
  resolve: () => void;
  timer: number;
}

interface RequestPool {
  running: number;
  waiting: WaitingRequest[];
}

const pools = new Map<string, RequestPool>();
const waitTimeoutMs = 60 * 1000;

/**
 * 在 API 并发限制内执行请求。
 *
 * @param config API 配置。
 * @param task 请求任务。
 * @returns 请求任务结果。
 */
export async function runWithApiConcurrency<T>(config: ApiConfig, task: () => Promise<T>): Promise<T> {
  const release = await acquireApiConcurrency(config);

  try {
    return await task();
  } finally {
    release();
  }
}

/**
 * 获取 API 请求并发空位。
 *
 * @param config API 配置。
 * @returns 释放并发空位的函数。
 */
export async function acquireApiConcurrency(config: ApiConfig): Promise<() => void> {
  const pool = getRequestPool(config);
  const limit = normalizeConcurrency(config.maxConcurrency);
  await acquireRequestSlot(pool, limit);
  return () => releaseRequestSlot(pool, limit);
}

function acquireRequestSlot(pool: RequestPool, limit: number): Promise<void> {
  if (pool.running < limit) {
    pool.running += 1;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const waitingRequest: WaitingRequest = {
      resolve: () => {
        window.clearTimeout(waitingRequest.timer);
        pool.running += 1;
        resolve();
      },
      reject,
      timer: window.setTimeout(() => {
        removeWaitingRequest(pool, waitingRequest);
        reject(new Error('api.errors.concurrencyTimeout'));
      }, waitTimeoutMs),
    };
    pool.waiting.push(waitingRequest);
  });
}

function releaseRequestSlot(pool: RequestPool, limit: number): void {
  pool.running = Math.max(0, pool.running - 1);

  while (pool.waiting.length > 0 && pool.running < limit) {
    pool.waiting.shift()?.resolve();
  }
}

function getRequestPool(config: ApiConfig): RequestPool {
  const key = `${config.baseUrl.trim()}::${config.model.trim()}`;
  const pool = pools.get(key) ?? { running: 0, waiting: [] };
  pools.set(key, pool);
  return pool;
}

function removeWaitingRequest(pool: RequestPool, request: WaitingRequest): void {
  pool.waiting = pool.waiting.filter((item) => item !== request);
}

function normalizeConcurrency(value: number): number {
  return Math.min(65536, Math.max(1, Math.floor(value)));
}
