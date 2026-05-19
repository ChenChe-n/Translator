<template>
  <section class="page-shell" :aria-label="t('app.tabs.monitor')"></section>
</template>

<script setup lang="ts">
import { useI18n } from '../composables/useI18n';

const { t } = useI18n();
</script>

<style scoped>
.page-shell {
  width: 100%;
  height: 100%;
}
</style>
