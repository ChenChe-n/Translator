<template>
  <section class="page-shell" :aria-label="t('app.tabs.cache')">
    <div class="page-action-row">
      <JsonTransferButtons
        :export-label="t('cacheTransfer.export')"
        :import-label="t('cacheTransfer.import')"
        @export="handleExportCache"
        @import="handleImportCache"
      />
      <ElTag size="small" effect="plain">{{ activeModeLabel }}</ElTag>
    </div>
    <section class="cache-block">
      <h2 class="block-title">{{ t('cache.title') }}</h2>
      <p class="block-description">{{ t('cache.description') }}</p>
      <div v-if="activeMode === 'normal'" class="language-tabs">
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
    </section>
    <section v-if="activeMode === 'normal' && activeLanguage" class="table-shell">
      <div class="table-toolbar">
        <span class="table-count">{{ t('cache.entryCount', { count: total }) }}</span>
        <ElSegmented v-model="sortKey" class="sort-selector" :options="sortOptions" size="small" />
      </div>
      <ElTable class="cache-table" :data="entries" size="small" height="300" border>
        <ElTableColumn prop="tid" :label="t('cache.columns.tid')" min-width="116" show-overflow-tooltip />
        <ElTableColumn prop="sourceText" :label="t('cache.columns.source')" min-width="150" show-overflow-tooltip />
        <ElTableColumn :label="t('cache.columns.result')" min-width="150" show-overflow-tooltip>
          <template #default="{ row }: { row: TranslationCacheViewEntry }">
            {{ row.text ?? t('cache.noTranslation') }}
          </template>
        </ElTableColumn>
      </ElTable>
      <ElPagination
        v-model:current-page="page"
        class="pager"
        layout="prev, pager, next"
        :page-size="pageSize"
        :total="total"
        small
      />
    </section>
    <p v-else-if="activeMode === 'normal'" class="empty-text">{{ t('cache.selectLanguage') }}</p>
    <p v-else class="empty-text">{{ t('cache.contextPlaceholder') }}</p>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElPagination, ElSegmented, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import JsonTransferButtons from '../components/common/JsonTransferButtons.vue';
import { useI18n } from '../composables/useI18n';
import { downloadJsonFile } from '../services/jsonFileTransfer';
import {
  TRANSLATION_CACHE_STORAGE_KEYS,
  loadTranslationCacheLanguages,
} from '../services/translationCacheStorage';
import { exportTranslationCacheJson, importTranslationCacheJson } from '../services/translationCacheTransfer';
import { loadTranslationCachePage } from '../services/translationCacheView';
import {
  ACTIVE_TRANSLATION_MODE_KEY,
  loadActiveTranslationMode,
} from '../services/translationModeStorage';
import type {
  TranslationCacheMode,
  TranslationCacheSortKey,
  TranslationCacheViewEntry,
} from '../types/translationCache';

const { t } = useI18n();
const activeMode = ref<TranslationCacheMode>('normal');
const activeLanguage = ref('');
const entries = ref<TranslationCacheViewEntry[]>([]);
const languages = ref<string[]>([]);
const page = ref(1);
const pageSize = 25;
const sortKey = ref<TranslationCacheSortKey>('sourceText');
const total = ref(0);

const activeModeLabel = computed(() => t(`translationMode.${activeMode.value}` as 'translationMode.normal'));
const sortOptions = computed<Array<{ label: string; value: TranslationCacheSortKey }>>(() => [
  { label: t('cache.sort.sourceText'), value: 'sourceText' },
  { label: t('cache.sort.tid'), value: 'tid' },
]);

onMounted(async () => {
  activeMode.value = await loadActiveTranslationMode();
  await refreshCacheView();
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

watch([activeLanguage, sortKey, page], () => {
  void refreshEntries();
});

async function handleLanguageSelect(language: string): Promise<void> {
  activeLanguage.value = language;
  page.value = 1;
  await refreshEntries();
}

async function handleExportCache(): Promise<void> {
  downloadJsonFile(await exportTranslationCacheJson(activeMode.value), `translator-${activeMode.value}-cache`);
  ElMessage.success(t('cacheTransfer.exported'));
}

async function handleImportCache(json: string): Promise<void> {
  try {
    await importTranslationCacheJson(json, activeMode.value);
    activeMode.value = await loadActiveTranslationMode();
    await refreshCacheView();
    ElMessage.success(t('cacheTransfer.imported'));
  } catch {
    ElMessage.error(t('cacheTransfer.importFailed'));
  }
}

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName !== 'local') {
    return;
  }

  if (changes[ACTIVE_TRANSLATION_MODE_KEY]) {
    activeMode.value = await loadActiveTranslationMode();
    activeLanguage.value = '';
  }

  if (changes[ACTIVE_TRANSLATION_MODE_KEY] || changes[TRANSLATION_CACHE_STORAGE_KEYS[activeMode.value]]) {
    await refreshCacheView();
  }
}

async function refreshCacheView(): Promise<void> {
  languages.value = await loadTranslationCacheLanguages(activeMode.value);
  activeLanguage.value = languages.value.includes(activeLanguage.value) ? activeLanguage.value : '';
  page.value = 1;
  await refreshEntries();
}

async function refreshEntries(): Promise<void> {
  if (!activeLanguage.value) {
    entries.value = [];
    total.value = 0;
    return;
  }

  const nextPage = await loadTranslationCachePage(
    activeMode.value,
    activeLanguage.value,
    sortKey.value,
    page.value,
    pageSize,
  );
  entries.value = nextPage.entries;
  total.value = nextPage.total;
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

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cache-block,
.table-shell {
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

.language-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.language-tabs::-webkit-scrollbar {
  display: none;
}

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

.language-tab.active {
  border-color: var(--translator-key-button);
  background: var(--translator-key-button);
  color: var(--translator-button);
  box-shadow: 0 8px 18px var(--translator-shadow);
}

.sort-selector {
  width: 160px;
}

.cache-table {
  --el-table-bg-color: var(--translator-container);
  --el-table-tr-bg-color: var(--translator-container);
  --el-table-header-bg-color: var(--translator-button);
}

.pager {
  justify-content: center;
}
</style>
