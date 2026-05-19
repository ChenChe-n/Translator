<template>
  <section class="mode-block" :aria-label="t('textParseMode.title')">
    <h2 class="panel-title">{{ t('textParseMode.title') }}</h2>
    <p class="panel-description">{{ t('textParseMode.description') }}</p>
    <div class="mode-tabs">
      <button
        v-for="option in modeOptions"
        :key="option.value"
        class="mode-tab"
        :class="{ active: option.value === activeMode }"
        type="button"
        @click="$emit('select', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
    <section v-if="expanded" class="mode-form">
      <ElForm label-position="top">
        <ElFormItem :label="t('textParseMode.autoParseDelay')">
          <div class="delay-control">
            <ElInputNumber
              :model-value="activeConfig.autoParseDelayMs"
              :min="0"
              :max="60000"
              :step="100"
              controls-position="right"
              @change="handleDelayUpdate"
            />
            <span class="delay-unit">{{ t('textParseMode.ms') }}</span>
          </div>
        </ElFormItem>
        <div v-if="activeMode === 'structured'" class="option-row">
          <ElCheckbox :model-value="activeConfig.options.preserveId" @change="handlePreserveIdUpdate">
            {{ t('textParseMode.preserveId') }}
          </ElCheckbox>
          <ElCheckbox :model-value="activeConfig.options.preserveClass" @change="handlePreserveClassUpdate">
            {{ t('textParseMode.preserveClass') }}
          </ElCheckbox>
          <ElCheckbox :model-value="activeConfig.options.preserveStyle" @change="handlePreserveStyleUpdate">
            {{ t('textParseMode.preserveStyle') }}
          </ElCheckbox>
          <ElCheckbox :model-value="activeConfig.options.preserveUrl" @change="handlePreserveUrlUpdate">
            {{ t('textParseMode.preserveUrl') }}
          </ElCheckbox>
        </div>
      </ElForm>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElCheckbox, ElForm, ElFormItem, ElInputNumber } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { TextParseModeConfigMap, TextParseModeKey } from '../../types/textParseMode';

const props = defineProps<{
  configMap: TextParseModeConfigMap;
  expanded: boolean;
}>();

const emit = defineEmits<{
  select: [mode: TextParseModeKey];
  update: [configMap: TextParseModeConfigMap];
}>();

const { t } = useI18n();
const modeKeys: TextParseModeKey[] = ['visible', 'full', 'structured'];

const activeMode = defineModel<TextParseModeKey>('activeMode', { required: true });
const activeConfig = computed(() => props.configMap[activeMode.value]);
const modeTitleKeys: Record<TextParseModeKey, 'textParseMode.visible' | 'textParseMode.full' | 'textParseMode.structured'> = {
  visible: 'textParseMode.visible',
  full: 'textParseMode.full',
  structured: 'textParseMode.structured',
};
const modeOptions = computed(() =>
  modeKeys.map((value) => ({
    label: t(modeTitleKeys[value]),
    value,
  })),
);

function handleDelayUpdate(value: number | undefined): void {
  updateActiveConfig({
    autoParseDelayMs: value ?? 500,
  });
}

function handlePreserveIdUpdate(value: string | number | boolean): void {
  updateStructuredOptions('preserveId', Boolean(value));
}

function handlePreserveClassUpdate(value: string | number | boolean): void {
  updateStructuredOptions('preserveClass', Boolean(value));
}

function handlePreserveStyleUpdate(value: string | number | boolean): void {
  updateStructuredOptions('preserveStyle', Boolean(value));
}

function handlePreserveUrlUpdate(value: string | number | boolean): void {
  updateStructuredOptions('preserveUrl', Boolean(value));
}

function updateStructuredOptions(key: keyof TextParseModeConfigMap['structured']['options'], value: boolean): void {
  updateActiveConfig({
    options: {
      ...activeConfig.value.options,
      [key]: value,
    },
  });
}

function updateActiveConfig(config: Partial<TextParseModeConfigMap[TextParseModeKey]>): void {
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
.mode-block {
  display: grid;
  gap: 8px;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.mode-tabs::-webkit-scrollbar {
  display: none;
}

.mode-tab {
  height: 32px;
  flex: 1 0 0;
  min-width: 86px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
  color: var(--translator-text);
  font-size: 12px;
  cursor: pointer;
}

.mode-tab.active {
  border-color: var(--translator-key-button);
  background: var(--translator-key-button);
  color: var(--translator-button);
  box-shadow: 0 8px 18px var(--translator-shadow);
}

.panel-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.panel-description {
  margin: -4px 0 0;
  color: var(--translator-muted);
  font-size: 11px;
  line-height: 1.5;
}

.mode-form {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 20px var(--translator-shadow);
}

.mode-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.delay-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.delay-control :deep(.el-input-number) {
  width: 100%;
}

.delay-unit {
  color: var(--translator-muted);
  font-size: 12px;
}

.option-row {
  display: grid;
  gap: 8px;
}
</style>
