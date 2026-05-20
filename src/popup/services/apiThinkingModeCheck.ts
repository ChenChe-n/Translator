import type { ApiConfig, DisableThinkingStrategy } from '../types/api';
import { requestChat } from './openAiCompatibleTransport';

export interface ThinkingModeCheckResult {
  passed: boolean;
  disableThinkingStrategy: DisableThinkingStrategy;
}

const THINKING_TOKEN = 'TRANSLATOR_THINKING_OK';
const strategies: DisableThinkingStrategy[] = ['none', 'thinking', 'enableThinking', 'both'];

/**
 * 测试当前 API 是否需要禁用思考模式兼容参数。
 *
 * @param config API 配置。
 * @returns 可用的思考模式兼容策略。
 */
export async function testThinkingMode(config: ApiConfig): Promise<ThinkingModeCheckResult> {
  for (const strategy of strategies) {
    if (await canUseStrategy(config, strategy)) {
      return {
        passed: true,
        disableThinkingStrategy: strategy,
      };
    }
  }

  return {
    passed: false,
    disableThinkingStrategy: 'none',
  };
}

async function canUseStrategy(config: ApiConfig, strategy: DisableThinkingStrategy): Promise<boolean> {
  try {
    const response = await requestChat(
      {
        ...config,
        disableThinkingStrategy: strategy,
      },
      createThinkingModeBody(),
    );
    try {
      const content = await readTextContent(response.response);
      return content.includes(THINKING_TOKEN);
    } finally {
      response.release();
    }
  } catch {
    return false;
  }
}

async function readTextContent(response: Response): Promise<string> {
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

function createThinkingModeBody(): Record<string, unknown> {
  return {
    messages: [
      {
        role: 'user',
        content: `只输出 ${THINKING_TOKEN}`,
      },
    ],
  };
}
