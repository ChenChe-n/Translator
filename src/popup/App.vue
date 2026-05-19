<template>
  <main class="popup-shell">
    <nav class="tab-nav" :aria-label="t('app.navAria')">
      <ElSegmented v-model="activeTab" class="tab-selector" :options="tabOptions" />
    </nav>
    <section class="page-stage">
      <Transition name="page-fade" mode="out-in">
        <component :is="activePanel" :key="activeTab" />
      </Transition>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ElSegmented } from 'element-plus';
import { computed, ref, type Component } from 'vue';
import ApiPage from './pages/ApiPage.vue';
import ConfigPage from './pages/ConfigPage.vue';
import MonitorPage from './pages/MonitorPage.vue';
import { useCurrentPagePort } from './composables/useCurrentPagePort';
import { useI18n } from './composables/useI18n';
import { useThemeScheme } from './composables/useThemeScheme';

type PopupTabKey = 'monitor' | 'config' | 'api';

const pageComponents: Record<PopupTabKey, Component> = {
  monitor: MonitorPage,
  config: ConfigPage,
  api: ApiPage,
};

const { t } = useI18n();
const activeTab = ref<PopupTabKey>('monitor');
const activePanel = computed(() => pageComponents[activeTab.value]);
const tabOptions = computed<Array<{ label: string; value: PopupTabKey }>>(() => [
  {
    label: t('app.tabs.monitor'),
    value: 'monitor',
  },
  {
    label: t('app.tabs.config'),
    value: 'config',
  },
  {
    label: t('app.tabs.api'),
    value: 'api',
  },
]);

useCurrentPagePort();
useThemeScheme();
</script>

<style scoped>
.popup-shell {
  width: 380px;
  height: 560px;
  padding: 12px;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--translator-background);
}

.tab-nav {
  padding: 3px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 24px var(--translator-shadow);
}

.tab-selector {
  width: 100%;
  --el-segmented-bg-color: var(--translator-button);
  --el-segmented-item-selected-bg-color: var(--translator-key-button);
  --el-segmented-item-selected-color: var(--translator-button);
  --el-border-radius-base: 7px;
  color: var(--translator-text);
}

.tab-selector :deep(.el-segmented__group) {
  width: 100%;
}

.tab-selector :deep(.el-segmented__item) {
  flex: 1;
  min-width: 0;
  height: 32px;
}

.tab-selector :deep(.el-segmented__item-label) {
  line-height: 32px;
}

.page-stage {
  min-height: 0;
  margin-top: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  overflow: auto;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
