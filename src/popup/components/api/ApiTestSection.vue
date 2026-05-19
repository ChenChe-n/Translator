<template>
  <section class="test-section">
    <div class="section-head">
      <span class="title">{{ title }}</span>
      <ElButton size="small" type="primary" :loading="loading" @click="$emit('run')">测试</ElButton>
    </div>
    <slot />
    <ElInput
      :model-value="result"
      class="result-box"
      type="textarea"
      :rows="4"
      readonly
      placeholder="测试结果"
    />
  </section>
</template>

<script setup lang="ts">
import { ElButton, ElInput } from 'element-plus';

defineProps<{
  title: string;
  loading: boolean;
  result: string;
}>();

defineEmits<{
  run: [];
}>();
</script>

<style scoped>
.test-section {
  padding: 10px;
  border: 1px solid #edf1f5;
  border-radius: 8px;
  background: #ffffff;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
}

.result-box {
  margin-top: 8px;
}
</style>
