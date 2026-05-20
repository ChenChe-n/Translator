<template>
  <section class="config-block">
    <h2 class="block-title">{{ t('theme.panelTitle') }}</h2>
    <p class="block-description">{{ t('theme.panelDescription') }}</p>
    <ThemeSchemeTabs
      :schemes="state.schemes"
      :active-scheme-id="state.activeSchemeId"
      @create="$emit('create')"
      @remove="$emit('remove', $event)"
      @select="$emit('select', $event)"
    />
    <section v-if="expanded" class="scheme-shell" :aria-label="t('theme.panelAria')">
      <ThemeColorEditor
        v-if="activeScheme"
        :colors="activeColors"
        :readonly="activeScheme.kind !== 'custom'"
        @update="$emit('updateColors', $event)"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ThemeColorEditor from '../theme/ThemeColorEditor.vue';
import ThemeSchemeTabs from '../theme/ThemeSchemeTabs.vue';
import { useI18n } from '../../composables/useI18n';
import { resolveThemeColors } from '../../services/themeRuntime';
import type { ThemeColors, ThemeSchemeState } from '../../types/theme';

const props = defineProps<{
  expanded: boolean;
  state: ThemeSchemeState;
}>();

defineEmits<{
  create: [];
  remove: [id: string];
  select: [id: string];
  updateColors: [colors: ThemeColors];
}>();

const { t } = useI18n();
const activeScheme = computed(() =>
  props.state.schemes.find((item) => item.id === props.state.activeSchemeId) ?? props.state.schemes[0],
);
const activeColors = computed(() => (activeScheme.value ? resolveThemeColors(activeScheme.value) : props.state.schemes[0].colors));
</script>

<style scoped>
.scheme-shell {
  display: grid;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--translator-border);
  border-radius: 8px;
  background: var(--translator-container);
  box-shadow: 0 8px 20px var(--translator-shadow);
}
</style>
