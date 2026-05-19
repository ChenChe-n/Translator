import enUsLang from './en-us/lang.json';
import type { I18nKey, I18nMessages, LocaleCode } from './types';
import zhHansLang from './zh-hans/lang.json';

export type { I18nKey, LocaleCode };

export const DEFAULT_LOCALE: LocaleCode = 'en-us';
export const SUPPORTED_LOCALES: LocaleCode[] = ['zh-hans', 'en-us'];

export const localeNames: Record<LocaleCode, I18nKey> = {
  'zh-hans': 'language.zhHans',
  'en-us': 'language.enUs',
};

const localeMessages: Record<LocaleCode, I18nMessages> = {
  'zh-hans': zhHansLang,
  'en-us': enUsLang,
};

/**
 * 读取指定语言文本。
 *
 * @param locale 语言代码。
 * @param key 文本键。
 * @param params 插值参数。
 * @returns 本地化文本。
 */
export function translate(locale: LocaleCode, key: I18nKey, params: Record<string, string | number> = {}): string {
  const message = localeMessages[locale]?.[key] ?? localeMessages[DEFAULT_LOCALE][key] ?? key;
  return formatMessage(message, params);
}

/**
 * 将浏览器语言代码转换为项目语言代码。
 *
 * @param language 浏览器或系统语言。
 * @returns 项目支持的语言代码。
 */
export function normalizeLocaleCode(language: string | undefined): LocaleCode | undefined {
  const normalized = language?.trim().replace(/_/g, '-').toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (SUPPORTED_LOCALES.includes(normalized as LocaleCode)) {
    return normalized as LocaleCode;
  }

  if (normalized === 'zh' || normalized.startsWith('zh-hans')) {
    return 'zh-hans';
  }

  if (normalized === 'zh-cn' || normalized === 'zh-sg' || normalized === 'zh-my') {
    return 'zh-hans';
  }

  if (normalized === 'en' || normalized === 'en-us') {
    return 'en-us';
  }

  if (normalized.startsWith('en-')) {
    return 'en-us';
  }

  return undefined;
}

/**
 * 解析当前环境可用语言。
 *
 * @returns 项目支持的语言代码。
 */
export function resolveBrowserLocale(): LocaleCode {
  const languages = typeof navigator === 'undefined' ? [] : [navigator.language, ...navigator.languages];
  const locale = languages.map(normalizeLocaleCode).find((item): item is LocaleCode => Boolean(item));
  return locale ?? DEFAULT_LOCALE;
}

function formatMessage(message: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );
}
