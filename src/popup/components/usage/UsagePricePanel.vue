<template>
  <section class="detail-panel">
    <h3 class="detail-title">{{ t('usage.priceTitle') }}</h3>
    <dl class="price-list">
      <div class="price-row">
        <dt>{{ t('usage.inputCost') }}</dt>
        <dd>{{ formatPrice(inputCost) }}</dd>
      </div>
      <div class="price-row">
        <dt>{{ t('usage.cachedInputCost') }}</dt>
        <dd>{{ formatPrice(cachedInputCost) }}</dd>
      </div>
      <div class="price-row">
        <dt>{{ t('usage.outputCost') }}</dt>
        <dd>{{ formatPrice(outputCost) }}</dd>
      </div>
      <div class="price-row total">
        <dt>{{ t('usage.totalCost') }}</dt>
        <dd>{{ formatPrice(totalCost) }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { ApiPriceConfig } from '../../types/api';

const props = defineProps<{
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  prices: ApiPriceConfig;
}>();

const { t } = useI18n();
const priceUnit = 1_000_000;
const inputCost = computed(() => calculateCost(props.inputTokens, props.prices.inputTokenPrice));
const cachedInputCost = computed(() => calculateCost(props.cachedInputTokens, props.prices.cachedInputTokenPrice));
const outputCost = computed(() => calculateCost(props.outputTokens, props.prices.outputTokenPrice));
const totalCost = computed(() => inputCost.value + cachedInputCost.value + outputCost.value);

function calculateCost(tokens: number, price: number): number {
  return (tokens / priceUnit) * (Number.isFinite(price) ? price : 0);
}

function formatPrice(value: number): string {
  return `$${value.toFixed(6)}`;
}
</script>

<style scoped>
.detail-panel {
  min-width: 0;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-button);
}

.detail-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 12px;
  font-weight: 600;
}

.price-list {
  display: grid;
  gap: 7px;
  margin: 0;
}

.price-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  color: var(--translator-muted);
  font-size: 11px;
}

.price-row dt,
.price-row dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.price-row dd {
  color: var(--translator-text);
  font-weight: 600;
}

.price-row.total {
  padding-top: 5px;
  border-top: 1px solid var(--translator-border);
  color: var(--translator-text);
}
</style>
