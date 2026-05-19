const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const hashLength = 8;
const sequenceLength = 4;
const registeredTexts = new Map<string, string[]>();

/**
 * 创建翻译缓存键。
 *
 * @param text 原文。
 * @param registry 缓存键注册表。
 * @returns 缓存键。
 */
export async function createTranslationCacheKey(text: string, registry = registeredTexts): Promise<string> {
  const hash = await hashText(text);
  const sequence = registerHashText(registry, hash, text);
  return `${hash}-${toBase64Id(sequence, sequenceLength)}`;
}

async function hashText(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return bytesToBase64(new Uint8Array(digest)).slice(0, hashLength);
  }

  return bytesToBase64(fallbackHashBytes(text)).slice(0, hashLength);
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';

  bytes.forEach((byte) => {
    result += String.fromCharCode(byte);
  });

  return btoa(result).replace(/=+$/g, '');
}

function registerHashText(registry: Map<string, string[]>, hash: string, text: string): number {
  const texts = registry.get(hash) ?? [];
  const existingIndex = texts.indexOf(text);

  if (existingIndex >= 0) {
    return existingIndex;
  }

  texts.push(text);
  registry.set(hash, texts);
  return texts.length - 1;
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
