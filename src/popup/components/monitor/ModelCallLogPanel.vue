<template>
  <section class="call-card">
    <div class="call-head">
      <h2 class="panel-title">{{ t('monitor.modelCallsTitle') }}</h2>
      <ElTag size="small" effect="plain">{{ t('monitor.modelCallsDescription', { count: logs.length }) }}</ElTag>
    </div>
    <ElEmpty v-if="logs.length === 0" :description="t('monitor.emptyModelCalls')" :image-size="48" />
    <div v-else class="call-list">
      <article v-for="log in orderedLogs" :key="log.id" class="call-item">
        <button class="summary-row" type="button" @click="toggleExpanded(log.id)">
          <span class="model-name">{{ log.model || '-' }}</span>
          <span class="call-time">{{ formatDateTime(log.createdAt) }}</span>
          <span class="token-count">{{ formatTokenCount(log) }}</span>
          <span class="status-pill" :class="log.status">{{ formatStatus(log) }}</span>
        </button>
        <div v-if="expandedIds.has(log.id)" class="payload-grid">
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
import { computed, ref } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { ModelCallLog } from '../../types/modelCall';

const props = defineProps<{
  logs: ModelCallLog[];
}>();

const { t } = useI18n();
const expandedIds = ref(new Set<string>());
const orderedLogs = computed(() => [...props.logs].sort((a, b) => b.createdAt - a.createdAt));

function toggleExpanded(id: string): void {
  const nextIds = new Set(expandedIds.value);

  if (nextIds.has(id)) {
    nextIds.delete(id);
  } else {
    nextIds.add(id);
  }

  expandedIds.value = nextIds;
}

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function formatTokenCount(log: ModelCallLog): string {
  return t('monitor.modelCallTokens', { count: estimateTokenCount(log.input) + estimateTokenCount(log.output) });
}

function formatStatus(log: ModelCallLog): string {
  if (log.status === 'error') {
    return t('monitor.modelCallError');
  }

  return log.status === 'finished' ? t('monitor.modelCallFinished') : t('monitor.modelCallRunning');
}

function estimateTokenCount(content: string): number {
  return Math.max(0, Math.round(content.trim().length / 4));
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
.summary-row {
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
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
}

.summary-row {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.model-name {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 96px;
  overflow: hidden;
  color: var(--translator-text);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  flex: 0 0 auto;
  color: var(--translator-muted);
  font-size: 11px;
  white-space: nowrap;
}

.token-count {
  flex: 0 0 auto;
  color: var(--translator-muted);
  font-size: 11px;
  white-space: nowrap;
}

.status-pill {
  flex: 0 0 auto;
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
