<template>
  <section class="color-editor">
    <label v-for="item in colorItems" :key="item.key" class="color-item">
      <span class="color-box" :style="{ background: item.value }"></span>
      <span class="color-label">{{ item.label }}</span>
      <input
        class="color-input"
        type="color"
        :value="item.value"
        :disabled="readonly"
        @input="handleColorInput(item.key, $event)"
      />
    </label>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeColors } from '../../types/theme';

const props = defineProps<{
  colors: ThemeColors;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  update: [colors: ThemeColors];
}>();

const colorItems = computed(() => [
  {
    key: 'primary' as const,
    label: '主体',
    value: props.colors.primary,
  },
  {
    key: 'background' as const,
    label: '背景',
    value: props.colors.background,
  },
  {
    key: 'accent' as const,
    label: '强调',
    value: props.colors.accent,
  },
]);

function handleColorInput(key: keyof ThemeColors, event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update', {
    ...props.colors,
    [key]: target.value,
  });
}
</script>

<style scoped>
.color-editor {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.color-item {
  position: relative;
  min-width: 0;
  height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: var(--translator-surface, #ffffff);
  color: #334155;
  font-size: 12px;
}

.color-box {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid rgb(15 23 42 / 18%);
  border-radius: 4px;
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 60%);
}

.color-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.color-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.color-input:disabled {
  cursor: default;
}
</style>
