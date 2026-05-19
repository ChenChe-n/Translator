<template>
  <section class="metric-card">
    <div class="metric-head">
      <h2 class="panel-title">{{ t('monitor.textParseDurationTitle') }}</h2>
      <ElTag size="small" effect="plain">{{ t('monitor.recentCalls', { count: metrics.length }) }}</ElTag>
    </div>
    <div class="summary-row">
      <span>{{ t('monitor.latestDuration') }} {{ latestDuration }}ms</span>
      <span>{{ t('monitor.averageDuration') }} {{ averageDuration }}ms</span>
    </div>
    <div class="chart-shell">
      <ElEmpty v-if="points.length === 0" :description="t('monitor.emptyMetrics')" :image-size="48" />
      <svg v-else class="line-chart" viewBox="0 0 320 140" role="img" :aria-label="t('monitor.textParseDurationTitle')">
        <polyline class="grid-line" points="24,20 306,20" />
        <polyline class="grid-line" points="24,76 306,76" />
        <polyline class="grid-line" points="24,132 306,132" />
        <polyline class="duration-line" :points="linePoints" />
        <circle
          v-for="point in points"
          :key="point.id"
          class="duration-point"
          :cx="point.x"
          :cy="point.y"
          r="3"
        />
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ElEmpty, ElTag } from 'element-plus';
import { computed } from 'vue';
import { useI18n } from '../../composables/useI18n';
import type { TextParseMetric } from '../../types/textParseMetrics';

const props = defineProps<{
  metrics: TextParseMetric[];
}>();

const { t } = useI18n();
const chartWidth = 282;
const chartHeight = 112;
const chartLeft = 24;
const chartTop = 20;

const latestDuration = computed(() => props.metrics.at(-1)?.durationMs ?? 0);
const averageDuration = computed(() => {
  const total = props.metrics.reduce((sum, item) => sum + item.durationMs, 0);
  return props.metrics.length === 0 ? 0 : Math.round(total / props.metrics.length);
});
const points = computed(() => {
  const maxDuration = Math.max(...props.metrics.map((item) => item.durationMs), 1);
  const lastIndex = Math.max(props.metrics.length - 1, 1);

  return props.metrics.map((item, index) => ({
    id: item.id,
    x: chartLeft + (index / lastIndex) * chartWidth,
    y: chartTop + chartHeight - (item.durationMs / maxDuration) * chartHeight,
  }));
});
const linePoints = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '));
</script>

<style scoped>
.metric-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
}

.metric-head,
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-title {
  margin: 0;
  color: var(--translator-text);
  font-size: 13px;
  font-weight: 600;
}

.summary-row {
  color: var(--translator-muted);
  font-size: 11px;
}

.chart-shell {
  min-height: 150px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--translator-button);
}

.line-chart {
  width: 100%;
  height: 150px;
}

.grid-line {
  fill: none;
  stroke: var(--translator-border);
  stroke-width: 1;
}

.duration-line {
  fill: none;
  stroke: var(--translator-marker);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.duration-point {
  fill: var(--translator-marker);
  stroke: var(--translator-container);
  stroke-width: 2;
}
</style>
