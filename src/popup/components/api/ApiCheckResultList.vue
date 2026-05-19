<template>
  <section class="result-panel">
    <h2 class="panel-title">上一次测试信息:</h2>
    <ul class="check-list">
      <li v-for="item in results" :key="item.key" class="check-item">
        <span>{{ item.label }}</span>
        <span class="check-value">
          <span v-if="item.durationMs && item.passed" class="duration">{{ formatDuration(item) }}</span>
          <span :class="getStateClass(item)">{{ formatState(item) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { ApiCheckResult } from '../../types/api';

defineProps<{
  results: ApiCheckResult[];
}>();

function formatDuration(item: ApiCheckResult): string {
  if (item.tokenPerSecond !== undefined) {
    return `${item.durationMs}ms ${item.tokenPerSecond}/s`;
  }

  return `${item.durationMs}ms`;
}

function formatState(item: ApiCheckResult): string {
  if (item.status === 'running') {
    return '...';
  }

  return item.passed ? '√' : '×';
}

function getStateClass(item: ApiCheckResult): string {
  if (item.status === 'running') {
    return 'running';
  }

  return item.passed ? 'passed' : 'failed';
}
</script>

<style scoped>
.result-panel {
  padding: 12px;
  border: 1px solid #edf1f5;
  border-radius: 8px;
  background: #ffffff;
}

.panel-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.check-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.check-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  color: #334155;
}

.check-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.duration {
  color: #64748b;
}

.passed {
  color: #16a34a;
  font-weight: 700;
}

.running {
  color: #2563eb;
  font-weight: 700;
}

.failed {
  color: #dc2626;
  font-weight: 700;
}
</style>
