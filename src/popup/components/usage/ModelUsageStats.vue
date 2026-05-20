<template>
  <section class="stats-panel">
    <div class="stats-head">
      <h2 class="panel-title">{{ t('usage.title') }}</h2>
      <div class="retention-control">
        <span>{{ t('usage.retentionBefore') }}</span>
        <ElInputNumber
          :model-value="settings.retentionDays"
          size="small"
          :min="1"
          :max="365"
          controls-position="right"
          @change="handleRetentionChange"
        />
        <span>{{ t('usage.retentionAfter') }}</span>
      </div>
    </div>
    <section class="chart-row">
      <UsageBarChart
        class="chart-main"
        :items="dailyUsage"
        :active-model="focusedModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
      <UsageRanking
        class="ranking-side"
        :items="todayRanking"
        :active-model="focusedModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
    </section>
    <section class="detail-row">
      <TokenDistributionPanel :items="distributionItems" />
      <UsagePricePanel
        :prices="currentPrices"
        :input-tokens="currentModelUsage.inputTokens"
        :cached-input-tokens="currentModelUsage.cachedInputTokens"
        :output-tokens="currentModelUsage.outputTokens"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElInputNumber } from 'element-plus';
import { computed, ref } from 'vue';
import { useI18n } from '../../composables/useI18n';
import {
  aggregateDailyUsage,
  aggregateTodayRanking,
  createModelColorMap,
} from '../../services/modelUsageAggregator';
import { pruneUsage } from '../../services/modelUsageStorage';
import type { ApiConfig, ApiPriceConfig, ModelDailyUsage, UsageStatsSettings } from '../../types/api';
import UsageBarChart from './UsageBarChart.vue';
import TokenDistributionPanel from './TokenDistributionPanel.vue';
import UsageRanking from './UsageRanking.vue';
import UsagePricePanel from './UsagePricePanel.vue';

const props = defineProps<{
  activeConfig: ApiConfig;
  configs: ApiConfig[];
  previewConfig?: ApiConfig;
  usage: ModelDailyUsage[];
  settings: UsageStatsSettings;
}>();

const emit = defineEmits<{
  retentionChange: [value: number];
}>();

const { t } = useI18n();
const scopedUsage = computed(() => pruneUsage(props.usage, props.settings.retentionDays));
const colorMap = computed(() => createModelColorMap(scopedUsage.value));
const dailyUsage = computed(() => aggregateDailyUsage(scopedUsage.value, colorMap.value));
const todayRanking = computed(() => aggregateTodayRanking(scopedUsage.value, colorMap.value));
const focusedModel = computed(() => activeModel.value ?? props.previewConfig?.model);
const currentModel = computed(() => focusedModel.value ?? selectedModel.value ?? props.activeConfig.model);
const currentModelUsage = computed(() => summarizeModelUsage(scopedUsage.value, currentModel.value));
const currentPrices = computed(() => resolveModelPrices());
const distributionItems = computed(() => {
  const usage = currentModelUsage.value;
  const totalTokens = usage.inputTokens + usage.cachedInputTokens + usage.outputTokens;

  return [
    createDistributionItem('input', t('usage.inputTokens'), usage.inputTokens, totalTokens, 'var(--translator-model-0)'),
    createDistributionItem('cachedInput', t('usage.cachedInputTokens'), usage.cachedInputTokens, totalTokens, 'var(--translator-model-1)'),
    createDistributionItem('output', t('usage.outputTokens'), usage.outputTokens, totalTokens, 'var(--translator-model-2)'),
  ];
});
const activeModel = ref<string>();
const selectedModel = ref<string>();

function handleRetentionChange(value: number | undefined): void {
  emit('retentionChange', value ?? 30);
}

function handleModelHover(model: string | undefined): void {
  activeModel.value = model;
}

function handleModelSelect(model: string): void {
  selectedModel.value = selectedModel.value === model ? undefined : model;
}

function summarizeModelUsage(usage: ModelDailyUsage[], model: string): {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
} {
  return usage
    .filter((item) => item.model === model)
    .reduce((sum, item) => ({
      cachedInputTokens: sum.cachedInputTokens + item.cachedInputTokens,
      inputTokens: sum.inputTokens + item.inputTokens,
      outputTokens: sum.outputTokens + item.outputTokens,
    }), {
      cachedInputTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
}

function resolveModelPrices(): ApiPriceConfig {
  const config = activeModel.value
    ? findConfigByModel(activeModel.value)
    : props.previewConfig ?? findConfigByModel(currentModel.value) ?? props.activeConfig;

  return config ?? {
    cachedInputTokenPrice: 0,
    inputTokenPrice: 0,
    outputTokenPrice: 0,
  };
}

function findConfigByModel(model: string): ApiConfig | undefined {
  const normalizedModel = model.trim();
  return props.configs.find((item) => item.model.trim() === normalizedModel);
}

function createDistributionItem(
  key: string,
  label: string,
  tokens: number,
  totalTokens: number,
  color: string,
): { color: string; key: string; label: string; percent: number; tokens: number } {
  return {
    color,
    key,
    label,
    percent: totalTokens > 0 ? Math.round((tokens / totalTokens) * 1000) / 10 : 0,
    tokens,
  };
}
</script>

<style scoped>
.stats-panel {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
}

.stats-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--translator-text);
}

.retention-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--translator-muted);
  font-size: 11px;
}

.retention-control :deep(.el-input-number) {
  width: 84px;
}

.chart-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px;
  gap: 10px;
  align-items: stretch;
}

.chart-main {
  min-width: 0;
}

.ranking-side {
  min-width: 0;
}

.detail-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
