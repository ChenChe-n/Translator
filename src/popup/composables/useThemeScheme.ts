import { computed, onMounted, onUnmounted, reactive } from 'vue';
import { applyThemeColors, resolveThemeColors, watchSystemTheme } from '../services/themeRuntime';
import {
  createDefaultThemeSchemeState,
  clearThemeSchemeState,
  loadThemeSchemeState,
  saveThemeSchemeState,
} from '../services/themeSchemeStorage';
import type { ThemeSchemeState } from '../types/theme';

/**
 * 使用当前配色方案。
 *
 * @returns 配色状态。
 */
export function useThemeScheme(): { reset: () => Promise<void>; state: ThemeSchemeState; save: () => Promise<void> } {
  const state = reactive<ThemeSchemeState>(createDefaultThemeSchemeState());
  const activeScheme = computed(() => state.schemes.find((item) => item.id === state.activeSchemeId));
  let stopWatchingSystem: (() => void) | undefined;

  onMounted(async () => {
    Object.assign(state, await loadThemeSchemeState());
    applyActiveTheme();
    stopWatchingSystem = watchSystemTheme(applyActiveTheme);
  });

  onUnmounted(() => {
    stopWatchingSystem?.();
  });

  async function save(): Promise<void> {
    await saveThemeSchemeState(state);
    applyActiveTheme();
  }

  async function reset(): Promise<void> {
    Object.assign(state, await clearThemeSchemeState());
    applyActiveTheme();
  }

  function applyActiveTheme(): void {
    if (activeScheme.value) {
      applyThemeColors(resolveThemeColors(activeScheme.value));
    }
  }

  return {
    reset,
    state,
    save,
  };
}
