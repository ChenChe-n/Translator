import { normalizeLocaleCode, resolveBrowserLocale, type LocaleCode } from '.';

export const LOCALE_STORAGE_KEY = 'Translator.locale';

/**
 * 读取用户手动设置语言。
 *
 * @returns 当前语言。
 */
export async function loadLocale(): Promise<LocaleCode> {
  const storedLocale = await loadStoredLocale();
  return storedLocale ?? resolveBrowserLocale();
}

/**
 * 保存用户手动设置语言。
 *
 * @param locale 语言代码。
 * @returns 无返回值。
 */
export async function saveLocale(locale: LocaleCode): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return;
  }

  await chrome.storage.local.set({
    [LOCALE_STORAGE_KEY]: locale,
  });
}

/**
 * 清空用户手动设置语言。
 *
 * @returns 解析后的环境语言。
 */
export async function clearLocale(): Promise<LocaleCode> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    return resolveBrowserLocale();
  }

  await chrome.storage.local.remove(LOCALE_STORAGE_KEY);
  return resolveBrowserLocale();
}

async function loadStoredLocale(): Promise<LocaleCode | undefined> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return normalizeLocaleCode(localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined);
  }

  const stored = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
  const locale = normalizeLocaleCode(stored[LOCALE_STORAGE_KEY] as string | undefined);
  return locale;
}
