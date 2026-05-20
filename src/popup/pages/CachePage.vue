<template>
  <section class="page-shell" :aria-label="t('app.tabs.cache')">
    <div class="page-action-row">
      <JsonTransferButtons
        :export-label="t('cacheTransfer.export')"
        :import-label="t('cacheTransfer.import')"
        @export="handleExportCache"
        @import="handleImportCache"
      />
      <div class="cache-action-right">
        <ElTag size="small" effect="plain">{{ activeModeLabel }}</ElTag>
        <PageClearButton @clear="handleClearCache" />
      </div>
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
      <ElTable class="cache-table" :data="entries" size="small" table-layout="fixed" border>
        <ElTableColumn prop="tid" :label="t('cache.columns.tid')" width="78" show-overflow-tooltip />
        <ElTableColumn prop="sourceText" :label="t('cache.columns.source')" min-width="112" show-overflow-tooltip />
        <ElTableColumn :label="t('cache.columns.result')" min-width="112" show-overflow-tooltip>
          <template #default="{ row }: { row: TranslationCacheViewEntry }">
            {{ row.text ?? t('cache.noTranslation') }}
          </template>
        </ElTableColumn>
      </ElTable>
      <ElPagination
        v-model:current-page="page"
        class="pager"
        layout="prev, pager, next, jumper"
        :page-size="pageSize"
        :pager-count="5"
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
import PageClearButton from '../components/common/PageClearButton.vue';
import JsonTransferButtons from '../components/common/JsonTransferButtons.vue';
import { useI18n } from '../composables/useI18n';
import { downloadJsonFile } from '../services/jsonFileTransfer';
import {
  TRANSLATION_CACHE_STORAGE_KEYS,
  clearContextTranslationCache,
  clearNormalTranslationCache,
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
const pageSize = 10;
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

async function handleClearCache(): Promise<void> {
  if (activeMode.value === 'normal') {
    await clearNormalTranslationCache();
  } else {
    await clearContextTranslationCache();
  }

  activeLanguage.value = '';
  await refreshCacheView();
  ElMessage.success(t('common.cleared'));
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
.page-shell { width: 100%; height: 100%; display: grid; grid-template-rows: auto auto minmax(0, 1fr); gap: 8px; align-content: start; padding: 10px; background: var(--translator-background); overflow: hidden; }

.table-toolbar,
.cache-action-right { display: flex; align-items: center; gap: 6px; }

.table-toolbar { justify-content: space-between; }

.cache-action-right { display: inline-flex; }

.cache-block,
.table-shell { display: grid; grid-template-rows: auto minmax(0, auto) auto; gap: 6px; min-height: 0; }

.block-title { margin: 0; color: var(--translator-text); font-size: 13px; font-weight: 600; line-height: 16px; }

.block-description,
.empty-text,
.table-count { margin: 0; color: var(--translator-muted); font-size: 11px; line-height: 1.35; }

.language-tabs {
  display: flex;
  gap: 6px;
  max-height: 28px;
  overflow: hidden;
}

.language-tab { height: 28px; flex: 0 0 auto; min-width: 80px; padding: 0 10px; border: 1px solid var(--translator-border); border-radius: 8px; background: var(--translator-button); color: var(--translator-text); font-size: 12px; cursor: pointer; }

.language-tab.active { border-color: var(--translator-key-button); background: var(--translator-key-button); color: var(--translator-button); box-shadow: 0 8px 18px var(--translator-shadow); }

.sort-selector {
  width: 136px;
}

.cache-table {
  --el-table-bg-color: var(--translator-container);
  --el-table-tr-bg-color: var(--translator-container);
  --el-table-header-bg-color: var(--translator-button);
  width: 100%;
}

.cache-table :deep(.el-table__cell) {
  padding: 1px 0;
}

.cache-table :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.cache-table :deep(.el-table__body-wrapper),
.cache-table :deep(.el-scrollbar),
.cache-table :deep(.el-scrollbar__wrap) {
  overflow: hidden;
}

.cache-table :deep(.cell) {
  overflow: hidden;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pager {
  height: 24px;
  max-width: 100%;
  justify-content: center;
  overflow: hidden;
}

.pager :deep(.btn-prev),
.pager :deep(.btn-next),
.pager :deep(.el-pager li) {
  min-width: 22px;
  width: 22px;
  height: 22px;
  font-size: 11px;
}

.pager :deep(.el-pagination__jump) {
  margin-left: 4px;
}

.pager :deep(.el-pagination__goto),
.pager :deep(.el-pagination__classifier) {
  display: none;
}

.pager :deep(.el-input__wrapper) {
  width: 42px;
  padding: 0 4px;
}
</style>
