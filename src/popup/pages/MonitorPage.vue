<template>
  <section class="page-shell" :aria-label="t('app.tabs.monitor')">
    <TextParseDurationChart :metrics="metrics" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import TextParseDurationChart from '../components/monitor/TextParseDurationChart.vue';
import { TEXT_PARSE_METRICS_KEY, loadTextParseMetrics } from '../services/textParseMetricsStorage';
import type { TextParseMetric } from '../types/textParseMetrics';

const { t } = useI18n();
const metrics = ref<TextParseMetric[]>([]);

onMounted(async () => {
  metrics.value = await loadTextParseMetrics();
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName === 'local' && changes[TEXT_PARSE_METRICS_KEY]) {
    metrics.value = await loadTextParseMetrics();
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
