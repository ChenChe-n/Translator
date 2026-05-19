<template>
  <main class="popup-shell"></main>
</template>

<script setup lang="ts">
import { useCurrentPagePort } from './composables/useCurrentPagePort';

useCurrentPagePort();
</script>

<style scoped>
.popup-shell {
  width: 320px;
  min-height: 240px;
  background: #ffffff;
}
</style>
