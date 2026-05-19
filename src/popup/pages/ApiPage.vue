<template>
  <section class="page-shell" aria-label="api">
    <ApiConfigForm v-model="config" @save="handleSave" />
    <ApiTestSection title="文本输入" :loading="testing.text" :result="results.text" @run="handleTextTest">
      <ElInput v-model="textInput.prompt" type="textarea" :rows="3" placeholder="输入测试文本" />
    </ApiTestSection>
    <ApiTestSection title="图片输入" :loading="testing.image" :result="results.image" @run="handleImageTest">
      <ElInput v-model="imageInput.prompt" type="textarea" :rows="2" placeholder="输入图片问题" />
      <ElInput v-model="imageInput.imageUrl" class="field-gap" placeholder="输入图片 URL 或选择本地图片" clearable />
      <ElButton class="field-gap image-button" @click="openImagePicker">
        {{ imageInput.imageName || '选择图片' }}
      </ElButton>
      <input ref="imagePickerRef" class="file-input" type="file" accept="image/*" @change="handleImageFile" />
    </ApiTestSection>
    <ApiTestSection title="流式输出" :loading="testing.stream" :result="results.stream" @run="handleStreamTest">
      <ElInput v-model="streamInput.prompt" type="textarea" :rows="3" placeholder="输入流式测试文本" />
    </ApiTestSection>
  </section>
</template>

<script setup lang="ts">
import { ElButton, ElInput, ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import ApiConfigForm from '../components/api/ApiConfigForm.vue';
import ApiTestSection from '../components/api/ApiTestSection.vue';
import { loadApiConfig, saveApiConfig } from '../services/apiConfigStorage';
import { testImage, testStream, testText } from '../services/openAiCompatibleClient';
import type { ApiConfig, ImageTestInput, StreamTestInput, TextTestInput } from '../types/api';

const config = ref<ApiConfig>({
  baseUrl: '',
  apiKey: '',
  model: '',
});

const textInput = reactive<TextTestInput>({
  prompt: '',
});

const imageInput = reactive<ImageTestInput>({
  prompt: '',
  imageUrl: '',
  imageName: '',
});

const streamInput = reactive<StreamTestInput>({
  prompt: '',
});

const testing = reactive({
  text: false,
  image: false,
  stream: false,
});

const results = reactive({
  text: '',
  image: '',
  stream: '',
});

const imagePickerRef = ref<HTMLInputElement>();

onMounted(async () => {
  config.value = await loadApiConfig();
});

async function handleSave(): Promise<void> {
  await saveApiConfig({ ...config.value });
  ElMessage.success('配置已保存');
}

async function handleTextTest(): Promise<void> {
  await runTest('text', async () => {
    ensureTextPrompt(textInput.prompt);
    const result = await testText(config.value, textInput);
    results.text = result.content;
  });
}

async function handleImageTest(): Promise<void> {
  await runTest('image', async () => {
    ensureTextPrompt(imageInput.prompt);
    ensureImageInput();
    const result = await testImage(config.value, imageInput);
    results.image = result.content;
  });
}

async function handleStreamTest(): Promise<void> {
  results.stream = '';
  await runTest('stream', async () => {
    ensureTextPrompt(streamInput.prompt);
    await testStream(config.value, streamInput, (delta) => {
      results.stream += delta;
    });
  });
}

async function runTest(name: keyof typeof testing, task: () => Promise<void>): Promise<void> {
  testing[name] = true;

  try {
    ensureConfig();
    await task();
    ElMessage.success('测试完成');
  } catch (error) {
    results[name] = error instanceof Error ? error.message : '测试失败';
    ElMessage.error('测试失败');
  } finally {
    testing[name] = false;
  }
}

function ensureConfig(): void {
  if (!config.value.baseUrl || !config.value.apiKey || !config.value.model) {
    throw new Error('请先填写 URL、Key 和模型名称。');
  }
}

function ensureTextPrompt(prompt: string): void {
  if (!prompt.trim()) {
    throw new Error('请输入测试内容。');
  }
}

function ensureImageInput(): void {
  if (!imageInput.imageUrl.trim()) {
    throw new Error('请输入图片 URL 或选择本地图片。');
  }
}

function openImagePicker(): void {
  imagePickerRef.value?.click();
}

async function handleImageFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  imageInput.imageName = file.name;
  imageInput.imageUrl = await readFileAsDataUrl(file);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(new Error('读取图片失败。')));
    reader.readAsDataURL(file);
  });
}
</script>

<style scoped>
.page-shell {
  width: 100%;
  display: grid;
  gap: 10px;
  padding: 10px;
  background: #f8fafc;
}

.field-gap {
  margin-top: 8px;
}

.image-button {
  width: 100%;
}

.file-input {
  display: none;
}
</style>
