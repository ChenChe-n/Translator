<template>
  <section class="page-shell" aria-label="api">
    <ApiConfigForm v-model="config" />
    <ElButton type="primary" class="test-button" :loading="testing" @click="handleRunChecks">测试</ElButton>
    <section class="result-panel">
      <h2 class="panel-title">上一次测试信息:</h2>
      <ul class="check-list">
        <li v-for="item in checkResults" :key="item.key" class="check-item">
          <span>{{ item.label }}</span>
          <span class="check-value">
            <span v-if="item.durationMs && item.passed" class="duration">{{ formatDuration(item) }}</span>
            <span :class="getStateClass(item)">{{ formatState(item) }}</span>
          </span>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElButton, ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import { createDefaultApiCheckResults, runApiHealthChecks } from '../services/apiHealthChecks';
import {
  loadApiCheckResults,
  loadApiConfig,
  saveApiCheckResults,
  saveApiConfig,
} from '../services/apiConfigStorage';
import type { ApiCheckResult, ApiConfig } from '../types/api';

const config = ref<ApiConfig>({
  baseUrl: '',
  apiKey: '',
  model: '',
});

const testing = ref(false);
const checkResults = ref<ApiCheckResult[]>(createDefaultApiCheckResults());

onMounted(async () => {
  const [storedConfig, storedResults] = await Promise.all([loadApiConfig(), loadApiCheckResults()]);
  config.value = storedConfig;

  if (storedResults.length > 0) {
    checkResults.value = mergeResults(storedResults);
  }
});

async function handleRunChecks(): Promise<void> {
  testing.value = true;

  try {
    ensureConfig();
    await saveApiConfig({ ...config.value });

    for await (const result of runApiHealthChecks(config.value)) {
      updateCheckResult(result);
      await saveApiCheckResults(checkResults.value);
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '测试失败');
  } finally {
    testing.value = false;
  }
}

function ensureConfig(): void {
  if (!config.value.baseUrl || !config.value.apiKey || !config.value.model) {
    throw new Error('请先填写 URL、Key 和模型。');
  }
}

function updateCheckResult(result: ApiCheckResult): void {
  checkResults.value = checkResults.value.map((item) => (item.key === result.key ? result : item));
}

function mergeResults(results: ApiCheckResult[]): ApiCheckResult[] {
  return createDefaultApiCheckResults().map((item) => {
    const stored = results.find((result) => result.key === item.key);

    if (!stored) {
      return item;
    }

    return {
      ...item,
      ...stored,
      status: stored.status ?? 'finished',
    };
  });
}

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
.page-shell {
  width: 100%;
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
}

.test-button {
  width: 100%;
  height: 38px;
}

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
