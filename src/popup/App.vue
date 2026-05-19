<template>
  <main class="popup-shell">
    <nav class="tab-nav" aria-label="页面选择">
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

type PopupTabKey = 'monitor' | 'config' | 'api';

const tabOptions: Array<{ label: string; value: PopupTabKey }> = [
  {
    label: '监控',
    value: 'monitor',
  },
  {
    label: '配置',
    value: 'config',
  },
  {
    label: 'api',
    value: 'api',
  },
];

const pageComponents: Record<PopupTabKey, Component> = {
  monitor: MonitorPage,
  config: ConfigPage,
  api: ApiPage,
};

const activeTab = ref<PopupTabKey>('monitor');
const activePanel = computed(() => pageComponents[activeTab.value]);

useCurrentPagePort();
</script>

<style scoped>
.popup-shell {
  width: 380px;
  height: 560px;
  padding: 12px;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto 1fr;
  background: #f8fafc;
}

.tab-nav {
  padding: 3px;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
}

.tab-selector {
  width: 100%;
  --el-segmented-bg-color: #eef2f7;
  --el-segmented-item-selected-bg-color: #1f2937;
  --el-segmented-item-selected-color: #ffffff;
  --el-border-radius-base: 7px;
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
  border: 1px solid #edf1f5;
  border-radius: 8px;
  background: #ffffff;
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
