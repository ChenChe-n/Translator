<template>
  <section class="page-shell" :aria-label="t('app.tabs.cache')">
    <section class="cache-block">
      <h2 class="block-title">{{ t('cache.title') }}</h2>
      <p class="block-description">{{ t('cache.description') }}</p>
      <div class="mode-tabs">
        <button
          v-for="option in modeOptions"
          :key="option.value"
          class="mode-tab"
          :class="{ active: option.value === activeMode }"
          type="button"
          @click="handleModeSelect(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>
    <section v-if="activeMode === 'normal'" class="cache-block">
      <div class="language-tabs">
        <button
          v-for="language in languages"
          :key="language"
          class="language-tab"
          :class="{ active: language === activeLanguage }"
          type="button"
          @click="handleLanguageSelect(language)"
        >
          {{ language }}
        </button>
      </div>
      <div v-if="activeLanguage" class="table-shell">
        <div class="table-toolbar">
          <span class="table-count">{{ t('cache.entryCount', { count: entries.length }) }}</span>
          <ElSegmented v-model="sortKey" class="sort-selector" :options="sortOptions" size="small" />
        </div>
        <ElTable class="cache-table" :data="entries" size="small" height="320" border>
          <ElTableColumn prop="tid" :label="t('cache.columns.tid')" min-width="116" show-overflow-tooltip />
          <ElTableColumn prop="sourceText" :label="t('cache.columns.source')" min-width="150" show-overflow-tooltip />
          <ElTableColumn :label="t('cache.columns.result')" min-width="150" show-overflow-tooltip>
            <template #default="{ row }: { row: TranslationCacheViewEntry }">
              {{ row.text ?? t('cache.noTranslation') }}
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
      <p v-else class="empty-text">{{ t('cache.selectLanguage') }}</p>
    </section>
    <p v-else class="empty-text">{{ t('cache.contextPlaceholder') }}</p>
  </section>
</template>

<script setup lang="ts">
import { ElSegmented, ElTable, ElTableColumn } from 'element-plus';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import {
  loadTranslationCacheEntries,
  loadTranslationCacheLanguages,
  TRANSLATION_CACHE_STORAGE_KEYS,
  type TranslationCacheMode,
  type TranslationCacheSortKey,
  type TranslationCacheViewEntry,
} from '../services/translationCacheStorage';

const { t } = useI18n();
const activeMode = ref<TranslationCacheMode>('normal');
const activeLanguage = ref('');
const languages = ref<string[]>([]);
const entries = ref<TranslationCacheViewEntry[]>([]);
const sortKey = ref<TranslationCacheSortKey>('sourceText');
const modeOptions = computed<Array<{ label: string; value: TranslationCacheMode }>>(() => [
  { label: t('translationMode.normal'), value: 'normal' },
  { label: t('translationMode.context'), value: 'context' },
]);
const sortOptions = computed<Array<{ label: string; value: TranslationCacheSortKey }>>(() => [
  { label: t('cache.sort.sourceText'), value: 'sourceText' },
  { label: t('cache.sort.tid'), value: 'tid' },
]);

onMounted(async () => {
  await refreshLanguages();
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

watch([activeLanguage, sortKey], () => {
  void refreshEntries();
});

async function handleModeSelect(mode: TranslationCacheMode): Promise<void> {
  activeMode.value = mode;
  activeLanguage.value = '';
  entries.value = [];
  await refreshLanguages();
}

async function handleLanguageSelect(language: string): Promise<void> {
  activeLanguage.value = language;
  await refreshEntries();
}

async function refreshLanguages(): Promise<void> {
  languages.value = await loadTranslationCacheLanguages(activeMode.value);
  activeLanguage.value = languages.value.includes(activeLanguage.value) ? activeLanguage.value : '';
}

async function refreshEntries(): Promise<void> {
  entries.value = activeLanguage.value
    ? await loadTranslationCacheEntries(activeMode.value, activeLanguage.value, sortKey.value)
    : [];
}

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName !== 'local' || !changes[TRANSLATION_CACHE_STORAGE_KEYS[activeMode.value]]) {
    return;
  }

  await refreshLanguages();
  await refreshEntries();
}
</script>

<style scoped>
.page-shell {
  width: 100%;
  min-height: 100%;
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 12px;
  background: var(--translator-background);
}

.cache-block {
  display: grid;
  gap: 8px;
}

.block-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.block-description,
.empty-text,
.table-count {
  margin: 0;
  color: var(--translator-muted);
  font-size: 11px;
  line-height: 1.5;
}

.mode-tabs,
.language-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.mode-tabs::-webkit-scrollbar,
.language-tabs::-webkit-scrollbar {
  display: none;
}

.mode-tab,
.language-tab {
  height: 32px;
  flex: 0 0 auto;
  min-width: 86px;
  padding: 0 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
  color: var(--translator-text);
  font-size: 12px;
  cursor: pointer;
}

.mode-tab.active,
.language-tab.active {
  border-color: var(--translator-key-button);
  background: var(--translator-key-button);
  color: var(--translator-button);
  box-shadow: 0 8px 18px var(--translator-shadow);
}

.table-shell {
  display: grid;
  gap: 8px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sort-selector {
  width: 160px;
}

.cache-table {
  --el-table-bg-color: var(--translator-container);
  --el-table-tr-bg-color: var(--translator-container);
  --el-table-header-bg-color: var(--translator-button);
}
</style>
