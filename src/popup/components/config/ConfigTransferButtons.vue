<template>
  <div class="transfer-row">
    <ElButton size="small" plain @click="handleExport">{{ t('configTransfer.export') }}</ElButton>
    <ElButton size="small" plain :loading="importing" @click="openFilePicker">{{ t('configTransfer.import') }}</ElButton>
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept="application/json,.json"
      @change="handleFileChange"
    >
  </div>
</template>

<script setup lang="ts">
import { ElButton, ElMessage } from 'element-plus';
import { ref } from 'vue';
import { useI18n } from '../../composables/useI18n';
import {
  exportConfigJson,
  importConfigJson,
  type ExportedConfigPackage,
} from '../../services/configImportExport';

const emit = defineEmits<{
  imported: [configPackage: ExportedConfigPackage];
}>();

const { t } = useI18n();
const fileInput = ref<HTMLInputElement>();
const importing = ref(false);

async function handleExport(): Promise<void> {
  const json = await exportConfigJson();
  downloadJson(json);
  ElMessage.success(t('configTransfer.exported'));
}

function openFilePicker(): void {
  fileInput.value?.click();
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  importing.value = true;

  try {
    const configPackage = await importConfigJson(await file.text());
    emit('imported', configPackage);
    ElMessage.success(t('configTransfer.imported'));
  } catch {
    ElMessage.error(t('configTransfer.importFailed'));
  } finally {
    importing.value = false;
    input.value = '';
  }
}

function downloadJson(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `translator-config-${formatTimestamp(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
</script>

<style scoped>
.transfer-row {
  display: flex;
  gap: 8px;
}

.file-input {
  display: none;
}
</style>
