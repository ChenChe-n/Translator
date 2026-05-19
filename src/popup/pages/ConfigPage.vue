<template>
  <section class="page-shell" :aria-label="t('app.tabs.config')">
    <ElSegmented v-model="activeConfigSection" class="section-tabs" :options="configSectionOptions" />
    <template v-if="activeConfigSection === 'theme'">
      <ThemeSchemeTabs
        :schemes="themeState.schemes"
        :active-scheme-id="themeState.activeSchemeId"
        @create="handleCreateScheme"
        @remove="handleRemoveScheme"
        @select="handleSelectScheme"
      />
      <section v-if="schemeExpanded" class="scheme-shell" :aria-label="t('theme.panelAria')">
        <ThemeColorEditor
          v-if="activeScheme"
          :colors="activeColors"
          :readonly="activeScheme.kind !== 'custom'"
          @update="handleColorUpdate"
        />
      </section>
    </template>
    <TranslationModeTabs
      v-else
      v-model:active-mode="activeTranslationMode"
      :config-map="translationModeConfigMap"
      @update="handleTranslationModeUpdate"
    />
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
import { ElOption, ElSegmented, ElSelect } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import type { LocaleCode } from '../../i18n';
import TranslationModeTabs from '../components/config/TranslationModeTabs.vue';
import ThemeColorEditor from '../components/theme/ThemeColorEditor.vue';
import ThemeSchemeTabs from '../components/theme/ThemeSchemeTabs.vue';
import { useI18n } from '../composables/useI18n';
import { useThemeScheme } from '../composables/useThemeScheme';
import { resolveThemeColors } from '../services/themeRuntime';
import { createThemeScheme } from '../services/themeSchemeStorage';
import {
  createDefaultTranslationModeConfigMap,
  loadTranslationModeConfigMap,
  saveTranslationModeConfigMap,
} from '../services/translationModeStorage';
import type { TranslationModeConfigMap, TranslationModeKey } from '../types/translationMode';
import type { ThemeColors } from '../types/theme';

type ConfigSectionKey = 'theme' | 'translationMode';

const { state: themeState, save } = useThemeScheme();
const { locale, localeOptions, setLocale, t } = useI18n();
const activeConfigSection = ref<ConfigSectionKey>('theme');
const schemeExpanded = ref(false);
const activeTranslationMode = ref<TranslationModeKey>('normal');
const translationModeConfigMap = reactive<TranslationModeConfigMap>(createDefaultTranslationModeConfigMap());

const activeScheme = computed(() =>
  themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0],
);

const activeColors = computed(() => (activeScheme.value ? resolveThemeColors(activeScheme.value) : themeState.schemes[0].colors));
const configSectionOptions = computed<Array<{ label: string; value: ConfigSectionKey }>>(() => [
  {
    label: t('config.sections.theme'),
    value: 'theme',
  },
  {
    label: t('config.sections.translationMode'),
    value: 'translationMode',
  },
]);

onMounted(async () => {
  Object.assign(translationModeConfigMap, await loadTranslationModeConfigMap());
});

async function handleCreateScheme(): Promise<void> {
  const customCount = themeState.schemes.filter((item) => item.kind === 'custom').length;
  const nextScheme = createThemeScheme(customCount + 1, t('theme.scheme.custom', { index: customCount + 1 }));
  themeState.schemes.push(nextScheme);
  themeState.activeSchemeId = nextScheme.id;
  schemeExpanded.value = true;
  await save();
}

async function handleRemoveScheme(id: string): Promise<void> {
  const removingActive = themeState.activeSchemeId === id;
  themeState.schemes = themeState.schemes.filter((item) => item.id !== id || item.kind !== 'custom');

  if (removingActive) {
    themeState.activeSchemeId = themeState.schemes[0].id;
    schemeExpanded.value = false;
  }

  await save();
}

async function handleSelectScheme(id: string): Promise<void> {
  if (themeState.activeSchemeId === id) {
    schemeExpanded.value = !schemeExpanded.value;
    return;
  }

  themeState.activeSchemeId = id;
  schemeExpanded.value = true;
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

async function handleTranslationModeUpdate(configMap: TranslationModeConfigMap): Promise<void> {
  Object.assign(translationModeConfigMap, configMap);
  await saveTranslationModeConfigMap(translationModeConfigMap);
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

.section-tabs {
  width: 100%;
  --el-segmented-bg-color: var(--translator-button);
  --el-segmented-item-selected-bg-color: var(--translator-key-button);
  --el-segmented-item-selected-color: var(--translator-button);
  --el-border-radius-base: 7px;
  color: var(--translator-text);
}

.section-tabs :deep(.el-segmented__group) {
  width: 100%;
}

.section-tabs :deep(.el-segmented__item) {
  flex: 1;
  min-width: 0;
  height: 32px;
}

.section-tabs :deep(.el-segmented__item-label) {
  line-height: 32px;
}

.scheme-shell {
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
