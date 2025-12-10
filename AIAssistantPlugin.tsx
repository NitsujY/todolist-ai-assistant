import React from 'react';
import type { Plugin } from '../pluginEngine';
import { VoiceModeButton } from './components/VoiceModeButton';
// import { DEFAULT_CONFIG } from './config';
// import { LLMService } from './services/LLMService';

export const AIAssistantPlugin: Plugin = {
  name: 'AI Assistant',
  // id: 'ai-assistant', // Plugin interface doesn't have id, just name
  // version: '0.1.0',
  // description: 'AI-powered features including Voice Mode and Smart Tags.',
  // author: 'Justin Yu',
  
  renderHeaderButton: () => {
    return <VoiceModeButton />;
  },

  renderSettings: () => {
    // TODO: Implement settings UI for API keys and provider selection
    return (
      <div className="space-y-4">
        <h3 className="font-bold text-lg">AI Assistant Settings</h3>
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Enable Voice Mode</span>
            <input type="checkbox" className="toggle" defaultChecked />
          </label>
        </div>
      </div>
    );
  }
};
