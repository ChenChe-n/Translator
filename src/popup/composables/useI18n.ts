import { computed, onMounted, reactive, type ComputedRef } from 'vue';
import {
  DEFAULT_LOCALE,
  localeNames,
  SUPPORTED_LOCALES,
  translate,
  type I18nKey,
  type LocaleCode,
} from '../../i18n';
import { clearLocale, loadLocale, saveLocale } from '../../i18n/localeStorage';

interface I18nState {
  locale: LocaleCode;
}

const state = reactive<I18nState>({
  locale: DEFAULT_LOCALE,
});

const ready = loadLocale().then((locale) => {
  state.locale = locale;
});

/**
 * 使用国际化文本。
 *
 * @returns 国际化工具。
 */
export function useI18n(): {
  locale: ComputedRef<LocaleCode>;
  localeOptions: ComputedRef<Array<{ label: string; value: LocaleCode }>>;
  resetLocale: () => Promise<LocaleCode>;
  setLocale: (locale: LocaleCode) => Promise<void>;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  ready: Promise<void>;
} {
  onMounted(() => {
    void ready;
  });

  const locale = computed(() => state.locale);
  const localeOptions = computed(() =>
    SUPPORTED_LOCALES.map((value) => ({
      label: translate(state.locale, localeNames[value]),
      value,
    })),
  );

  async function setLocale(localeCode: LocaleCode): Promise<void> {
    state.locale = localeCode;
    await saveLocale(localeCode);
  }

  async function resetLocale(): Promise<LocaleCode> {
    const localeCode = await clearLocale();
    state.locale = localeCode;
    return localeCode;
  }

  function t(key: I18nKey, params?: Record<string, string | number>): string {
    return translate(state.locale, key, params);
  }

  return {
    locale,
    localeOptions,
    resetLocale,
    setLocale,
    t,
    ready,
  };
}
