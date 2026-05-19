<template>
  <div class="clear-row">
    <ElPopconfirm
      :title="t('common.clearConfirm')"
      :confirm-button-text="t('common.clear')"
      :cancel-button-text="t('common.clearCancel')"
      @confirm="$emit('clear')"
    >
      <template #reference>
        <ElButton size="small" plain>{{ t('common.clear') }}</ElButton>
      </template>
    </ElPopconfirm>
  </div>
</template>

<script setup lang="ts">
import { ElButton, ElPopconfirm } from 'element-plus';
import { useI18n } from '../../composables/useI18n';

defineEmits<{
  clear: [];
}>();

const { t } = useI18n();
</script>

<style scoped>
.clear-row {
  display: flex;
  justify-content: end;
}
</style>
