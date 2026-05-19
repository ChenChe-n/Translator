/**
 * 配置更新范围。
 */
export type SettingsUpdateScope = 'foreground' | 'all';

/**
 * 运行开关配置。
 */
export interface RuntimeSettings {
  enabled: boolean;
  updateScope: SettingsUpdateScope;
}
