const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const hashLength = 8;
const sequenceLength = 4;

/**
 * 创建原文哈希前缀。
 *
 * @param text 原文。
 * @returns 哈希前缀。
 */
export async function createTranslationHashPrefix(text: string): Promise<string> {
  const digest = await hashText(text);
  return bytesToBase64(digest).slice(0, hashLength);
}

/**
 * 创建完整原文哈希。
 *
 * @param text 原文。
 * @returns 完整哈希。
 */
export async function createTranslationSourceHash(text: string): Promise<string> {
  return bytesToBase64(await hashText(text));
}

/**
 * 创建翻译缓存键。
 *
 * @param text 原文。
 * @returns 缓存键。
 */
export async function createTranslationCacheKey(text: string): Promise<string> {
  return createTranslationTid(await createTranslationHashPrefix(text), 0);
}

/**
 * 创建带序号的翻译 TID。
 *
 * @param prefix 哈希前缀。
 * @param sequence 前缀内序号。
 * @returns 翻译 TID。
 */
export function createTranslationTid(prefix: string, sequence: number): string {
  return `${prefix}-${toBase64Id(sequence, sequenceLength)}`;
}

/**
 * 读取 TID 的哈希前缀。
 *
 * @param tid 翻译 TID。
 * @returns 哈希前缀。
 */
export function readTranslationTidPrefix(tid: string): string {
  return tid.split('-')[0] ?? '';
}

async function hashText(text: string): Promise<Uint8Array> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return new Uint8Array(digest);
  }

  return fallbackHashBytes(text);
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';

  bytes.forEach((byte) => {
    result += String.fromCharCode(byte);
  });

  return btoa(result).replace(/=+$/g, '');
}

function toBase64Id(value: number, length: number): string {
  let nextValue = Math.max(0, Math.floor(value));
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result = base64Chars[nextValue & 63] + result;
    nextValue = Math.floor(nextValue / 64);
  }

  return result;
}

function fallbackHashBytes(text: string): Uint8Array {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return new Uint8Array([
    (hash >>> 24) & 255,
    (hash >>> 16) & 255,
    (hash >>> 8) & 255,
    hash & 255,
    (hash >>> 24) & 255,
    (hash >>> 16) & 255,
  ]);
}
