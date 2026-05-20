<template>
  <section class="page-shell" :aria-label="t('app.tabs.config')">
    <div class="page-action-row">
      <ConfigTransferButtons @imported="handleConfigImported" />
      <PageClearButton @clear="handleClearPage" />
    </div>
    <ThemeConfigBlock
      :state="themeState"
      :expanded="schemeExpanded"
      @create="handleCreateScheme"
      @remove="handleRemoveScheme"
      @select="handleSelectScheme"
      @update-colors="handleColorUpdate"
    />
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
import { onMounted, reactive, ref } from 'vue';
import type { LocaleCode } from '../../i18n';
import ConfigTransferButtons from '../components/config/ConfigTransferButtons.vue';
import PageClearButton from '../components/common/PageClearButton.vue';
import TextParseModeTabs from '../components/config/TextParseModeTabs.vue';
import ThemeConfigBlock from '../components/config/ThemeConfigBlock.vue';
import TranslationModeTabs from '../components/config/TranslationModeTabs.vue';
import UpdateScopeTabs from '../components/config/UpdateScopeTabs.vue';
import { useI18n } from '../composables/useI18n';
import { useThemeScheme } from '../composables/useThemeScheme';
import { applyThemeColors, resolveThemeColors } from '../services/themeRuntime';
import {
  clearRuntimeSettings,
  createDefaultRuntimeSettings,
  loadRuntimeSettings,
  saveRuntimeSettings,
} from '../services/runtimeSettingsStorage';
import { createThemeScheme } from '../services/themeSchemeStorage';
import {
  loadActiveTranslationMode,
  clearTranslationModeConfigMap,
  createDefaultTranslationModeConfigMap,
  loadTranslationModeConfigMap,
  saveActiveTranslationMode,
  saveTranslationModeConfigMap,
} from '../services/translationModeStorage';
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
import type { ExportedConfigPackage } from '../services/configImportExport';

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

onMounted(async () => {
  const [translationModeConfig, textParseModeConfig, nextRuntimeSettings, nextTranslationMode] = await Promise.all([
    loadTranslationModeConfigMap(),
    loadTextParseModeConfigMap(),
    loadRuntimeSettings(),
    loadActiveTranslationMode(),
  ]);

  Object.assign(translationModeConfigMap, translationModeConfig);
  Object.assign(textParseModeConfigMap, textParseModeConfig);
  Object.assign(runtimeSettings, nextRuntimeSettings);
  activeTranslationMode.value = nextTranslationMode;
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
  const activeScheme = themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0];

  if (!activeScheme || activeScheme.kind === 'system') {
    return;
  }

  activeScheme.colors = colors;
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
    clearTextParseModeConfigMap(),
    clearRuntimeSettings(),
  ]);

  Object.assign(translationModeConfigMap, translationConfig);
  Object.assign(textParseModeConfigMap, textParseConfig);
  Object.assign(runtimeSettings, settings);
  activeTranslationMode.value = 'normal';
  activeTextParseMode.value = 'visible';
  collapsePanels();
  ElMessage.success(t('common.cleared'));
}

async function handleConfigImported(configPackage: ExportedConfigPackage): Promise<void> {
  Object.assign(themeState, configPackage.themeSchemeState);
  Object.assign(runtimeSettings, configPackage.runtimeSettings);
  Object.assign(translationModeConfigMap, configPackage.translationModeConfigMap);
  Object.assign(textParseModeConfigMap, configPackage.textParseMode.configMap);
  await setLocale(configPackage.locale);
  activeTranslationMode.value = configPackage.translationMode.activeMode;
  activeTextParseMode.value = configPackage.textParseMode.activeMode;
  collapsePanels();
  applyThemeColors(readActiveThemeColors());
}

function readActiveThemeColors(): ThemeColors {
  const activeScheme = themeState.schemes.find((item) => item.id === themeState.activeSchemeId) ?? themeState.schemes[0];
  return resolveThemeColors(activeScheme);
}

function collapsePanels(): void {
  schemeExpanded.value = false;
  translationModeExpanded.value = false;
  textParseModeExpanded.value = false;
}

function handleSelectTranslationMode(mode: TranslationModeKey): void {
  if (mode === 'context') {
    translationModeExpanded.value = false;
    ElMessage.info(t('translationMode.contextPlaceholder'));
    return;
  }

  if (activeTranslationMode.value === mode) {
    translationModeExpanded.value = !translationModeExpanded.value;
    return;
  }

  activeTranslationMode.value = mode;
  translationModeExpanded.value = true;
  void saveActiveTranslationMode(mode);
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
  gap: 12px;
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

.language-select { width: 150px; }
</style>
