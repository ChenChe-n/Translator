<template>
  <section class="call-card">
    <div class="call-head">
      <h2 class="panel-title">{{ t('monitor.modelCallsTitle') }}</h2>
      <ElTag size="small" effect="plain">{{ t('monitor.modelCallsDescription', { count: logs.length }) }}</ElTag>
    </div>
    <ElEmpty v-if="logs.length === 0" :description="t('monitor.emptyModelCalls')" :image-size="48" />
    <div v-else class="call-list">
      <article v-for="log in orderedLogs" :key="log.id" class="call-item">
        <div class="meta-row">
          <span class="model-name">{{ log.model || '-' }}</span>
          <span class="call-time">{{ formatDateTime(log.createdAt) }}</span>
          <span class="status-pill" :class="log.status">{{ formatStatus(log) }}</span>
        </div>
        <div class="payload-grid">
          <section class="payload-box">
            <span class="payload-label">{{ t('monitor.modelCallInput') }}</span>
            <pre>{{ log.input }}</pre>
          </section>
          <section class="payload-box">
            <span class="payload-label">{{ t('monitor.modelCallOutput') }}</span>
            <pre>{{ log.output || log.errorMessage || '' }}</pre>
          </section>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ElEmpty, ElTag } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { ModelCallLog } from '../../types/modelCall';

const props = defineProps<{
  logs: ModelCallLog[];
}>();

const { t } = useI18n();
const orderedLogs = computed(() => [...props.logs].sort((a, b) => b.createdAt - a.createdAt));

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatStatus(log: ModelCallLog): string {
  if (log.status === 'error') {
    return t('monitor.modelCallError');
  }

  return log.status === 'finished' ? t('monitor.modelCallFinished') : t('monitor.modelCallRunning');
}
</script>

<style scoped>
.call-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
}

.call-head,
.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.call-list {
  display: grid;
  gap: 10px;
}

.call-item {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
}

.model-name {
  min-width: 0;
  overflow: hidden;
  color: var(--translator-text);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  color: var(--translator-muted);
  font-size: 11px;
  white-space: nowrap;
}

.status-pill {
  padding: 2px 6px;
  border-radius: 999px;
  color: var(--translator-button);
  font-size: 11px;
  white-space: nowrap;
}

.status-pill.running {
  background: var(--translator-key-button);
}

.status-pill.finished {
  background: var(--translator-marker);
}

.status-pill.error {
  background: #ef4444;
}

.payload-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.payload-box {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.payload-label {
  color: var(--translator-muted);
  font-size: 11px;
}

pre {
  height: 86px;
  margin: 0;
  overflow: auto;
  padding: 8px;
  border-radius: 6px;
  background: var(--translator-container);
  color: var(--translator-text);
  font-family: Consolas, "SFMono-Regular", monospace;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
