export interface AIPluginConfig {
  provider: 'private' | 'openai' | 'gemini' | 'anthropic';
  apiKey?: string; // For BYOK
  privateEndpointUrl?: string;
  licenseKey?: string; // For private endpoint
  voiceModeEnabled: boolean;
  smartTagsEnabled: boolean;
}

export const DEFAULT_CONFIG: AIPluginConfig = {
  provider: 'private',
  voiceModeEnabled: true,
  smartTagsEnabled: true,
};
