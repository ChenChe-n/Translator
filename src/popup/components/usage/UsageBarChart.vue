<template>
  <div class="bar-chart">
    <div v-if="normalizedItems.length === 0" class="empty-chart"></div>
    <div v-for="item in normalizedItems" :key="item.date" class="bar-column">
      <div class="bar-track">
        <div class="bar-fill" :style="{ height: `${item.height}%` }"></div>
      </div>
      <span class="bar-label">{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DailyUsageChartItem } from '../../services/modelUsageAggregator';

const props = defineProps<{
  items: DailyUsageChartItem[];
}>();

const normalizedItems = computed(() => {
  const maxTokens = Math.max(...props.items.map((item) => item.totalTokens), 1);

  return props.items.map((item) => ({
    date: item.date,
    height: Math.max(6, (item.totalTokens / maxTokens) * 100),
    label: item.date.slice(5),
  }));
});
</script>

<style scoped>
.bar-chart {
  min-height: 118px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(16px, 1fr);
  align-items: end;
  gap: 5px;
  padding: 8px 2px 0;
}

.empty-chart {
  height: 92px;
  border-radius: 6px;
  background:
    repeating-linear-gradient(
      90deg,
      #eef2f7 0,
      #eef2f7 10px,
      transparent 10px,
      transparent 18px
    );
}

.bar-column {
  min-width: 0;
  display: grid;
  gap: 5px;
  justify-items: center;
}

.bar-track {
  width: 100%;
  height: 92px;
  display: flex;
  align-items: end;
  border-radius: 4px;
  background: #eef2f7;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
}

.bar-label {
  max-width: 34px;
  overflow: hidden;
  color: #64748b;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
