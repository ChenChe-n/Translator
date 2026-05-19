const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const hashSalt = 0x811c9dc5;

/**
 * 创建翻译缓存键。
 *
 * @param text 原文。
 * @param index 递增序号。
 * @returns 缓存键。
 */
export function createTranslationCacheKey(text: string, index: number): string {
  return `${toBase64Id(hashText(text), 8)}-${toBase64Id(index, 4)}`;
}

function hashText(text: string): number {
  let hash = hashSalt;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function toBase64Id(value: number, length: number): string {
  let nextValue = value;
  let result = '';

  for (let index = 0; index < length; index += 1) {
    result = base64Chars[nextValue & 63] + result;
    nextValue = Math.floor(nextValue / 64);
  }

  return result;
}
