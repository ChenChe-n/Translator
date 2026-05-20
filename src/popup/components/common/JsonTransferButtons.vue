<template>
  <div class="transfer-row">
    <ElButton size="small" plain @click="handleExport">{{ exportLabel }}</ElButton>
    <ElButton
      v-if="allowImport"
      size="small"
      plain
      :loading="importing"
      @click="openFilePicker"
    >
      {{ importLabel }}
    </ElButton>
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
import { computed, ref } from 'vue';
import { useI18n } from '../../composables/useI18n';

const props = withDefaults(defineProps<{
  allowImport?: boolean;
  exportLabel?: string;
  importLabel?: string;
}>(), {
  allowImport: true,
  exportLabel: '',
  importLabel: '',
});

const emit = defineEmits<{
  export: [];
  import: [json: string];
}>();

const { t } = useI18n();
const fileInput = ref<HTMLInputElement>();
const importing = ref(false);
const exportLabel = computed(() => props.exportLabel || t('jsonTransfer.export'));
const importLabel = computed(() => props.importLabel || t('jsonTransfer.import'));

function handleExport(): void {
  emit('export');
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
    emit('import', await file.text());
  } catch {
    ElMessage.error(t('jsonTransfer.importFailed'));
  } finally {
    importing.value = false;
    input.value = '';
  }
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
