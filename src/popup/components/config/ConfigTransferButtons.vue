<template>
  <JsonTransferButtons
    :export-label="t('configTransfer.export')"
    :import-label="t('configTransfer.import')"
    @export="handleExport"
    @import="handleImport"
  />
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { useI18n } from '../../composables/useI18n';
import JsonTransferButtons from '../common/JsonTransferButtons.vue';
import {
  exportConfigJson,
  importConfigJson,
  type ExportedConfigPackage,
} from '../../services/configImportExport';
import { downloadJsonFile } from '../../services/jsonFileTransfer';

const emit = defineEmits<{
  imported: [configPackage: ExportedConfigPackage];
}>();

const { t } = useI18n();

async function handleExport(): Promise<void> {
  const json = await exportConfigJson();
  downloadJsonFile(json, 'translator-config');
  ElMessage.success(t('configTransfer.exported'));
}

async function handleImport(json: string): Promise<void> {
  try {
    const configPackage = await importConfigJson(json);
    emit('imported', configPackage);
    ElMessage.success(t('configTransfer.imported'));
  } catch {
    ElMessage.error(t('configTransfer.importFailed'));
  }
}
</script>
