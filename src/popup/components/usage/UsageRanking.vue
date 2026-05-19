<template>
  <ol class="ranking-list">
    <li v-if="visibleItems.length === 0" class="empty-item">{{ t('usage.empty') }}</li>
    <li
      v-for="item in visibleItems"
      :key="item.model"
      class="ranking-item"
      :class="{
        active: focusedModel === item.model,
        dimmed: focusedModel && focusedModel !== item.model,
      }"
      @mouseenter="$emit('modelHover', item.model)"
      @mouseleave="$emit('modelHover', undefined)"
      @click="$emit('modelSelect', item.model)"
    >
      <span class="model-cell">
        <span class="color-mark" :style="{ background: item.color }"></span>
        <span class="model-name">{{ item.model }}</span>
      </span>
      <span class="token-value">{{ formatTokens(item.tokens) }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
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

const visibleItems = computed(() => props.items.slice(0, 8));
const focusedModel = computed(() => props.activeModel ?? props.selectedModel);
const { t } = useI18n();

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }

  return String(tokens);
}
</script>

<style scoped>
.ranking-list {
  display: grid;
  gap: 7px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.ranking-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: var(--translator-text);
  cursor: pointer;
  transition:
    color 120ms ease,
    opacity 120ms ease,
    font-weight 120ms ease;
}

.ranking-item.active {
  color: var(--translator-text);
  font-weight: 700;
}

.ranking-item.dimmed {
  opacity: 0.38;
}

.empty-item {
  color: var(--translator-muted);
  font-size: 11px;
}

.model-cell {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.color-mark {
  width: 7px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 2px;
}

.model-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.token-value {
  color: var(--translator-text);
  font-weight: 600;
}
</style>
