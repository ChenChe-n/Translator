<template>
  <section class="page-shell" aria-label="api">
    <ApiConfigTabs
      :configs="configState.configs"
      :active-config-id="configState.activeConfigId"
      @create="handleCreateConfig"
      @remove="handleRemoveConfig"
      @select="handleSelectConfig"
    />
    <div class="config-shell" :class="{ expanded: configExpanded }">
      <ApiConfigForm v-if="configExpanded" v-model="config" />
      <div class="action-row">
        <ElButton class="action-button" @click="handleSaveConfig">保存</ElButton>
        <ElButton type="primary" class="action-button" :loading="testing" @click="handleRunChecks">测试</ElButton>
      </div>
    </div>
    <ApiCheckResultList :results="checkResults" />
    <ModelUsageStats
      :usage="modelUsage"
      :settings="usageSettings"
      @retention-change="handleRetentionChange"
    />
  </section>
</template>

<script setup lang="ts">
import { ElButton, ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import ApiConfigTabs from '../components/api/ApiConfigTabs.vue';
import ApiCheckResultList from '../components/api/ApiCheckResultList.vue';
import ModelUsageStats from '../components/usage/ModelUsageStats.vue';
import { createDefaultApiCheckResults, runApiHealthChecks } from '../services/apiHealthChecks';
import {
  loadApiCheckResults,
  createApiConfig,
  createDefaultApiConfigState,
  loadApiConfigState,
  saveApiCheckResults,
  saveApiConfigState,
} from '../services/apiConfigStorage';
import {
  loadModelDailyUsage,
  loadUsageStatsSettings,
  pruneUsage,
  saveUsageStatsSettings,
} from '../services/modelUsageStorage';
import type { ApiCheckResult, ApiConfig, ApiConfigState, ModelDailyUsage, UsageStatsSettings } from '../types/api';

const configState = reactive<ApiConfigState>(createDefaultApiConfigState());

const configExpanded = ref(false);
const testing = ref(false);
const checkResults = ref<ApiCheckResult[]>(createDefaultApiCheckResults());
const modelUsage = ref<ModelDailyUsage[]>([]);
const usageSettings = ref<UsageStatsSettings>({
  retentionDays: 30,
});

const config = computed<ApiConfig>({
  get() {
    return getActiveConfig();
  },
  set(value) {
    configState.configs = configState.configs.map((item) => (item.id === value.id ? value : item));
  },
});

onMounted(async () => {
  const [storedConfigState, storedUsage, storedSettings] = await Promise.all([
    loadApiConfigState(),
    loadModelDailyUsage(),
    loadUsageStatsSettings(),
  ]);
  Object.assign(configState, storedConfigState);
  modelUsage.value = storedUsage;
  usageSettings.value = storedSettings;

  await refreshCheckResults();
});

async function handleSaveConfig(): Promise<void> {
  ensureConfig();
  await saveConfigState();
  ElMessage.success('配置已保存');
}

async function handleRunChecks(): Promise<void> {
  testing.value = true;

  try {
    ensureConfig();
    await saveConfigState();

    for await (const result of runApiHealthChecks(config.value)) {
      updateCheckResult(result);
      await saveApiCheckResults(configState.activeConfigId, checkResults.value);
      await refreshModelUsage();
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '测试失败');
  } finally {
    testing.value = false;
  }
}

async function handleCreateConfig(): Promise<void> {
  const nextConfig = createApiConfig();
  configState.configs.push(nextConfig);
  configState.activeConfigId = nextConfig.id;
  configExpanded.value = true;
  await saveConfigState();
}

async function handleRemoveConfig(id: string): Promise<void> {
  if (configState.configs.length <= 1) {
    ElMessage.warning('至少保留一个配置');
    return;
  }

  configState.configs = configState.configs.filter((item) => item.id !== id);

  const removingActiveConfig = configState.activeConfigId === id;

  if (removingActiveConfig) {
    configState.activeConfigId = configState.configs[0].id;
    configExpanded.value = false;
  }

  if (removingActiveConfig) {
    await refreshCheckResults();
  }

  await saveConfigState();
}

async function handleSelectConfig(id: string): Promise<void> {
  if (configState.activeConfigId === id) {
    configExpanded.value = !configExpanded.value;
    return;
  }

  configState.activeConfigId = id;
  configExpanded.value = true;
  await refreshCheckResults();
  await saveConfigState();
}

async function handleRetentionChange(value: number): Promise<void> {
  usageSettings.value = {
    retentionDays: value,
  };
  modelUsage.value = pruneUsage(modelUsage.value, value);
  await saveUsageStatsSettings(usageSettings.value);
}

function ensureConfig(): void {
  if (!config.value.baseUrl || !config.value.apiKey || !config.value.model) {
    throw new Error('请先填写 URL、Key 和模型。');
  }
}

async function saveConfigState(): Promise<void> {
  normalizeActiveConfigName();
  await saveApiConfigState({
    activeConfigId: configState.activeConfigId,
    configs: configState.configs,
  });
}

function getActiveConfig(): ApiConfig {
  if (configState.configs.length === 0) {
    const nextConfig = createApiConfig();
    configState.configs.push(nextConfig);
    configState.activeConfigId = nextConfig.id;
    return nextConfig;
  }

  return configState.configs.find((item) => item.id === configState.activeConfigId) ?? configState.configs[0];
}

function normalizeActiveConfigName(): void {
  const activeConfig = getActiveConfig();
  activeConfig.name = activeConfig.name || activeConfig.model;
}

function updateCheckResult(result: ApiCheckResult): void {
  checkResults.value = checkResults.value.map((item) => (item.key === result.key ? result : item));
}

async function refreshModelUsage(): Promise<void> {
  modelUsage.value = await loadModelDailyUsage();
}

async function refreshCheckResults(): Promise<void> {
  const storedResults = await loadApiCheckResults(configState.activeConfigId);
  checkResults.value = storedResults.length > 0 ? mergeResults(storedResults) : createDefaultApiCheckResults();
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

</script>

<style scoped>
.page-shell {
  width: 100%;
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
}

.config-shell {
  padding: 12px;
  border: 1px solid #edf1f5;
  border-radius: 8px;
  background: #ffffff;
}

.config-shell.expanded {
  box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.action-button {
  width: 100%;
  height: 38px;
}

</style>
