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
          <span class="call-time">{{ formatFullDateTime(log.createdAt) }}</span>
          <span class="token-count">{{ formatTokenSummary(log) }}</span>
          <span class="duration-text">{{ formatDuration(log) }}</span>
          <span class="status-pill" :class="statusClass(log)">{{ formatStatus(log) }}</span>
        </button>
        <div v-if="expandedIds.has(log.id)" class="call-detail">
          <dl class="meta-grid">
            <div>
              <dt>{{ t('monitor.modelCallId') }}</dt>
              <dd>{{ log.id }}</dd>
            </div>
            <div>
              <dt>{{ t('monitor.modelCallCreatedAt') }}</dt>
              <dd>{{ formatFullDateTime(log.createdAt) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitor.modelCallUpdatedAt') }}</dt>
              <dd>{{ formatFullDateTime(log.updatedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitor.modelCallDuration') }}</dt>
              <dd>{{ formatDuration(log) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitor.modelCallInputTokens') }}</dt>
              <dd>{{ readRequestTokens(log) }}</dd>
            </div>
            <div>
              <dt>{{ t('monitor.modelCallOutputTokens') }}</dt>
              <dd>{{ readResponseTokens(log) }}</dd>
            </div>
          </dl>
          <section v-if="log.errorMessage" class="payload-box">
            <span class="payload-label">{{ t('monitor.modelCallErrorDetail') }}</span>
            <pre>{{ log.errorMessage }}</pre>
          </section>
          <section class="payload-box">
            <span class="payload-label">{{ t('monitor.modelCallRequest') }}</span>
            <pre>{{ log.input }}</pre>
          </section>
          <section class="payload-box">
            <span class="payload-label">{{ t('monitor.modelCallResponse') }}</span>
            <pre>{{ log.output || '' }}</pre>
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
  nextIds.has(id) ? nextIds.delete(id) : nextIds.add(id);
  expandedIds.value = nextIds;
}

function formatFullDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTokenSummary(log: ModelCallLog): string {
  return t('monitor.modelCallTokenSummary', {
    input: readRequestTokens(log),
    output: readResponseTokens(log),
  });
}

function formatDuration(log: ModelCallLog): string {
  const duration = log.durationMs ?? Math.max(0, log.updatedAt - log.createdAt);
  return t('monitor.modelCallDurationMs', { count: duration });
}

function formatStatus(log: ModelCallLog): string {
  if (log.status === 'error') {
    return t('monitor.modelCallError');
  }

  if (isStaleRunning(log)) {
    return t('monitor.modelCallStaleRunning');
  }

  return log.status === 'finished' ? t('monitor.modelCallFinished') : t('monitor.modelCallRunning');
}

function statusClass(log: ModelCallLog): string {
  return isStaleRunning(log) ? 'stale' : log.status;
}

function isStaleRunning(log: ModelCallLog): boolean {
  return log.status === 'running' && Date.now() - log.updatedAt > 60_000;
}

function readRequestTokens(log: ModelCallLog): number {
  return log.requestTokens ?? estimateTokenCount(log.input);
}

function readResponseTokens(log: ModelCallLog): number {
  return log.responseTokens ?? estimateTokenCount(log.output);
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

.panel-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.call-list,
.call-detail {
  display: grid;
  gap: 8px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.call-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.call-time,
.duration-text,
.token-count {
  flex: 0 0 auto;
  color: var(--translator-muted);
  font-size: 11px;
  white-space: nowrap;
}

.model-name,
.meta-grid dd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-name {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 96px;
  color: var(--translator-text);
  font-size: 12px;
  font-weight: 600;
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

.status-pill.stale {
  background: #f59e0b;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 8px;
  margin: 0;
}

.meta-grid div {
  min-width: 0;
}

.meta-grid dt {
  color: var(--translator-muted);
  font-size: 11px;
}

.meta-grid dd {
  margin: 2px 0 0;
  color: var(--translator-text);
  font-size: 11px;
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
  max-height: 240px;
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

@media (max-width: 520px) {
  .summary-row {
    flex-wrap: wrap;
  }

  .meta-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
