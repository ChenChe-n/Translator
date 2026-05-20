import type { TranslationCacheMode } from '../types/translationCache';

export const TRANSLATION_CACHE_STORAGE_KEYS: Record<TranslationCacheMode, string> = {
  normal: 'Translator.translationCache.normal',
  context: 'Translator.translationCache.context',
};
