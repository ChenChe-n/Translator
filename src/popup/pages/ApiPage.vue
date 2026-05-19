<template>
  <section class="page-shell" aria-label="api">
    <ApiConfigForm v-model="config" />
    <ElButton type="primary" class="test-button" :loading="testing" @click="handleRunChecks">测试</ElButton>
    <section class="result-panel">
      <h2 class="panel-title">上一次测试信息:</h2>
      <ul class="check-list">
        <li v-for="item in checkResults" :key="item.key" class="check-item">
          <span>{{ item.label }}</span>
          <span :class="item.passed ? 'passed' : 'failed'">{{ item.passed ? '√' : '×' }}</span>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElButton, ElMessage } from 'element-plus';
import { onMounted, ref } from 'vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import { runApiHealthChecks } from '../services/apiHealthChecks';
import { loadApiConfig, saveApiConfig } from '../services/apiConfigStorage';
import type { ApiCheckResult, ApiConfig } from '../types/api';

const config = ref<ApiConfig>({
  baseUrl: '',
  apiKey: '',
  model: '',
});

const testing = ref(false);
const checkResults = ref<ApiCheckResult[]>(createPendingResults());

onMounted(async () => {
  config.value = await loadApiConfig();
});

async function handleRunChecks(): Promise<void> {
  testing.value = true;

  try {
    ensureConfig();
    await saveApiConfig({ ...config.value });
    checkResults.value = await runApiHealthChecks(config.value);
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

function createPendingResults(): ApiCheckResult[] {
  return [
    {
      key: 'basicText',
      label: '基本文本输入输出',
      passed: false,
      message: '未测试',
    },
    {
      key: 'jsonOutput',
      label: 'json结构化输出',
      passed: false,
      message: '未测试',
    },
    {
      key: 'imageUnderstanding',
      label: '图片理解',
      passed: false,
      message: '未测试',
    },
    {
      key: 'streamOutput',
      label: '流式输出',
      passed: false,
      message: '未测试',
    },
  ];
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
  font-size: 13px;
  color: #334155;
}

.passed {
  color: #16a34a;
  font-weight: 700;
}

.failed {
  color: #dc2626;
  font-weight: 700;
}
</style>
