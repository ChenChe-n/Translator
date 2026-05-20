<template>
  <ElForm label-position="top">
    <div v-if="showNormalOptions" class="parameter-row">
      <ElFormItem :label="t('translationMode.temperature')">
        <ElInputNumber
          :model-value="config.parameters.temperature"
          :min="0"
          :max="2"
          :step="0.1"
          controls-position="right"
          @change="handleTemperatureUpdate"
        />
      </ElFormItem>
      <ElFormItem :label="t('translationMode.maxTokens')">
        <ElInputNumber
          :model-value="config.parameters.maxTokens"
          :min="1"
          :max="128000"
          :step="256"
          controls-position="right"
          @change="handleMaxTokensUpdate"
        />
      </ElFormItem>
    </div>
    <div class="parameter-row">
      <ElFormItem :label="t('translationMode.batchMaxItems')">
        <ElInputNumber
          :model-value="config.options.paragraphInput ? 1 : config.parameters.batchMaxItems"
          :min="1"
          :max="1024"
          :disabled="config.options.paragraphInput"
          controls-position="right"
          @change="handleBatchMaxItemsUpdate"
        />
      </ElFormItem>
      <ElFormItem :label="t('translationMode.batchMaxTokens')">
        <ElInputNumber
          :model-value="config.parameters.batchMaxTokens"
          :min="1"
          :max="128000"
          :step="1024"
          controls-position="right"
          @change="handleBatchMaxTokensUpdate"
        />
      </ElFormItem>
    </div>
    <ElFormItem v-if="showNormalOptions" :label="t('translationMode.batchWaitMs')">
      <ElInputNumber
        :model-value="config.parameters.batchWaitMs"
        :min="0"
        :max="60000"
        :step="100"
        controls-position="right"
        @change="handleBatchWaitMsUpdate"
      />
    </ElFormItem>
    <ElFormItem v-if="showNormalOptions" :label="t('translationMode.prompt')">
      <ElInput
        :model-value="config.prompt"
        type="textarea"
        :rows="8"
        resize="vertical"
        @update:model-value="handlePromptUpdate"
      />
    </ElFormItem>
    <div class="option-row">
      <ElCheckbox :model-value="config.options.preserveFormatting" @change="handlePreserveFormattingUpdate">
        {{ t('translationMode.preserveFormatting') }}
      </ElCheckbox>
      <ElCheckbox v-if="showNormalOptions" :model-value="config.options.enableCache" @change="handleEnableCacheUpdate">
        {{ t('translationMode.enableCache') }}
      </ElCheckbox>
      <ElCheckbox
        v-if="showNormalOptions"
        :model-value="config.options.paragraphInput"
        @change="handleParagraphInputUpdate"
      >
        {{ t('translationMode.paragraphInput') }}
      </ElCheckbox>
      <ElCheckbox
        v-if="showNormalOptions"
        :model-value="config.options.showTranslatingMarker"
        @change="handleShowTranslatingMarkerUpdate"
      >
        {{ t('translationMode.showTranslatingMarker') }}
      </ElCheckbox>
    </div>
  </ElForm>
</template>

<script setup lang="ts">
import { ElCheckbox, ElForm, ElFormItem, ElInput, ElInputNumber } from 'element-plus';
import { useI18n } from '../../composables/useI18n';
import type { TranslationModeConfig } from '../../types/translationMode';

const props = defineProps<{
  config: TranslationModeConfig;
  showNormalOptions: boolean;
}>();

const emit = defineEmits<{
  update: [config: Partial<TranslationModeConfig>];
}>();

const { t } = useI18n();

function handleTemperatureUpdate(value: number | undefined): void {
  updateParameters({ temperature: value ?? 0.3 });
}

function handleMaxTokensUpdate(value: number | undefined): void {
  updateParameters({ maxTokens: value ?? 2048 });
}

function handleBatchMaxItemsUpdate(value: number | undefined): void {
  updateParameters({ batchMaxItems: Math.max(1, Math.min(1024, value ?? 1)) });
}

function handleBatchMaxTokensUpdate(value: number | undefined): void {
  updateParameters({ batchMaxTokens: value ?? 16 * 1024 });
}

function handleBatchWaitMsUpdate(value: number | undefined): void {
  updateParameters({ batchWaitMs: Math.max(0, value ?? 300) });
}

function handlePromptUpdate(value: string | number): void {
  emit('update', {
    prompt: String(value),
  });
}

function handlePreserveFormattingUpdate(value: string | number | boolean): void {
  updateOptions({ preserveFormatting: Boolean(value) });
}

function handleEnableCacheUpdate(value: string | number | boolean): void {
  updateOptions({ enableCache: Boolean(value) });
}

function handleParagraphInputUpdate(value: string | number | boolean): void {
  emit('update', {
    parameters: {
      ...props.config.parameters,
      batchMaxItems: Boolean(value) ? 1 : props.config.parameters.batchMaxItems,
    },
    options: {
      ...props.config.options,
      paragraphInput: Boolean(value),
    },
  });
}

function handleShowTranslatingMarkerUpdate(value: string | number | boolean): void {
  updateOptions({ showTranslatingMarker: Boolean(value) });
}

function updateParameters(parameters: Partial<TranslationModeConfig['parameters']>): void {
  emit('update', {
    parameters: {
      ...props.config.parameters,
      ...parameters,
    },
  });
}

function updateOptions(options: Partial<TranslationModeConfig['options']>): void {
  emit('update', {
    options: {
      ...props.config.options,
      ...options,
    },
  });
}
</script>

<style scoped>
.parameter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.parameter-row :deep(.el-input-number),
:deep(.el-input-number) {
  width: 100%;
}

.option-row {
  display: grid;
  gap: 8px;
}
</style>
