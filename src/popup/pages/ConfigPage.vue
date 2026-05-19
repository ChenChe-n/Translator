<template>
  <section class="page-shell" :aria-label="t('app.tabs.config')">
    <PageClearButton @clear="handleClearPage" />
    <section class="config-block">
      <h2 class="block-title">{{ t('theme.panelTitle') }}</h2>
      <p class="block-description">{{ t('theme.panelDescription') }}</p>
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
    </section>
    <TranslationModeTabs
      v-model:active-mode="activeTranslationMode"
      :config-map="translationModeConfigMap"
      :enabled="runtimeSettings.translationEnabled"
      :expanded="translationModeExpanded"
      @select="handleSelectTranslationMode"
      @toggle-enabled="handleTranslationEnabledUpdate"
      @update="handleTranslationModeUpdate"
    />
    <TextParseModeTabs
      v-model:active-mode="activeTextParseMode"
      :config-map="textParseModeConfigMap"
      :enabled="runtimeSettings.parseEnabled"
      :expanded="textParseModeExpanded"
      @select="handleSelectTextParseMode"
      @toggle-enabled="handleParseEnabledUpdate"
      @update="handleTextParseModeUpdate"
    />
    <UpdateScopeTabs :model-value="runtimeSettings.updateScope" @update:model-value="handleUpdateScopeUpdate" />
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
import { ElMessage, ElOption, ElSelect } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import type { LocaleCode } from '../../i18n';
import PageClearButton from '../components/common/PageClearButton.vue';
import TextParseModeTabs from '../components/config/TextParseModeTabs.vue';
import TranslationModeTabs from '../components/config/TranslationModeTabs.vue';
import UpdateScopeTabs from '../components/config/UpdateScopeTabs.vue';
import ThemeColorEditor from '../components/theme/ThemeColorEditor.vue';
import ThemeSchemeTabs from '../components/theme/ThemeSchemeTabs.vue';
import { useI18n } from '../composables/useI18n';
import { useThemeScheme } from '../composables/useThemeScheme';
import { resolveThemeColors } from '../services/themeRuntime';
import {
  clearRuntimeSettings,
  createDefaultRuntimeSettings,
  loadRuntimeSettings,
  saveRuntimeSettings,
} from '../services/runtimeSettingsStorage';
import { createThemeScheme } from '../services/themeSchemeStorage';
import {
  clearTranslationModeConfigMap,
  createDefaultTranslationModeConfigMap,
  loadTranslationModeConfigMap,
  saveTranslationModeConfigMap,
} from '../services/translationModeStorage';
import { clearNormalTranslationCache } from '../services/normalTranslationCacheStorage';
import {
  clearTextParseModeConfigMap,
  createDefaultTextParseModeConfigMap,
  loadActiveTextParseMode,
  loadTextParseModeConfigMap,
  saveActiveTextParseMode,
  saveTextParseModeConfigMap,
} from '../services/textParseModeStorage';
import type { TextParseModeConfigMap, TextParseModeKey } from '../types/textParseMode';
import type { TranslationModeConfigMap, TranslationModeKey } from '../types/translationMode';
import type { ThemeColors } from '../types/theme';
import type { RuntimeSettings, SettingsUpdateScope } from '../types/runtimeSettings';

const { reset: resetTheme, state: themeState, save } = useThemeScheme();
const { locale, localeOptions, resetLocale, setLocale, t } = useI18n();
const schemeExpanded = ref(false);
const translationModeExpanded = ref(false);
const textParseModeExpanded = ref(false);
const activeTranslationMode = ref<TranslationModeKey>('normal');
const activeTextParseMode = ref<TextParseModeKey>('visible');
const translationModeConfigMap = reactive<TranslationModeConfigMap>(createDefaultTranslationModeConfigMap());
const textParseModeConfigMap = reactive<TextParseModeConfigMap>(createDefaultTextParseModeConfigMap());
const runtimeSettings = reactive<RuntimeSettings>(createDefaultRuntimeSettings());

const activeScheme = computed(() =>
  themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0],
);

const activeColors = computed(() => (activeScheme.value ? resolveThemeColors(activeScheme.value) : themeState.schemes[0].colors));

onMounted(async () => {
  const [translationModeConfig, textParseModeConfig, nextRuntimeSettings] = await Promise.all([
    loadTranslationModeConfigMap(),
    loadTextParseModeConfigMap(),
    loadRuntimeSettings(),
  ]);

  Object.assign(translationModeConfigMap, translationModeConfig);
  Object.assign(textParseModeConfigMap, textParseModeConfig);
  Object.assign(runtimeSettings, nextRuntimeSettings);
  activeTextParseMode.value = await loadActiveTextParseMode();
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

async function handleClearPage(): Promise<void> {
  const [, , translationConfig, textParseConfig, settings] = await Promise.all([
    resetTheme(),
    resetLocale(),
    clearTranslationModeConfigMap(),
    clearNormalTranslationCache(),
    clearTextParseModeConfigMap(),
    clearRuntimeSettings(),
  ]);

  Object.assign(translationModeConfigMap, translationConfig);
  Object.assign(textParseModeConfigMap, textParseConfig);
  Object.assign(runtimeSettings, settings);
  activeTranslationMode.value = 'normal';
  activeTextParseMode.value = 'visible';
  schemeExpanded.value = false;
  translationModeExpanded.value = false;
  textParseModeExpanded.value = false;
  ElMessage.success(t('common.cleared'));
}

function handleSelectTranslationMode(mode: TranslationModeKey): void {
  if (activeTranslationMode.value === mode) {
    translationModeExpanded.value = !translationModeExpanded.value;
    return;
  }

  activeTranslationMode.value = mode;
  translationModeExpanded.value = true;
}

async function handleTranslationModeUpdate(configMap: TranslationModeConfigMap): Promise<void> {
  Object.assign(translationModeConfigMap, configMap);
  await saveTranslationModeConfigMap(translationModeConfigMap);
}

function handleSelectTextParseMode(mode: TextParseModeKey): void {
  if (activeTextParseMode.value === mode) {
    textParseModeExpanded.value = !textParseModeExpanded.value;
    return;
  }

  activeTextParseMode.value = mode;
  textParseModeExpanded.value = true;
  void saveActiveTextParseMode(mode);
}

async function handleTextParseModeUpdate(configMap: TextParseModeConfigMap): Promise<void> {
  Object.assign(textParseModeConfigMap, configMap);
  await saveTextParseModeConfigMap(textParseModeConfigMap);
}

async function handleRuntimeSettingsUpdate(settings: RuntimeSettings): Promise<void> {
  Object.assign(runtimeSettings, settings);
  await saveRuntimeSettings(runtimeSettings);
}

async function handleParseEnabledUpdate(enabled: boolean): Promise<void> {
  await handleRuntimeSettingsUpdate({
    ...runtimeSettings,
    parseEnabled: enabled,
  });
}

async function handleTranslationEnabledUpdate(enabled: boolean): Promise<void> {
  await handleRuntimeSettingsUpdate({
    ...runtimeSettings,
    translationEnabled: enabled,
  });
}

async function handleUpdateScopeUpdate(updateScope: SettingsUpdateScope): Promise<void> {
  await handleRuntimeSettingsUpdate({
    ...runtimeSettings,
    updateScope,
  });
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

.config-block {
  display: grid;
  gap: 8px;
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
