<template>
  <section class="settings-row" :aria-label="t('runtime.updateScope')">
    <span class="settings-label">{{ t('runtime.updateScope') }}</span>
    <div class="choice-tabs">
      <button
        v-for="option in updateScopeOptions"
        :key="option.value"
        class="choice-tab"
        :class="{ active: modelValue === option.value }"
        type="button"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { SettingsUpdateScope } from '../../types/runtimeSettings';

defineProps<{
  modelValue: SettingsUpdateScope;
}>();

defineEmits<{
  'update:modelValue': [value: SettingsUpdateScope];
}>();

const { t } = useI18n();
const updateScopeOptions = computed<Array<{ label: string; value: SettingsUpdateScope }>>(() => [
  {
    label: t('runtime.updateForeground'),
    value: 'foreground',
  },
  {
    label: t('runtime.updateAll'),
    value: 'all',
  },
]);
</script>

<style scoped>
.settings-row {
  display: grid;
  gap: 8px;
}

.settings-label {
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.choice-tabs {
  display: flex;
  gap: 8px;
}

.choice-tab {
  height: 32px;
  flex: 1 0 0;
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

.choice-tab.active {
  border-color: var(--translator-key-button);
  background: var(--translator-key-button);
  color: var(--translator-button);
  box-shadow: 0 8px 18px var(--translator-shadow);
}
</style>
