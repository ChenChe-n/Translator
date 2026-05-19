<template>
  <div class="bar-chart">
    <div v-if="items.length === 0" class="empty-chart"></div>
    <div v-for="item in normalizedItems" :key="item.date" class="bar-column">
      <div class="bar-track">
        <button
          v-for="segment in item.segments"
          :key="segment.model"
          class="bar-segment"
          type="button"
          :class="{
            active: focusedModel === segment.model,
            dimmed: focusedModel && focusedModel !== segment.model,
          }"
          :style="{ height: `${segment.height}%`, background: segment.color }"
          @mouseenter="$emit('modelHover', segment.model)"
          @mouseleave="$emit('modelHover', undefined)"
          @click="$emit('modelSelect', segment.model)"
        ></button>
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
  activeModel?: string;
  selectedModel?: string;
}>();

defineEmits<{
  modelHover: [model: string | undefined];
  modelSelect: [model: string];
}>();

const focusedModel = computed(() => props.activeModel ?? props.selectedModel);

const normalizedItems = computed(() => {
  const maxTokens = Math.max(...props.items.map((item) => item.totalTokens), 1);

  return props.items.map((item) => ({
    date: item.date,
    label: item.date.slice(5),
    segments: item.segments.map((segment) => ({
      ...segment,
      height: (segment.tokens / maxTokens) * 100,
    })),
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
  background: var(--translator-button);
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
  flex-direction: column-reverse;
  justify-content: flex-start;
  border-radius: 4px;
  background: var(--translator-button);
  overflow: hidden;
}

.bar-segment {
  width: 100%;
  min-height: 3px;
  padding: 0;
  border: 0;
  cursor: pointer;
  transition:
    opacity 120ms ease,
    filter 120ms ease;
}

.bar-segment.active {
  filter: brightness(1.08);
}

.bar-segment.dimmed {
  opacity: 0.28;
}

.bar-label {
  max-width: 34px;
  overflow: hidden;
  color: var(--translator-muted);
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
