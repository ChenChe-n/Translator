<template>
  <section class="page-shell" :aria-label="t('app.tabs.api')">
    <div class="page-action-row">
      <ApiTransferButtons @imported="handleImportApiConfig" />
      <PageClearButton @clear="handleClearPage" />
    </div>
    <section class="config-block">
      <h2 class="block-title">{{ t('api.models.title') }}</h2>
      <p class="block-description">{{ t('api.models.description') }}</p>
      <ApiConfigTabs
        :configs="configState.configs"
        :active-config-id="configState.activeConfigId"
        @create="handleCreateConfig"
        @remove="handleRemoveConfig"
        @select="handleSelectConfig"
      />
    </section>
    <div v-if="configExpanded" class="config-shell">
      <ApiConfigForm v-model="config" />
      <div class="action-row">
        <ElButton class="action-button" @click="handleSaveConfig">{{ t('api.actions.save') }}</ElButton>
        <ElButton type="primary" class="action-button" :loading="testing" @click="handleRunChecks">
          {{ t('api.actions.test') }}
        </ElButton>
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
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import PageClearButton from '../components/common/PageClearButton.vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import ApiConfigTabs from '../components/api/ApiConfigTabs.vue';
import ApiCheckResultList from '../components/api/ApiCheckResultList.vue';
import ApiTransferButtons from '../components/api/ApiTransferButtons.vue';
import ModelUsageStats from '../components/usage/ModelUsageStats.vue';
import { useI18n } from '../composables/useI18n';
import { createDefaultApiCheckResults, runApiHealthChecks } from '../services/apiHealthChecks';
import {
  clearApiCheckResults,
  clearApiConfigState,
  loadApiCheckResults,
  createApiConfig,
  createDefaultApiConfigState,
  loadApiConfigState,
  saveApiCheckResults,
  saveApiConfigState,
} from '../services/apiConfigStorage';
import {
  clearModelDailyUsage,
  clearUsageStatsSettings,
  loadModelDailyUsage,
  loadUsageStatsSettings,
  pruneUsage,
  saveUsageStatsSettings,
  USAGE_STORAGE_KEY,
} from '../services/modelUsageStorage';
import type { ApiCheckResult, ApiConfig, ApiConfigState, ModelDailyUsage, UsageStatsSettings } from '../types/api';

const configState = reactive<ApiConfigState>(createDefaultApiConfigState());
const { t } = useI18n();

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
  chrome.storage?.onChanged?.addListener(handleStorageChanged);
});

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged);
});

async function handleSaveConfig(): Promise<void> {
  ensureConfig();
  await saveConfigState();
  ElMessage.success(t('api.messages.saved'));
}

async function handleClearPage(): Promise<void> {
  const [nextConfigState, , , nextUsageSettings] = await Promise.all([
    clearApiConfigState(),
    clearApiCheckResults(),
    clearModelDailyUsage(),
    clearUsageStatsSettings(),
  ]);
  Object.assign(configState, nextConfigState);
  configExpanded.value = false;
  checkResults.value = createDefaultApiCheckResults();
  Object.keys(checkResultCache).forEach((key) => delete checkResultCache[key]);
  modelUsage.value = [];
  usageSettings.value = nextUsageSettings;
  ElMessage.success(t('common.cleared'));
}

async function handleImportApiConfig(state: ApiConfigState): Promise<void> {
  Object.assign(configState, state);
  configExpanded.value = false;
  await refreshCheckResults();
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
    ElMessage.error(error instanceof Error ? translateErrorMessage(error.message) : t('api.messages.testFailed'));
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
    ElMessage.warning(t('api.messages.keepOne'));
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

async function handleStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): Promise<void> {
  if (areaName === 'local' && changes[USAGE_STORAGE_KEY]) {
    await refreshModelUsage();
  }
}

function ensureConfig(): void {
  if (!config.value.baseUrl || !config.value.apiKey || !config.value.model) {
    throw new Error(t('api.messages.required'));
  }
}

function translateErrorMessage(message: string): string {
  return message.startsWith('api.') ? t(message as 'api.messages.testFailed') : message;
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
      label: item.label,
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
