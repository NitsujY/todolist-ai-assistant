import React from 'react';
import type { Plugin } from '../pluginEngine';
import { VoiceModeButton } from './components/VoiceModeButton';
import { AISettings } from './components/AISettings';

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
    return <AISettings />;
  }
};
