import type { ApiCheckKey, ApiCheckResult, ApiConfig } from '../types/api';
import { requestImage, requestJson, requestStream, requestText } from './openAiCompatibleClient';

interface ApiCheckTaskResult {
  passed: boolean;
  outputTokens?: number;
}

type ApiCheckTask = (config: ApiConfig) => Promise<ApiCheckTaskResult>;

interface ApiCheckDefinition {
  key: ApiCheckKey;
  label: string;
  task: ApiCheckTask;
}

const BASIC_TEXT_TOKEN = 'TRANSLATOR_TEXT_OK';
const STREAM_TOKEN = 'TRANSLATOR_STREAM_OK';
const TOKEN_TARGET = 300;

const checkDefinitions: ApiCheckDefinition[] = [
  {
    key: 'basicText',
    label: '基本文本输入输出',
    task: testBasicText,
  },
  {
    key: 'jsonOutput',
    label: 'json结构化输出',
    task: testJsonOutput,
  },
  {
    key: 'imageUnderstanding',
    label: '图片理解',
    task: testImageUnderstanding,
  },
  {
    key: 'streamOutput',
    label: '流式输出',
    task: testStreamOutput,
  },
  {
    key: 'tokenThroughput',
    label: 'token/s',
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
    label: definition.label,
    status: 'pending',
    passed: false,
    message: '未测试',
  }));
}

/**
 * 逐项运行 API 健康测试。
 *
 * @param config API 配置。
 * @returns 单项测试结果迭代器。
 */
export async function* runApiHealthChecks(config: ApiConfig): AsyncGenerator<ApiCheckResult> {
  for (const definition of checkDefinitions) {
    yield buildRunningResult(definition);
    yield await runCheck(config, definition);
  }
}

async function testBasicText(config: ApiConfig): Promise<ApiCheckTaskResult> {
  const content = await requestText(config, `只输出 ${BASIC_TEXT_TOKEN}`);
  return {
    passed: content.includes(BASIC_TEXT_TOKEN),
  };
}

async function testJsonOutput(config: ApiConfig): Promise<ApiCheckTaskResult> {
  const content = await requestJson(config, '只输出 JSON：{"ok":true,"name":"Translator"}');
  const parsed = JSON.parse(extractJson(content)) as { ok?: boolean; name?: string };
  return {
    passed: parsed.ok === true && parsed.name === 'Translator',
  };
}

async function testImageUnderstanding(config: ApiConfig): Promise<ApiCheckTaskResult> {
  const imageDataUrl = await loadTestImageDataUrl();
  const content = await requestImage(
    config,
    '识别图片文字。只输出你看到的文字，按行输出。第三段符号和表情可以忽略。',
    imageDataUrl,
  );

  return {
    passed: hasText(content, 'Test') && hasText(content, '中文文本'),
  };
}

async function testStreamOutput(config: ApiConfig): Promise<ApiCheckTaskResult> {
  const content = await requestStream(config, `使用流式响应，只输出 ${STREAM_TOKEN}`);
  return {
    passed: content.includes(STREAM_TOKEN),
  };
}

async function testTokenThroughput(config: ApiConfig): Promise<ApiCheckTaskResult> {
  const content = await requestStream(
    config,
    `连续输出约 ${TOKEN_TARGET} 个英文 token。不要解释，不要编号，只输出正文。`,
  );
  const outputTokens = estimateTokenCount(content);

  return {
    passed: outputTokens > 0,
    outputTokens,
  };
}

async function runCheck(config: ApiConfig, definition: ApiCheckDefinition): Promise<ApiCheckResult> {
  const startedAt = performance.now();

  try {
    const result = await definition.task(config);
    const durationMs = Math.round(performance.now() - startedAt);

    return buildFinishedResult(definition, result, durationMs);
  } catch (error) {
    return {
      key: definition.key,
      label: definition.label,
      status: 'finished',
      passed: false,
      message: error instanceof Error ? error.message : '测试失败',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function buildRunningResult(definition: ApiCheckDefinition): ApiCheckResult {
  return {
    key: definition.key,
    label: definition.label,
    status: 'running',
    passed: false,
    message: '测试中',
  };
}

function buildFinishedResult(
  definition: ApiCheckDefinition,
  result: ApiCheckTaskResult,
  durationMs: number,
): ApiCheckResult {
  return {
    key: definition.key,
    label: definition.label,
    status: 'finished',
    passed: result.passed,
    message: result.passed ? '通过' : '未通过',
    durationMs,
    tokenPerSecond:
      definition.key === 'tokenThroughput' ? calculateTokenPerSecond(result.outputTokens ?? 0, durationMs) : undefined,
  };
}

async function loadTestImageDataUrl(): Promise<string> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('请在插件环境中运行图片测试。');
  }

  const response = await fetch(chrome.runtime.getURL('assets/test.png'));
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(new Error('读取测试图片失败。')));
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
