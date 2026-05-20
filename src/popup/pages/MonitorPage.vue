<template>
  <section class="page-shell" :aria-label="t('app.tabs.monitor')">
    <div class="page-action-row">
      <JsonTransferButtons
        :allow-import="false"
        :export-label="t('monitorTransfer.export')"
        @export="handleExportMonitorData"
      />
      <PageClearButton @clear="handleClearPage" />
    </div>
    <CacheStatsPanel :normal-count="cacheStats.normal" :context-count="cacheStats.context" />
    <TextParseDurationChart :metrics="metrics" />
    <ModelCallLogPanel :logs="modelCallLogs" />
  </section>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import JsonTransferButtons from '../components/common/JsonTransferButtons.vue';
import PageClearButton from '../components/common/PageClearButton.vue';
import CacheStatsPanel from '../components/monitor/CacheStatsPanel.vue';
import ModelCallLogPanel from '../components/monitor/ModelCallLogPanel.vue';
import TextParseDurationChart from '../components/monitor/TextParseDurationChart.vue';
import { MODEL_CALL_LOG_KEY, clearModelCallLogs, loadModelCallLogs } from '../services/modelCallLogStorage';
import { TEXT_PARSE_METRICS_KEY, clearTextParseMetrics, loadTextParseMetrics } from '../services/textParseMetricsStorage';
import { TRANSLATION_CACHE_STORAGE_KEYS } from '../services/translationCacheKeys';
import { loadTranslationCacheStats } from '../services/translationCacheStorage';
import { downloadJsonFile } from '../services/jsonFileTransfer';
import { exportMonitorDataJson } from '../services/monitorDataExport';
import type { ModelCallLog } from '../types/modelCall';
import type { TextParseMetric } from '../types/textParseMetrics';

const { t } = useI18n();
const metrics = ref<TextParseMetric[]>([]);
const modelCallLogs = ref<ModelCallLog[]>([]);
const cacheStats = ref({
  normal: 0,
  context: 0,
});

onMounted(async () => {
  [metrics.value, modelCallLogs.value] = await Promise.all([loadTextParseMetrics(), loadModelCallLogs()]);
  await refreshCacheStats();
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

async function handleClearPage(): Promise<void> {
  await Promise.all([clearTextParseMetrics(), clearModelCallLogs()]);
  metrics.value = [];
  modelCallLogs.value = [];
  ElMessage.success(t('common.cleared'));
}

async function handleExportMonitorData(): Promise<void> {
  downloadJsonFile(await exportMonitorDataJson(), 'translator-monitor-data');
  ElMessage.success(t('monitorTransfer.exported'));
}

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName === 'local' && changes[TEXT_PARSE_METRICS_KEY]) {
    metrics.value = await loadTextParseMetrics();
  }

  if (areaName === 'local' && changes[MODEL_CALL_LOG_KEY]) {
    modelCallLogs.value = await loadModelCallLogs();
  }

  if (areaName === 'local' && shouldRefreshCacheStats(changes)) {
    await refreshCacheStats();
  }
}

async function refreshCacheStats(): Promise<void> {
  const [normalStats, contextStats] = await Promise.all([
    loadTranslationCacheStats('normal'),
    loadTranslationCacheStats('context'),
  ]);
  cacheStats.value = {
    normal: normalStats.count,
    context: contextStats.count,
  };
}

function shouldRefreshCacheStats(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return Object.values(TRANSLATION_CACHE_STORAGE_KEYS).some((key) => Boolean(changes[key]));
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

</style>
