/**
 * 配置更新范围。
 */
export type SettingsUpdateScope = 'foreground' | 'all';

/**
 * 运行行为配置。
 */
export interface RuntimeSettings {
  parseEnabled: boolean;
  translationEnabled: boolean;
  updateScope: SettingsUpdateScope;
}
