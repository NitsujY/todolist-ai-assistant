import type { Task } from '../../../lib/MarkdownParser';
import type { AIPluginConfig } from '../config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export interface LLMResponse {
  text: string;
}

export class LLMService {
  private config: AIPluginConfig;

  constructor(config: AIPluginConfig) {
    this.config = config;
  }

  async generate(prompt: string, context: Task[]): Promise<string> {
    // TODO: Implement context serialization
    const contextStr = JSON.stringify(context.map(t => ({ content: t.text, completed: t.completed })));
    const fullPrompt = `Context: ${contextStr}\n\nUser: ${prompt}`;

    if (this.config.provider === 'private') {
      return this.callPrivateEndpoint(fullPrompt);
    } else {
      return this.callProvider(fullPrompt);
    }
  }

  private getEnv(name: string): string | undefined {
    try {
      // Vite exposes env vars via import.meta.env at build time.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v = (import.meta as any)?.env?.[name];
      return typeof v === 'string' && v.length > 0 ? v : undefined;
    } catch {
      return undefined;
    }
  }

  private async callPrivateEndpoint(prompt: string): Promise<string> {
    // Minimal placeholder implementation. A real implementation should call a backend you control.
    console.log('Calling private endpoint with:', prompt);
    if (!this.config.privateEndpointUrl) {
      return 'Private endpoint URL is not configured.';
    }

    try {
      const res = await fetch(this.config.privateEndpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.licenseKey ? { Authorization: `Bearer ${this.config.licenseKey}` } : {}),
        },
        body: JSON.stringify({ prompt }),
      });

      if (res.status === 402 || res.status === 403) {
        return 'Quota exceeded or unpaid plan. Please check your license.';
      }

      if (!res.ok) {
        return `Private endpoint error (${res.status}).`;
      }

      const data = await res.json().catch(() => null);
      if (data && typeof data.text === 'string') return data.text;
      if (data && typeof data.response === 'string') return data.response;
      return 'Private endpoint returned an unexpected response.';
    } catch (e) {
      console.error(e);
      return 'Failed to reach private endpoint.';
    }
  }

  private async callProvider(prompt: string): Promise<string> {
    if (this.config.provider === 'openai') {
      const apiKey = this.config.apiKey || this.getEnv('VITE_OPENAI_API_KEY');
      if (!apiKey) return 'OpenAI API key is not configured.';

      const modelName = this.config.model || this.getEnv('VITE_OPENAI_MODEL') || 'gpt-4.1-mini';
      const temperature = this.config.temperature ?? 0.2;

      try {
        const openai = createOpenAI({ apiKey });
        const { text } = await generateText({
          model: openai(modelName),
          prompt,
          temperature,
        });
        return text;
      } catch (e) {
        console.error(e);
        return 'Failed to call OpenAI.';
      }
    }

    if (this.config.provider === 'azure-openai') {
      return this.callAzureOpenAI(prompt);
    }

    console.log('Calling provider with:', prompt);
    return 'Provider integration pending.';
  }

  private async callAzureOpenAI(prompt: string): Promise<string> {
    const endpoint = (this.config.azureEndpoint || this.getEnv('VITE_AZURE_OPENAI_ENDPOINT') || '').trim();
    const deployment = (this.config.azureDeployment || this.getEnv('VITE_AZURE_OPENAI_DEPLOYMENT') || '').trim();
    const apiVersion = (this.config.azureApiVersion || this.getEnv('VITE_AZURE_OPENAI_API_VERSION') || '').trim();
    const apiKey = (this.config.apiKey || this.getEnv('VITE_AZURE_OPENAI_API_KEY') || '').trim();

    if (!endpoint) return 'Azure OpenAI endpoint is not configured.';
    if (!deployment) return 'Azure OpenAI deployment name is not configured.';
    if (!apiVersion) return 'Azure OpenAI API version is not configured.';
    if (!apiKey) return 'Azure OpenAI API key is not configured.';

    const base = endpoint.replace(/\/+$/, '');
    const url = `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: this.config.temperature ?? 0.2,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return `Azure OpenAI error (${res.status}).${text ? ` ${text}` : ''}`;
      }

      const data = (await res.json().catch(() => null)) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      return 'Azure OpenAI returned an unexpected response.';
    } catch (e) {
      console.error(e);
      return 'Failed to reach Azure OpenAI.';
    }
  }
}
