import zhHansLang from './zh-hans/lang.json';

export type I18nMessages = typeof zhHansLang;
export type I18nKey = keyof I18nMessages;
export type LocaleCode = 'zh-hans' | 'en-us';
