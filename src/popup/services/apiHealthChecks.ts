import type { ApiCheckKey, ApiCheckResult, ApiConfig } from '../types/api';
import type { I18nKey } from '../../i18n';
import { requestImage, requestJson, requestStream, requestText, type RequestUsageOptions } from './openAiCompatibleClient';
import { testThinkingMode } from './apiThinkingModeCheck';

interface ApiCheckTaskResult {
  passed: boolean;
  disableThinkingStrategy?: ApiCheckResult['disableThinkingStrategy'];
  outputTokens?: number;
}

export interface ApiHealthCheckOptions {
  isActive?: () => boolean;
  shouldRecordUsage?: () => boolean;
}

type ApiCheckTask = (config: ApiConfig, options: RequestUsageOptions) => Promise<ApiCheckTaskResult>;

interface ApiCheckDefinition {
  key: ApiCheckKey;
  labelKey: I18nKey;
  task: ApiCheckTask;
}

const BASIC_TEXT_TOKEN = 'TRANSLATOR_TEXT_OK';
const STREAM_TOKEN = 'TRANSLATOR_STREAM_OK';
const TOKEN_TARGET = 100;

const checkDefinitions: ApiCheckDefinition[] = [
  {
    key: 'thinkingMode',
    labelKey: 'api.checks.thinkingMode',
    task: testThinkingModeCompatibility,
  },
  {
    key: 'basicText',
    labelKey: 'api.checks.basicText',
    task: testBasicText,
  },
  {
    key: 'jsonOutput',
    labelKey: 'api.checks.jsonOutput',
    task: testJsonOutput,
  },
  {
    key: 'imageUnderstanding',
    labelKey: 'api.checks.imageUnderstanding',
    task: testImageUnderstanding,
  },
  {
    key: 'streamOutput',
    labelKey: 'api.checks.streamOutput',
    task: testStreamOutput,
  },
  {
    key: 'tokenThroughput',
    labelKey: 'api.checks.tokenThroughput',
    task: testTokenThroughput,
  },
];

/**
 * 创建默认 API 测试结果。
 *
 * @returns 默认测试结果列表。
 */
export function createDefaultApiCheckResults(): ApiCheckResult[] {
  return checkDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.labelKey,
    status: 'pending',
    passed: false,
    message: 'api.checks.pending',
  }));
}

/**
 * 逐项运行 API 健康测试。
 *
 * @param config API 配置。
 * @returns 单项测试结果迭代器。
 */
export async function* runApiHealthChecks(
  config: ApiConfig,
  options: ApiHealthCheckOptions = {},
): AsyncGenerator<ApiCheckResult> {
  let testingConfig = { ...config };

  for (const definition of checkDefinitions) {
    if (options.isActive?.() === false) {
      return;
    }

    yield buildRunningResult(definition);
    const result = await runCheck(testingConfig, definition, options);
    if (result.disableThinkingStrategy) {
      testingConfig = {
        ...testingConfig,
        disableThinkingStrategy: result.disableThinkingStrategy,
      };
    }
    yield result;
  }
}

async function testBasicText(config: ApiConfig, options: RequestUsageOptions): Promise<ApiCheckTaskResult> {
  const content = await requestText(config, `只输出 ${BASIC_TEXT_TOKEN}`, options);
  return {
    passed: content.includes(BASIC_TEXT_TOKEN),
  };
}

async function testThinkingModeCompatibility(config: ApiConfig): Promise<ApiCheckTaskResult> {
  return testThinkingMode(config);
}

async function testJsonOutput(config: ApiConfig, options: RequestUsageOptions): Promise<ApiCheckTaskResult> {
  const content = await requestJson(config, '只输出 JSON：{"ok":true,"name":"Translator"}', options);
  const parsed = JSON.parse(extractJson(content)) as { ok?: boolean; name?: string };
  return {
    passed: parsed.ok === true && parsed.name === 'Translator',
  };
}

async function testImageUnderstanding(config: ApiConfig, options: RequestUsageOptions): Promise<ApiCheckTaskResult> {
  const imageDataUrl = await loadTestImageDataUrl();
  const content = await requestImage(
    config,
    '识别图片文字。只输出你看到的文字，按行输出。',
    imageDataUrl,
    options,
  );

  return {
    passed: (hasText(content, 'Test') || hasText(content, 'test')) && hasText(content, '中文文本'),
  };
}

async function testStreamOutput(config: ApiConfig, options: RequestUsageOptions): Promise<ApiCheckTaskResult> {
  const content = await requestStream(config, `使用流式响应，只输出 ${STREAM_TOKEN}`, options);
  return {
    passed: content.includes(STREAM_TOKEN),
  };
}

async function testTokenThroughput(config: ApiConfig, options: RequestUsageOptions): Promise<ApiCheckTaskResult> {
  const content = await requestStream(
    config,
    `连续输出约 ${TOKEN_TARGET} 个英文 token。不要解释，不要编号，只输出正文。`,
    options,
  );
  const outputTokens = estimateTokenCount(content);

  return {
    passed: outputTokens > 0,
    outputTokens,
  };
}

async function runCheck(
  config: ApiConfig,
  definition: ApiCheckDefinition,
  options: ApiHealthCheckOptions,
): Promise<ApiCheckResult> {
  const startedAt = performance.now();

  try {
    const result = await definition.task(config, {
      shouldRecordUsage: () => options.isActive?.() !== false && options.shouldRecordUsage?.() !== false,
    });
    const durationMs = Math.round(performance.now() - startedAt);

    return buildFinishedResult(definition, result, durationMs);
  } catch (error) {
    return {
      key: definition.key,
      label: definition.labelKey,
      status: 'finished',
      passed: false,
      message: error instanceof Error ? error.message : 'api.messages.testFailed',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function buildRunningResult(definition: ApiCheckDefinition): ApiCheckResult {
  return {
    key: definition.key,
    label: definition.labelKey,
    status: 'running',
    passed: false,
    message: 'api.checks.running',
  };
}

function buildFinishedResult(
  definition: ApiCheckDefinition,
  result: ApiCheckTaskResult,
  durationMs: number,
): ApiCheckResult {
  return {
    key: definition.key,
    label: definition.labelKey,
    status: 'finished',
    passed: result.passed,
    message: result.passed ? 'api.checks.passed' : 'api.checks.failed',
    durationMs,
    disableThinkingStrategy: result.disableThinkingStrategy,
    tokenPerSecond:
      definition.key === 'tokenThroughput' ? calculateTokenPerSecond(result.outputTokens ?? 0, durationMs) : undefined,
  };
}

async function loadTestImageDataUrl(): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('api.errors.imageEnv');
  }

  const response = await fetch(chrome.runtime.getURL('assets/test.png'));
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(new Error('api.errors.imageRead')));
    reader.readAsDataURL(blob);
  });
}

function extractJson(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start < 0 || end < start) {
    return content;
  }

  return content.slice(start, end + 1);
}

function hasText(content: string, expected: string): boolean {
  return normalizeText(content).includes(normalizeText(expected));
}

function normalizeText(content: string): string {
  return content.replace(/\s+/g, '').toLowerCase();
}

function estimateTokenCount(content: string): number {
  return Math.max(1, Math.round(content.trim().length / 4));
}

function calculateTokenPerSecond(outputTokens: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }

  return Math.round((outputTokens / durationMs) * 1000);
}
