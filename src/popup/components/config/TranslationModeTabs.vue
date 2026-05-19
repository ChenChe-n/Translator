<template>
  <section class="mode-panel" :aria-label="t('translationMode.title')">
    <h2 class="panel-title">{{ t('translationMode.title') }}</h2>
    <ElSegmented v-model="activeMode" class="mode-tabs" :options="modeOptions" />
    <section class="mode-form">
      <ElForm label-position="top">
        <ElFormItem :label="t('translationMode.cachePath')">
          <ElInput
            :model-value="activeConfig.cachePath"
            :placeholder="t('translationMode.cachePathPlaceholder')"
            clearable
            @update:model-value="handleCachePathUpdate"
          />
        </ElFormItem>
        <div class="parameter-row">
          <ElFormItem :label="t('translationMode.temperature')">
            <ElInputNumber
              :model-value="activeConfig.parameters.temperature"
              :min="0"
              :max="2"
              :step="0.1"
              controls-position="right"
              @change="handleTemperatureUpdate"
            />
          </ElFormItem>
          <ElFormItem :label="t('translationMode.maxTokens')">
            <ElInputNumber
              :model-value="activeConfig.parameters.maxTokens"
              :min="1"
              :max="128000"
              :step="256"
              controls-position="right"
              @change="handleMaxTokensUpdate"
            />
          </ElFormItem>
        </div>
        <div class="option-row">
          <ElCheckbox
            :model-value="activeConfig.options.preserveFormatting"
            @change="handlePreserveFormattingUpdate"
          >
            {{ t('translationMode.preserveFormatting') }}
          </ElCheckbox>
          <ElCheckbox :model-value="activeConfig.options.enableCache" @change="handleEnableCacheUpdate">
            {{ t('translationMode.enableCache') }}
          </ElCheckbox>
        </div>
      </ElForm>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElCheckbox, ElForm, ElFormItem, ElInput, ElInputNumber, ElSegmented } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { TranslationModeConfigMap, TranslationModeKey } from '../../types/translationMode';

const props = defineProps<{
  configMap: TranslationModeConfigMap;
}>();

const emit = defineEmits<{
  update: [configMap: TranslationModeConfigMap];
}>();

const { t } = useI18n();
const modeKeys: TranslationModeKey[] = ['normal', 'batch', 'context'];

const activeMode = defineModel<TranslationModeKey>('activeMode', { required: true });
const activeConfig = computed(() => props.configMap[activeMode.value]);
const modeOptions = computed(() =>
  modeKeys.map((value) => ({
    label: t(`translationMode.${value}` as 'translationMode.normal'),
    value,
  })),
);

function handleCachePathUpdate(value: string | number): void {
  updateActiveConfig({
    cachePath: String(value),
  });
}

function handleTemperatureUpdate(value: number | undefined): void {
  updateActiveConfig({
    parameters: {
      ...activeConfig.value.parameters,
      temperature: value ?? 0.3,
    },
  });
}

function handleMaxTokensUpdate(value: number | undefined): void {
  updateActiveConfig({
    parameters: {
      ...activeConfig.value.parameters,
      maxTokens: value ?? 2048,
    },
  });
}

function handlePreserveFormattingUpdate(value: string | number | boolean): void {
  updateActiveConfig({
    options: {
      ...activeConfig.value.options,
      preserveFormatting: Boolean(value),
    },
  });
}

function handleEnableCacheUpdate(value: string | number | boolean): void {
  updateActiveConfig({
    options: {
      ...activeConfig.value.options,
      enableCache: Boolean(value),
    },
  });
}

function updateActiveConfig(config: Partial<TranslationModeConfigMap[TranslationModeKey]>): void {
  emit('update', {
    ...props.configMap,
    [activeMode.value]: {
      ...activeConfig.value,
      ...config,
    },
  });
}
</script>

<style scoped>
.mode-panel {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 20px var(--translator-shadow);
}

.mode-tabs {
  width: 100%;
  --el-segmented-bg-color: var(--translator-button);
  --el-segmented-item-selected-bg-color: var(--translator-key-button);
  --el-segmented-item-selected-color: var(--translator-button);
  --el-border-radius-base: 7px;
  color: var(--translator-text);
}

.panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--translator-text);
}

.mode-tabs :deep(.el-segmented__group) {
  width: 100%;
}

.mode-tabs :deep(.el-segmented__item) {
  flex: 1;
  min-width: 0;
  height: 32px;
}

.mode-tabs :deep(.el-segmented__item-label) {
  line-height: 32px;
}

.mode-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.parameter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.parameter-row :deep(.el-input-number) {
  width: 100%;
}

.option-row {
  display: grid;
  gap: 8px;
}
</style>
