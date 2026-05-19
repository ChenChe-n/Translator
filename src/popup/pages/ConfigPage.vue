<template>
  <section class="page-shell" aria-label="配置">
    <section class="scheme-panel" aria-label="配色方案">
      <ThemeSchemeTabs
        :schemes="themeState.schemes"
        :active-scheme-id="themeState.activeSchemeId"
        @create="handleCreateScheme"
        @remove="handleRemoveScheme"
        @select="handleSelectScheme"
      />
      <ThemeColorEditor
        v-if="activeScheme"
        :colors="activeColors"
        :readonly="activeScheme.kind === 'system'"
        @update="handleColorUpdate"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ThemeColorEditor from '../components/theme/ThemeColorEditor.vue';
import ThemeSchemeTabs from '../components/theme/ThemeSchemeTabs.vue';
import { useThemeScheme } from '../composables/useThemeScheme';
import { resolveThemeColors } from '../services/themeRuntime';
import { createThemeScheme } from '../services/themeSchemeStorage';
import type { ThemeColors } from '../types/theme';

const { state: themeState, save } = useThemeScheme();

const activeScheme = computed(() =>
  themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0],
);

const activeColors = computed(() => (activeScheme.value ? resolveThemeColors(activeScheme.value) : themeState.schemes[0].colors));

async function handleCreateScheme(): Promise<void> {
  const nextScheme = createThemeScheme(themeState.schemes.length);
  themeState.schemes.push(nextScheme);
  themeState.activeSchemeId = nextScheme.id;
  await save();
}

async function handleRemoveScheme(id: string): Promise<void> {
  const removingActive = themeState.activeSchemeId === id;
  themeState.schemes = themeState.schemes.filter((item) => item.id !== id || item.kind === 'system');

  if (removingActive) {
    themeState.activeSchemeId = themeState.schemes[0].id;
  }

  await save();
}

async function handleSelectScheme(id: string): Promise<void> {
  themeState.activeSchemeId = id;
  await save();
}

async function handleColorUpdate(colors: ThemeColors): Promise<void> {
  if (!activeScheme.value || activeScheme.value.kind === 'system') {
    return;
  }

  activeScheme.value.colors = colors;
  await save();
}
</script>

<style scoped>
.page-shell {
  width: 100%;
  min-height: 100%;
  display: grid;
  gap: 12px;
  align-content: start;
  padding: 12px;
  background: var(--translator-bg, #f8fafc);
}

.scheme-panel {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid #edf1f5;
  border-radius: 8px;
  background: var(--translator-surface, #ffffff);
  box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
}
</style>
