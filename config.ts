export interface AIPluginConfig {
  provider: 'private' | 'openai' | 'gemini' | 'anthropic';
  apiKey?: string; // For BYOK
  model?: string;
  temperature?: number;
  privateEndpointUrl?: string;
  licenseKey?: string; // For private endpoint

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
