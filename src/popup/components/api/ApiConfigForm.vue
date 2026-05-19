<template>
  <ElForm label-position="top" class="config-form">
    <ElFormItem label="URL">
      <ElInput v-model="model.baseUrl" placeholder="https://api.openai.com/v1" clearable />
    </ElFormItem>
    <ElFormItem label="Key">
      <ElInput v-model="model.apiKey" type="password" placeholder="sk-..." show-password clearable />
    </ElFormItem>
    <ElFormItem label="模型名称">
      <ElInput v-model="model.model" placeholder="gpt-4.1-mini" clearable />
    </ElFormItem>
  </ElForm>
</template>

<script setup lang="ts">
import { ElForm, ElFormItem, ElInput } from 'element-plus';
import type { ApiConfig } from '../../types/api';

const model = defineModel<ApiConfig>({ required: true });
</script>

<style scoped>
.config-form {
  display: grid;
  gap: 2px;
}

.config-form :deep(.el-form-item) {
  margin-bottom: 10px;
}
</style>
