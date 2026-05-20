<template>
  <ElForm label-position="top" class="config-form">
    <ElFormItem :label="t('api.form.name')">
      <ElInput v-model="model.name" :placeholder="t('api.form.namePlaceholder')" clearable />
    </ElFormItem>
    <ElFormItem :label="t('api.form.url')">
      <ElInput v-model="model.baseUrl" placeholder="https://api.openai.com/v1" clearable />
    </ElFormItem>
    <ElFormItem :label="t('api.form.key')">
      <ElInput v-model="model.apiKey" type="password" placeholder="sk-..." show-password clearable />
    </ElFormItem>
    <ElFormItem :label="t('api.form.model')">
      <ElInput v-model="model.model" placeholder="gpt-4.1-mini" clearable />
    </ElFormItem>
    <ElFormItem :label="t('api.form.maxConcurrency')">
      <ElInputNumber
        v-model="model.maxConcurrency"
        :min="1"
        :max="65536"
        controls-position="right"
      />
    </ElFormItem>
    <div class="price-grid">
      <ElFormItem :label="t('api.form.inputTokenPrice')">
        <ElInputNumber v-model="model.inputTokenPrice" :min="0" :precision="6" controls-position="right" />
      </ElFormItem>
      <ElFormItem :label="t('api.form.cachedInputTokenPrice')">
        <ElInputNumber v-model="model.cachedInputTokenPrice" :min="0" :precision="6" controls-position="right" />
      </ElFormItem>
      <ElFormItem :label="t('api.form.outputTokenPrice')">
        <ElInputNumber v-model="model.outputTokenPrice" :min="0" :precision="6" controls-position="right" />
      </ElFormItem>
    </div>
  </ElForm>
</template>

<script setup lang="ts">
import { ElForm, ElFormItem, ElInput, ElInputNumber } from 'element-plus';
import { useI18n } from '../../composables/useI18n';
import type { ApiConfig } from '../../types/api';

const model = defineModel<ApiConfig>({ required: true });
const { t } = useI18n();
</script>

<style scoped>
.config-form {
  display: grid;
  gap: 2px;
}

.config-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.config-form :deep(.el-input-number) {
  width: 100%;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
</style>
