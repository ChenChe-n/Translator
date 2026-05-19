/**
 * OpenAI 兼容接口配置。
 */
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 文本测试输入。
 */
export interface TextTestInput {
  prompt: string;
}

/**
 * 图片测试输入。
 */
export interface ImageTestInput {
  prompt: string;
  imageUrl: string;
  imageName: string;
}

/**
 * 流式测试输入。
 */
export interface StreamTestInput {
  prompt: string;
}

/**
 * API 测试结果。
 */
export interface ApiTestResult {
  ok: boolean;
  content: string;
}
