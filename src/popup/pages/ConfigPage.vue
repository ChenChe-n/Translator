<template>
  <section class="page-shell" :aria-label="t('app.tabs.config')">
    <section class="scheme-panel" :aria-label="t('theme.panelAria')">
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
        :readonly="activeScheme.kind !== 'custom'"
        @update="handleColorUpdate"
      />
    </section>
    <section class="language-panel" :aria-label="t('language.label')">
      <span class="language-label">{{ t('language.label') }}</span>
      <ElSelect
        class="language-select"
        :model-value="locale"
        size="small"
        @change="handleLocaleChange"
      >
        <ElOption
          v-for="option in localeOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </ElSelect>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ElOption, ElSelect } from 'element-plus';
import { computed } from 'vue';
import type { LocaleCode } from '../../i18n';
import ThemeColorEditor from '../components/theme/ThemeColorEditor.vue';
import ThemeSchemeTabs from '../components/theme/ThemeSchemeTabs.vue';
import { useI18n } from '../composables/useI18n';
import { useThemeScheme } from '../composables/useThemeScheme';
import { resolveThemeColors } from '../services/themeRuntime';
import { createThemeScheme } from '../services/themeSchemeStorage';
import type { ThemeColors } from '../types/theme';

const { state: themeState, save } = useThemeScheme();
const { locale, localeOptions, setLocale, t } = useI18n();

const activeScheme = computed(() =>
  themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0],
);

const activeColors = computed(() => (activeScheme.value ? resolveThemeColors(activeScheme.value) : themeState.schemes[0].colors));

async function handleCreateScheme(): Promise<void> {
  const customCount = themeState.schemes.filter((item) => item.kind === 'custom').length;
  const nextScheme = createThemeScheme(customCount + 1, t('theme.scheme.custom', { index: customCount + 1 }));
  themeState.schemes.push(nextScheme);
  themeState.activeSchemeId = nextScheme.id;
  await save();
}

async function handleRemoveScheme(id: string): Promise<void> {
  const removingActive = themeState.activeSchemeId === id;
  themeState.schemes = themeState.schemes.filter((item) => item.id !== id || item.kind !== 'custom');

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

async function handleLocaleChange(value: LocaleCode): Promise<void> {
  await setLocale(value);
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
  background: var(--translator-background);
}

.scheme-panel {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 20px var(--translator-shadow);
}

.language-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 150px);
  gap: 12px;
  align-items: center;
  justify-content: end;
  padding: 0 12px;
}

.language-label {
  color: var(--translator-muted);
  font-size: 12px;
}

.language-select {
  width: 150px;
}
</style>
