import { DEFAULT_CONFIG, type AIPluginConfig } from '../config';

export const AI_CONFIG_STORAGE_KEY = 'ai-plugin-config';

export function loadAIPluginConfig(): AIPluginConfig {
  const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };

  try {
    const parsed = JSON.parse(raw) as Partial<AIPluginConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    };
  } catch (e) {
    console.error('Failed to parse AI config', e);
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAIPluginConfig(config: AIPluginConfig) {
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
}
