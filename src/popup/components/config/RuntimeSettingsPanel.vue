<template>
  <section class="runtime-panel" :aria-label="t('runtime.title')">
    <div>
      <h2 class="block-title">{{ t('runtime.title') }}</h2>
      <p class="block-description">{{ t('runtime.description') }}</p>
    </div>
    <ElSwitch
      :model-value="settings.enabled"
      :active-text="t('runtime.enabled')"
      :inactive-text="t('runtime.disabled')"
      @change="handleEnabledChange"
    />
    <ElSegmented
      class="scope-selector"
      :model-value="settings.updateScope"
      :options="updateScopeOptions"
      @change="handleScopeChange"
    />
  </section>
</template>

<script setup lang="ts">
import { ElSegmented, ElSwitch } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { RuntimeSettings } from '../../types/runtimeSettings';

const props = defineProps<{
  settings: RuntimeSettings;
}>();

const emit = defineEmits<{
  update: [settings: RuntimeSettings];
}>();

const { t } = useI18n();
const updateScopeOptions = computed(() => [
  {
    label: t('runtime.updateForeground'),
    value: 'foreground',
  },
  {
    label: t('runtime.updateAll'),
    value: 'all',
  },
]);

function handleEnabledChange(value: string | number | boolean): void {
  emit('update', {
    ...props.settings,
    enabled: Boolean(value),
  });
}

function handleScopeChange(value: string | number): void {
  emit('update', {
    ...props.settings,
    updateScope: value === 'all' ? 'all' : 'foreground',
  });
}
</script>

<style scoped>
.runtime-panel {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
}

.block-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.block-description {
  margin: -2px 0 0;
  color: var(--translator-muted);
  font-size: 11px;
  line-height: 1.5;
}

.scope-selector {
  width: 100%;
  --el-segmented-bg-color: var(--translator-button);
  --el-segmented-item-selected-bg-color: var(--translator-key-button);
  --el-segmented-item-selected-color: var(--translator-button);
}
</style>
