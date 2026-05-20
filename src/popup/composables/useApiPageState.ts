import { ElMessage } from 'element-plus';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useI18n } from './useI18n';
import { createDefaultApiCheckResults, runApiHealthChecks } from '../services/apiHealthChecks';
import { createApiConfigSignature } from '../services/apiConfigSignature';
import { clearApiCheckResults, clearApiConfigState, createApiConfig, createDefaultApiConfigState } from '../services/apiConfigStorage';
import { loadApiCheckResults, loadApiConfigState, saveApiCheckResults, saveApiConfigState } from '../services/apiConfigStorage';
import { resetMismatchedApiCheckResults } from '../services/apiConfigValidation';
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

/**
 * 创建 API 页面状态与事件处理器。
 *
 * @returns API 页面响应式状态、翻译函数和事件处理器。
 */
export function useApiPageState() {
  const configState = reactive<ApiConfigState>(createDefaultApiConfigState());
  const { t } = useI18n();
  const configExpanded = ref(false);
  const testing = ref(false);
  const checkResults = ref<ApiCheckResult[]>(createDefaultApiCheckResults());
  const checkResultCache = reactive<Record<string, ApiCheckResult[]>>({});
  const modelUsage = ref<ModelDailyUsage[]>([]);
  const usageSettings = ref<UsageStatsSettings>({ retentionDays: 30 });
  const hoveredConfigId = ref<string>();
  let testGeneration = 0;
  let usageGeneration = 0;

  const config = computed<ApiConfig>({
    get: () => getActiveConfig(),
    set: (value) => {
      configState.configs = configState.configs.map((item) => (item.id === value.id ? value : item));
    },
  });
  const previewConfig = computed(() => configState.configs.find((item) => item.id === hoveredConfigId.value));

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
    testGeneration += 1;
    usageGeneration += 1;
    testing.value = false;
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

  async function handleClearUsageRecords(): Promise<void> {
    usageGeneration += 1;
    await clearModelDailyUsage();
    modelUsage.value = [];
    ElMessage.success(t('common.cleared'));
  }

  async function handleImportApiConfig(state: ApiConfigState): Promise<void> {
    Object.assign(configState, state);
    configExpanded.value = false;
    await refreshCheckResults();
    await refreshModelUsage();
    usageSettings.value = await loadUsageStatsSettings();
  }

  async function handleRunChecks(): Promise<void> {
    const generation = testGeneration + 1;
    const usageRecordGeneration = usageGeneration;
    testGeneration = generation;
    testing.value = true;
    const testingConfig = { ...config.value };
    const testingConfigId = testingConfig.id;
    const testingSignature = createApiConfigSignature(testingConfig);

    try {
      ensureConfig();
      await saveConfigState();
      await cacheCheckResults(testingConfigId, createDefaultApiCheckResults());

      for await (const result of runApiHealthChecks(testingConfig, {
        isActive: () => generation === testGeneration,
        shouldRecordUsage: () => generation === testGeneration && usageRecordGeneration === usageGeneration,
      })) {
        if (generation !== testGeneration) {
          return;
        }
        await updateCheckResult(testingConfigId, {
          ...result,
          configSignature: result.status === 'finished' ? testingSignature : undefined,
        });
        await refreshModelUsage();
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? translateErrorMessage(error.message) : t('api.messages.testFailed'));
    } finally {
      if (generation === testGeneration) {
        testing.value = false;
      }
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

  function handleConfigHover(id: string | undefined): void {
    hoveredConfigId.value = id;
  }

  async function handleRetentionChange(value: number): Promise<void> {
    usageSettings.value = { retentionDays: value };
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
    const mergedResults = createDefaultApiCheckResults().map((item) => {
      const stored = results.find((result) => result.key === item.key);
      return stored ? { ...item, ...stored, label: item.label, status: stored.status ?? 'finished' } : item;
    });
    return resetMismatchedApiCheckResults(config.value, mergedResults);
  }

  return {
    checkResults,
    config,
    configExpanded,
    configState,
    handleClearPage,
    handleClearUsageRecords,
    handleConfigHover,
    handleCreateConfig,
    handleImportApiConfig,
    handleRemoveConfig,
    handleRetentionChange,
    handleRunChecks,
    handleSaveConfig,
    handleSelectConfig,
    modelUsage,
    previewConfig,
    t,
    testing,
    usageSettings,
  };
}
