<template>
  <section class="mode-block" :aria-label="t('translationMode.title')">
    <h2 class="panel-title">{{ t('translationMode.title') }}</h2>
    <p class="panel-description">{{ t('translationMode.description') }}</p>
    <ElCheckbox :model-value="enabled" @change="handleEnabledUpdate">
      {{ t('runtime.translationEnabled') }}
    </ElCheckbox>
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
      <NormalTranslationForm
        :config="activeConfig"
        :show-normal-options="activeMode === 'normal'"
        @update="updateActiveConfig"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElCheckbox } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { TranslationModeConfigMap, TranslationModeKey } from '../../types/translationMode';
import NormalTranslationForm from './NormalTranslationForm.vue';

const props = defineProps<{
  configMap: TranslationModeConfigMap;
  enabled: boolean;
  expanded: boolean;
}>();

const emit = defineEmits<{
  select: [mode: TranslationModeKey];
  toggleEnabled: [enabled: boolean];
  update: [configMap: TranslationModeConfigMap];
}>();

const { t } = useI18n();
const modeKeys: TranslationModeKey[] = ['normal', 'context'];

const activeMode = defineModel<TranslationModeKey>('activeMode', { required: true });
const activeConfig = computed(() => props.configMap[activeMode.value]);
const modeOptions = computed(() =>
  modeKeys.map((value) => ({
    label: t(`translationMode.${value}` as 'translationMode.normal'),
    value,
  })),
);

function updateActiveConfig(config: Partial<TranslationModeConfigMap[TranslationModeKey]>): void {
  emit('update', {
    ...props.configMap,
    [activeMode.value]: {
      ...activeConfig.value,
      ...config,
    },
  });
}

function handleEnabledUpdate(value: string | number | boolean): void {
  emit('toggleEnabled', Boolean(value));
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
  font-size: 13px;
  font-weight: 600;
  color: var(--translator-text);
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

</style>
