<template>
  <ol class="ranking-list">
    <li v-if="visibleItems.length === 0" class="empty-item">暂无数据</li>
    <li v-for="item in visibleItems" :key="item.model" class="ranking-item">
      <span class="model-name">{{ item.model }}</span>
      <span class="token-value">{{ formatTokens(item.tokens) }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ModelUsageRankItem } from '../../services/modelUsageAggregator';

const props = defineProps<{
  items: ModelUsageRankItem[];
}>();

const visibleItems = computed(() => props.items.slice(0, 8));

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
  color: #334155;
}

.empty-item {
  color: #94a3b8;
  font-size: 11px;
}

.model-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.token-value {
  color: #0f172a;
  font-weight: 600;
}
</style>
