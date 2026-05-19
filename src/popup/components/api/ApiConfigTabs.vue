<template>
  <div ref="scrollerRef" class="config-tabs" @pointerdown="handlePointerDown">
    <button
      v-for="(item, index) in configs"
      :key="item.id"
      class="config-tab"
      :class="{ active: item.id === activeConfigId }"
      type="button"
      @click="handleSelect(item.id)"
    >
      <span class="tab-name">{{ getConfigName(item, index) }}</span>
      <span class="tab-close" @click.stop="$emit('remove', item.id)">x</span>
    </button>
    <button class="config-tab new-tab" type="button" @click="$emit('create')">new</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ApiConfig } from '../../types/api';

defineProps<{
  configs: ApiConfig[];
  activeConfigId: string;
}>();

const emit = defineEmits<{
  create: [];
  remove: [id: string];
  select: [id: string];
}>();

const scrollerRef = ref<HTMLElement>();
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
  return name || config.model || `配置${index + 1}`;
}
</script>

<style scoped>
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
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-size: 12px;
}

.config-tab.active {
  border-color: #1f2937;
  background: #1f2937;
  color: #ffffff;
  box-shadow: 0 8px 18px rgb(15 23 42 / 14%);
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

.new-tab {
  border-style: dashed;
  color: #2563eb;
}
</style>
