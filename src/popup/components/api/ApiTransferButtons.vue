<template>
  <JsonTransferButtons
    :export-label="t('apiTransfer.export')"
    :import-label="t('apiTransfer.import')"
    @export="handleExport"
    @import="handleImport"
  />
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { useI18n } from '../../composables/useI18n';
import { exportApiConfigJson, importApiConfigJson } from '../../services/apiConfigTransfer';
import { downloadJsonFile } from '../../services/jsonFileTransfer';
import type { ApiConfigState } from '../../types/api';
import JsonTransferButtons from '../common/JsonTransferButtons.vue';

const emit = defineEmits<{
  imported: [state: ApiConfigState];
}>();

const { t } = useI18n();

async function handleExport(): Promise<void> {
  downloadJsonFile(await exportApiConfigJson(), 'translator-api-config');
  ElMessage.success(t('apiTransfer.exported'));
}

async function handleImport(json: string): Promise<void> {
  try {
    emit('imported', await importApiConfigJson(json));
    ElMessage.success(t('apiTransfer.imported'));
  } catch {
    ElMessage.error(t('apiTransfer.importFailed'));
  }
}
</script>
