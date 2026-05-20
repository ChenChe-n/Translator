<template>
  <section class="detail-panel">
    <h3 class="detail-title">{{ t('usage.distributionTitle') }}</h3>
    <div class="distribution-list">
      <div v-for="item in items" :key="item.key" class="distribution-item">
        <span class="item-label">{{ item.label }}</span>
        <span class="item-value">{{ formatTokens(item.tokens) }}</span>
        <span class="track">
          <span class="track-fill" :style="{ width: `${item.percent}%`, background: item.color }"></span>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';

defineProps<{
  items: Array<{
    color: string;
    key: string;
    label: string;
    percent: number;
    tokens: number;
  }>;
}>();

const { t } = useI18n();

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }

  return String(tokens);
}
</script>

<style scoped>
.detail-panel {
  min-width: 0;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
}

.detail-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 12px;
  font-weight: 600;
}

.distribution-list {
  display: grid;
  gap: 8px;
}

.distribution-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  color: var(--translator-text);
  font-size: 11px;
}

.item-label,
.item-value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item-value {
  font-weight: 600;
}

.track {
  grid-column: 1 / -1;
  height: 6px;
  border-radius: 999px;
  background: var(--translator-container);
  overflow: hidden;
}

.track-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
}
</style>
