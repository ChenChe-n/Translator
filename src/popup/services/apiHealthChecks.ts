import type { ApiCheckResult, ApiConfig } from '../types/api';
import { requestImage, requestJson, requestStream, requestText } from './openAiCompatibleClient';

const BASIC_TEXT_TOKEN = 'TRANSLATOR_TEXT_OK';
const STREAM_TOKEN = 'TRANSLATOR_STREAM_OK';

/**
 * 运行全部 API 健康测试。
 *
 * @param config API 配置。
 * @returns 测试结果列表。
 */
export async function runApiHealthChecks(config: ApiConfig): Promise<ApiCheckResult[]> {
  const checks = [testBasicText, testJsonOutput, testImageUnderstanding, testStreamOutput];
  const results: ApiCheckResult[] = [];

  for (const check of checks) {
    results.push(await check(config));
  }

  return results;
}

async function testBasicText(config: ApiConfig): Promise<ApiCheckResult> {
  return runCheck('basicText', '基本文本输入输出', async () => {
    const content = await requestText(config, `只输出 ${BASIC_TEXT_TOKEN}`);
    return content.includes(BASIC_TEXT_TOKEN);
  });
}

async function testJsonOutput(config: ApiConfig): Promise<ApiCheckResult> {
  return runCheck('jsonOutput', 'json结构化输出', async () => {
    const content = await requestJson(config, '只输出 JSON：{"ok":true,"name":"Translator"}');
    const parsed = JSON.parse(extractJson(content)) as { ok?: boolean; name?: string };
    return parsed.ok === true && parsed.name === 'Translator';
  });
}

async function testImageUnderstanding(config: ApiConfig): Promise<ApiCheckResult> {
  return runCheck('imageUnderstanding', '图片理解', async () => {
    const imageDataUrl = await loadTestImageDataUrl();
    const content = await requestImage(
      config,
      '识别图片文字。只输出你看到的文字，按行输出。第三段符号和表情可以忽略。',
      imageDataUrl,
    );

    return hasText(content, 'Test') && hasText(content, '中文文本');
  });
}

async function testStreamOutput(config: ApiConfig): Promise<ApiCheckResult> {
  return runCheck('streamOutput', '流式输出', async () => {
    const content = await requestStream(config, `使用流式响应，只输出 ${STREAM_TOKEN}`);
    return content.includes(STREAM_TOKEN);
  });
}

async function runCheck(
  key: ApiCheckResult['key'],
  label: string,
  task: () => Promise<boolean>,
): Promise<ApiCheckResult> {
  try {
    const passed = await task();

    return {
      key,
      label,
      passed,
      message: passed ? '通过' : '未通过',
    };
  } catch (error) {
    return {
      key,
      label,
      passed: false,
      message: error instanceof Error ? error.message : '测试失败',
    };
  }
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
