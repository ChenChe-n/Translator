<template>
  <section class="stats-panel">
    <div class="stats-head">
      <h2 class="panel-title">模型token使用统计</h2>
      <div class="retention-control">
        <span>保留</span>
        <ElInputNumber
          :model-value="settings.retentionDays"
          size="small"
          :min="1"
          :max="365"
          controls-position="right"
          @change="handleRetentionChange"
        />
        <span>天</span>
      </div>
    </div>
    <section class="chart-row">
      <UsageBarChart
        class="chart-main"
        :items="dailyUsage"
        :active-model="activeModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
      <UsageRanking
        class="ranking-side"
        :items="todayRanking"
        :active-model="activeModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
    </section>
    <section class="chart-row">
      <UsagePieChart
        class="chart-main"
        :items="totalRanking"
        :active-model="activeModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
      <UsageRanking
        class="ranking-side"
        :items="totalRanking"
        :active-model="activeModel"
        :selected-model="selectedModel"
        @model-hover="handleModelHover"
        @model-select="handleModelSelect"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElInputNumber } from 'element-plus';
import { computed, ref } from 'vue';
import {
  aggregateDailyUsage,
  aggregateModelRanking,
  aggregateTodayRanking,
  createModelColorMap,
} from '../../services/modelUsageAggregator';
import { pruneUsage } from '../../services/modelUsageStorage';
import type { ModelDailyUsage, UsageStatsSettings } from '../../types/api';
import UsageBarChart from './UsageBarChart.vue';
import UsagePieChart from './UsagePieChart.vue';
import UsageRanking from './UsageRanking.vue';

const props = defineProps<{
  usage: ModelDailyUsage[];
  settings: UsageStatsSettings;
}>();

const emit = defineEmits<{
  retentionChange: [value: number];
}>();

const scopedUsage = computed(() => pruneUsage(props.usage, props.settings.retentionDays));
const colorMap = computed(() => createModelColorMap(scopedUsage.value));
const dailyUsage = computed(() => aggregateDailyUsage(scopedUsage.value, colorMap.value));
const todayRanking = computed(() => aggregateTodayRanking(scopedUsage.value, colorMap.value));
const totalRanking = computed(() => aggregateModelRanking(scopedUsage.value, colorMap.value));
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
</style>
