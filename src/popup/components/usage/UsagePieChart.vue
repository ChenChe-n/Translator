<template>
  <div class="pie-wrap">
    <div class="pie" :style="{ background: pieBackground }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ModelUsageRankItem } from '../../services/modelUsageAggregator';

const props = defineProps<{
  items: ModelUsageRankItem[];
}>();

const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

const pieBackground = computed(() => {
  if (props.items.length === 0) {
    return 'conic-gradient(#e2e8f0 0% 68%, #f1f5f9 68% 100%)';
  }

  let cursor = 0;
  const segments = props.items.map((item, index) => {
    const start = cursor;
    const end = cursor + item.percent;
    cursor = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });

  return `conic-gradient(${segments.join(', ')})`;
});
</script>

<style scoped>
.pie-wrap {
  min-height: 140px;
  display: grid;
  place-items: center;
}

.pie {
  width: 118px;
  height: 118px;
  border: 10px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 10px 26px rgb(15 23 42 / 12%);
}
</style>
