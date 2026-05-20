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
        @config-hover="handleConfigHover"
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
      :active-config="config"
      :configs="configState.configs"
      :preview-config="previewConfig"
      :usage="modelUsage"
      :settings="usageSettings"
      @retention-change="handleRetentionChange"
    />
  </section>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus';
import PageClearButton from '../components/common/PageClearButton.vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import ApiConfigTabs from '../components/api/ApiConfigTabs.vue';
import ApiCheckResultList from '../components/api/ApiCheckResultList.vue';
import ApiTransferButtons from '../components/api/ApiTransferButtons.vue';
import ModelUsageStats from '../components/usage/ModelUsageStats.vue';
import { useApiPageState } from '../composables/useApiPageState';

const {
  checkResults,
  config,
  configExpanded,
  configState,
  handleClearPage,
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
} = useApiPageState();
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
