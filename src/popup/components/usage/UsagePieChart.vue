<template>
  <div class="pie-wrap">
    <svg class="pie" viewBox="0 0 120 120" role="img" aria-label="模型使用率">
      <circle v-if="segments.length === 0" cx="60" cy="60" r="45" fill="var(--translator-button)" />
      <path
        v-for="segment in segments"
        :key="segment.model"
        :d="segment.path"
        :fill="segment.color"
        :class="{
          active: focusedModel === segment.model,
          dimmed: focusedModel && focusedModel !== segment.model,
        }"
        @mouseenter="$emit('modelHover', segment.model)"
        @mouseleave="$emit('modelHover', undefined)"
        @click="$emit('modelSelect', segment.model)"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ModelUsageRankItem } from '../../services/modelUsageAggregator';

const props = defineProps<{
  items: ModelUsageRankItem[];
  activeModel?: string;
  selectedModel?: string;
}>();

defineEmits<{
  modelHover: [model: string | undefined];
  modelSelect: [model: string];
}>();

const focusedModel = computed(() => props.activeModel ?? props.selectedModel);

const segments = computed(() => {
  const totalTokens = props.items.reduce((sum, item) => sum + item.tokens, 0);
  let cursor = 0;

  return props.items.map((item) => {
    const start = cursor;
    const percent = totalTokens > 0 ? (item.tokens / totalTokens) * 100 : 0;
    const end = cursor + percent;
    cursor = end;

    return {
      ...item,
      path: createArcPath(start, end),
    };
  });
});

function createArcPath(startPercent: number, endPercent: number): string {
  const center = 60;
  const radius = 45;
  const start = getPoint(center, radius, startPercent);
  const end = getPoint(center, radius, endPercent);
  const largeArc = endPercent - startPercent > 50 ? 1 : 0;
  return `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function getPoint(center: number, radius: number, percent: number): { x: number; y: number } {
  const angle = ((percent / 100) * 360 - 90) * (Math.PI / 180);

  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}
</script>

<style scoped>
.pie-wrap {
  min-height: 140px;
  display: grid;
  place-items: center;
}

.pie {
  width: 128px;
  height: 128px;
  filter: drop-shadow(0 10px 18px var(--translator-shadow));
}

.pie path {
  cursor: pointer;
  transition:
    opacity 120ms ease,
    transform 120ms ease;
  transform-origin: center;
}

.pie path.active {
  transform: scale(1.03);
}

.pie path.dimmed {
  opacity: 0.28;
}
</style>
