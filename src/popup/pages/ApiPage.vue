<template>
  <section class="page-shell" aria-label="api">
    <ApiConfigTabs
      :configs="configState.configs"
      :active-config-id="configState.activeConfigId"
      @create="handleCreateConfig"
      @remove="handleRemoveConfig"
      @select="handleSelectConfig"
    />
    <div v-if="configExpanded" class="config-shell">
      <ApiConfigForm v-model="config" />
      <div class="action-row">
        <ElButton class="action-button" @click="handleSaveConfig">保存</ElButton>
        <ElButton type="primary" class="action-button" :loading="testing" @click="handleRunChecks">测试</ElButton>
      </div>
      <ApiCheckResultList :results="checkResults" />
    </div>
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
const checkResultCache = reactive<Record<string, ApiCheckResult[]>>({});
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
  const testingConfig = { ...config.value };
  const testingConfigId = testingConfig.id;

  try {
    ensureConfig();
    await saveConfigState();
    await cacheCheckResults(testingConfigId, createDefaultApiCheckResults());

    for await (const result of runApiHealthChecks(testingConfig)) {
      await updateCheckResult(testingConfigId, result);
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
  setVisibleCheckResults(id);
  await refreshCheckResults(id);
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

async function updateCheckResult(configId: string, result: ApiCheckResult): Promise<void> {
  const nextResults = getCachedCheckResults(configId).map((item) => (item.key === result.key ? result : item));
  await cacheCheckResults(configId, nextResults);
}

async function refreshModelUsage(): Promise<void> {
  modelUsage.value = await loadModelDailyUsage();
}

async function refreshCheckResults(configId = configState.activeConfigId): Promise<void> {
  const storedResults = await loadApiCheckResults(configId);
  const nextResults = storedResults.length > 0 ? mergeResults(storedResults) : createDefaultApiCheckResults();
  checkResultCache[configId] = nextResults;

  if (configState.activeConfigId === configId) {
    checkResults.value = nextResults;
  }
}

async function cacheCheckResults(configId: string, results: ApiCheckResult[]): Promise<void> {
  checkResultCache[configId] = results;

  if (configState.activeConfigId === configId) {
    checkResults.value = results;
  }

  await saveApiCheckResults(configId, results);
}

function setVisibleCheckResults(configId: string): void {
  checkResults.value = checkResultCache[configId] ?? createDefaultApiCheckResults();
}

function getCachedCheckResults(configId: string): ApiCheckResult[] {
  return checkResultCache[configId] ?? createDefaultApiCheckResults();
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
  background: var(--translator-background);
}

.config-shell {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 20px var(--translator-shadow);
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
