import { DEFAULT_CONFIG, type AIPluginConfig } from '../config';
import { useTodoStore } from '../../../store/useTodoStore';

export const AI_CONFIG_STORAGE_KEY = 'ai-plugin-config';

export function loadAIPluginConfig(): AIPluginConfig {
  // 1. Load local storage (contains secrets like apiKey)
  let localConfig: Partial<AIPluginConfig> = {};
  const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (raw) {
    try {
      localConfig = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse local AI config', e);
    }
  }

  // 2. Load unified config (synced settings, excludes secrets)
  const globalConfig = useTodoStore.getState().pluginConfig?.['ai-assistant'] || {};

  // 3. Merge: Default -> Local -> Global
  // Global overrides local for shared settings, but Local preserves secrets if Global lacks them.
  return {
    ...DEFAULT_CONFIG,
    ...localConfig,
    ...globalConfig,
  };
}

export function saveAIPluginConfig(config: AIPluginConfig) {
  // 1. Save FULL config to localStorage (so this device remembers the key)
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));

  // 2. Save SAFE config to unified storage (synced to cloud)
  // Exclude sensitive fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apiKey, licenseKey, ...safeConfig } = config;
  
  useTodoStore.getState().setPluginConfig('ai-assistant', safeConfig);
}
