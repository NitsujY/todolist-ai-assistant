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

  /** Optional per-user overrides for Brain Dump scene labels (stored in localStorage). */
  brainDumpSceneLabelsJson?: string;

  /** Default scene used when opening Brain Dump (set in Settings for a cleaner capture/review screen). */
  brainDumpDefaultSceneId?: 'brain-dump' | 'project-brainstorm' | 'dev-todo' | 'daily-reminders';

  /** Whether to include completed tasks in Brain Dump context by default. */
  brainDumpIncludeCompletedByDefault?: boolean;

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
  brainDumpSceneLabelsJson: '',
  brainDumpDefaultSceneId: 'brain-dump',
  brainDumpIncludeCompletedByDefault: true,
  smartTagsEnabled: true,
  taskBreakdownEnabled: true,
  taskBreakdownPrompt:
    'If the task is already a single clear action (can be done in <5 minutes), return EXACTLY ONE line: the original task rewritten clearly.\n\nOtherwise break it into 3–6 meaningful, do-able subtasks.\n\nRules:\n- One line per subtask, no numbering, no extra text.\n- Start each line with a strong verb (Draft, Call, Decide, Write, Fix, Test, Book…).\n- Avoid vague steps like "work on", "handle", "do research" unless you specify exactly what to produce.\n- Include an explicit first next action.\n\nTask: {{task}}',
  chatEnabled: false,
};
