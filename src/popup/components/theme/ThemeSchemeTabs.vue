<template>
  <div class="scheme-tabs-row">
    <div ref="scrollerRef" class="scheme-tabs" @pointerdown="handlePointerDown">
      <button
        v-for="scheme in schemes"
        :key="scheme.id"
        class="scheme-tab"
        :class="{ active: scheme.id === activeSchemeId }"
        type="button"
        @click="handleSelect(scheme.id)"
      >
        <span class="tab-name">{{ getSchemeName(scheme) }}</span>
        <span v-if="scheme.kind === 'custom'" class="tab-close" @click.stop="$emit('remove', scheme.id)">x</span>
      </button>
    </div>
    <button
      class="create-button"
      type="button"
      :aria-label="t('theme.addScheme')"
      :title="t('theme.addScheme')"
      @click="$emit('create')"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { ThemeScheme } from '../../types/theme';

defineProps<{
  schemes: ThemeScheme[];
  activeSchemeId: string;
}>();

const emit = defineEmits<{
  create: [];
  remove: [id: string];
  select: [id: string];
}>();

const scrollerRef = ref<HTMLElement>();
const { t } = useI18n();
const presetNameKeys = {
  system: 'theme.scheme.system',
  day: 'theme.scheme.day',
  night: 'theme.scheme.night',
  sakura: 'theme.scheme.sakura',
} as const;
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
  dragging = Math.abs(distance) > 3 || dragging;
  scrollerRef.value.scrollLeft = startScrollLeft - distance;
}

function handlePointerUp(): void {
  window.removeEventListener('pointermove', handlePointerMove);
}

function handleSelect(id: string): void {
  if (!dragging) {
    emit('select', id);
  }
}

function getSchemeName(scheme: ThemeScheme): string {
  if (scheme.kind === 'custom') {
    return scheme.name;
  }

  return t(presetNameKeys[scheme.id as keyof typeof presetNameKeys] ?? 'theme.scheme.defaultCustom');
}
</script>

<style scoped>
.scheme-tabs-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 8px;
  align-items: center;
}

.scheme-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
}

.scheme-tabs::-webkit-scrollbar {
  display: none;
}

.scheme-tabs:active {
  cursor: grabbing;
}

.scheme-tab {
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

.scheme-tab.active {
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
