<template>
  <div class="config-tabs-row">
    <div ref="scrollerRef" class="config-tabs" @pointerdown="handlePointerDown">
      <button
        v-for="(item, index) in configs"
        :key="item.id"
        class="config-tab"
        :class="{ active: item.id === activeConfigId }"
        type="button"
        @mouseenter="$emit('configHover', item.id)"
        @mouseleave="$emit('configHover', undefined)"
        @click="handleSelect(item.id)"
      >
        <span class="tab-name">{{ getConfigName(item, index) }}</span>
        <span class="tab-close" @click.stop="$emit('remove', item.id)">x</span>
      </button>
    </div>
    <button
      class="create-button"
      type="button"
      :aria-label="t('api.addConfig')"
      :title="t('api.addConfig')"
      @click="$emit('create')"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { ApiConfig } from '../../types/api';

defineProps<{
  configs: ApiConfig[];
  activeConfigId: string;
}>();

const emit = defineEmits<{
  configHover: [id: string | undefined];
  create: [];
  remove: [id: string];
  select: [id: string];
}>();

const scrollerRef = ref<HTMLElement>();
const { t } = useI18n();
let startX = 0;
let startScrollLeft = 0;
let dragging = false;

function handlePointerDown(event: PointerEvent): void {
  if (!scrollerRef.value) {
    return;
  }

  dragging = false;
  startX = event.clientX;
  startScrollLeft = scrollerRef.value.scrollLeft;
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}

function handlePointerMove(event: PointerEvent): void {
  if (!scrollerRef.value) {
    return;
  }

  const distance = event.clientX - startX;

  if (Math.abs(distance) > 3) {
    dragging = true;
  }

  scrollerRef.value.scrollLeft = startScrollLeft - distance;
}

function handlePointerUp(): void {
  window.removeEventListener('pointermove', handlePointerMove);
}

function handleSelect(id: string): void {
  if (dragging) {
    return;
  }

  emit('select', id);
}

function getConfigName(config: ApiConfig, index: number): string {
  const name = config.name === '未命名' ? '' : config.name;
  return name || config.model || t('api.configFallback', { index: index + 1 });
}
</script>

<style scoped>
.config-tabs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 8px;
  align-items: center;
}

.config-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
}

.config-tabs::-webkit-scrollbar {
  display: none;
}

.config-tabs:active {
  cursor: grabbing;
}

.config-tab {
  height: 32px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 160px;
  padding: 0 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
  color: var(--translator-text);
  font-size: 12px;
}

.config-tab.active {
  border-color: var(--translator-key-button);
  background: var(--translator-key-button);
  color: var(--translator-button);
  box-shadow: 0 8px 18px var(--translator-shadow);
}

.tab-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tab-close {
  color: currentColor;
  opacity: 0.72;
}

.create-button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px dashed var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
  color: var(--translator-marker);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
</style>
