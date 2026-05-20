import type { ApiConfigState } from '../types/api';
import { loadApiConfigState, saveApiConfigState } from './apiConfigStorage';

/**
 * API 配置导出包。
 */
export interface ExportedApiConfigPackage {
  apiConfigState: ApiConfigState;
  exportedAt: string;
  schemaVersion: 1;
}

/**
 * 导出 API 配置。
 *
 * @returns API 配置 JSON 文本。
 */
export async function exportApiConfigJson(): Promise<string> {
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    apiConfigState: await loadApiConfigState(),
  } satisfies ExportedApiConfigPackage, null, 2);
}

/**
 * 导入 API 配置。
 *
 * @param json API 配置 JSON 文本。
 * @returns 标准化后的 API 配置集合。
 */
export async function importApiConfigJson(json: string): Promise<ApiConfigState> {
  const configPackage = parsePackage(json);
  await saveApiConfigState(configPackage.apiConfigState);
  return loadApiConfigState();
}

function parsePackage(json: string): ExportedApiConfigPackage {
  try {
    const input = JSON.parse(json) as Partial<ExportedApiConfigPackage>;
    return {
      schemaVersion: 1,
      exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
      apiConfigState: requireObject(input.apiConfigState),
    };
  } catch {
    throw new Error('jsonTransfer.importFailed');
  }
}

function requireObject<T>(value: T | undefined): T {
  if (!value || typeof value !== 'object') {
    throw new Error('jsonTransfer.importFailed');
  }

  return value;
}
