import type { Task } from '../../../lib/MarkdownParser';
import type { AIPluginConfig } from '../config';
// import { createOpenAI } from '@ai-sdk/openai';
// import { createGoogleGenerativeAI } from '@ai-sdk/google';
// import { generateText, streamText } from 'ai';

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
    // Example using Vercel AI SDK
    // Note: In a real app, you'd initialize the provider based on the config
    // const openai = createOpenAI({ apiKey: this.config.apiKey });
    // const { text } = await generateText({ model: openai('gpt-4-turbo'), prompt });
    // return text;
    console.log('Calling provider with:', prompt);
    return "Provider integration pending.";
  }
}
