export interface AIPluginConfig {
  provider: 'private' | 'openai' | 'azure-openai' | 'gemini' | 'anthropic';
  apiKey?: string; // For BYOK
  model?: string;
  temperature?: number;
  privateEndpointUrl?: string;
  licenseKey?: string; // For private endpoint

  // Azure OpenAI (BYOK)
  azureEndpoint?: string; // e.g. https://<resource>.openai.azure.com
  azureApiVersion?: string; // e.g. 2024-06-01
  azureDeployment?: string; // deployment name in Azure OpenAI Studio

  voiceModeEnabled: boolean;
  speechToTextProvider: 'webSpeech' | 'whisper';
  speechLanguage: 'auto' | string;
  showVoiceTranscript: boolean;

  smartTagsEnabled: boolean;

  taskBreakdownEnabled: boolean;
  taskBreakdownPrompt: string;

  chatEnabled: boolean;
}

export const DEFAULT_CONFIG: AIPluginConfig = {
  provider: 'openai',
  model: '',
  temperature: 0.2,
  azureEndpoint: '',
  azureApiVersion: '',
  azureDeployment: '',
  voiceModeEnabled: true,
  speechToTextProvider: 'webSpeech',
  speechLanguage: 'auto',
  showVoiceTranscript: true,
  smartTagsEnabled: true,
  taskBreakdownEnabled: true,
  taskBreakdownPrompt:
    'Break down the following task into 3–8 clear subtasks. Return ONLY the subtasks, one per line, no numbering, no extra text.\n\nTask: {{task}}',
  chatEnabled: false,
};
