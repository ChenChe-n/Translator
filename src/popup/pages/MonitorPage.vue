<template>
  <section class="page-shell" :aria-label="t('app.tabs.monitor')">
    <TextParseDurationChart :metrics="metrics" />
    <ModelCallLogPanel :logs="modelCallLogs" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import ModelCallLogPanel from '../components/monitor/ModelCallLogPanel.vue';
import TextParseDurationChart from '../components/monitor/TextParseDurationChart.vue';
import { MODEL_CALL_LOG_KEY, loadModelCallLogs } from '../services/modelCallLogStorage';
import { TEXT_PARSE_METRICS_KEY, loadTextParseMetrics } from '../services/textParseMetricsStorage';
import type { ModelCallLog } from '../types/modelCall';
import type { TextParseMetric } from '../types/textParseMetrics';

const { t } = useI18n();
const metrics = ref<TextParseMetric[]>([]);
const modelCallLogs = ref<ModelCallLog[]>([]);

onMounted(async () => {
  [metrics.value, modelCallLogs.value] = await Promise.all([loadTextParseMetrics(), loadModelCallLogs()]);
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName === 'local' && changes[TEXT_PARSE_METRICS_KEY]) {
    metrics.value = await loadTextParseMetrics();
  }

  if (areaName === 'local' && changes[MODEL_CALL_LOG_KEY]) {
    modelCallLogs.value = await loadModelCallLogs();
  }
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
