import React, { useState } from 'react';
import { Plugin, PluginAPI } from '../../pluginEngine';
import { VoiceModeOverlay } from './features/VoiceMode/VoiceModeOverlay';
import { DEFAULT_CONFIG, AIPluginConfig } from './config';
import { LLMService } from './services/LLMService';

export const AIAssistantPlugin: Plugin = {
  name: 'AI Assistant',
  id: 'ai-assistant',
  version: '0.1.0',
  description: 'AI-powered features including Voice Mode and Smart Tags.',
  author: 'Justin Yu',
  
  renderHeaderButton: (api: PluginAPI) => {
    const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

    return (
      <>
        <button 
          className="btn btn-ghost btn-sm btn-circle"
          onClick={() => setIsVoiceModeOpen(true)}
          title="Voice Mode"
        >
          ✨
        </button>
        <VoiceModeOverlay 
          isOpen={isVoiceModeOpen} 
          onClose={() => setIsVoiceModeOpen(false)}
          onCommand={(text) => console.log('Command:', text)}
        />
      </>
    );
  },

  renderSettings: (api: PluginAPI) => {
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
