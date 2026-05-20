<template>
  <section class="stats-panel" :aria-label="t('cache.monitorTitle')">
    <h2 class="panel-title">{{ t('cache.monitorTitle') }}</h2>
    <div class="stats-row">
      <span class="stat-label">{{ t('translationMode.normal') }}</span>
      <strong class="stat-value">{{ normalCount }}</strong>
    </div>
    <div class="stats-row muted">
      <span class="stat-label">{{ t('translationMode.context') }}</span>
      <strong class="stat-value">{{ contextCount }}</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from '../../composables/useI18n';

defineProps<{
  contextCount: number;
  normalCount: number;
}>();

const { t } = useI18n();
</script>

<style scoped>
.stats-panel {
  display: grid;
  gap: 8px;
}

.panel-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.stats-row {
  min-height: 30px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 0 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
}

.stats-row.muted {
  opacity: 0.72;
}

.stat-label {
  color: var(--translator-muted);
  font-size: 12px;
}

.stat-value {
  color: var(--translator-text);
  font-size: 14px;
}
</style>
