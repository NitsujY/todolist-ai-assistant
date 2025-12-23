import type { Plugin } from '../pluginEngine';
import { BrainDumpButton } from './components/BrainDumpButton';
import { AISettings } from './components/AISettings';
import { TaskBreakdownButton } from './components/TaskBreakdownButton';

export const AIAssistantPlugin: Plugin = {
  name: 'AI Assistant',
  // id: 'ai-assistant', // Plugin interface doesn't have id, just name
  // version: '0.1.0',
  // description: 'AI-powered features including Voice Mode and Smart Tags.',
  // author: 'Justin Yu',
  
  renderHeaderButton: () => {
    return <BrainDumpButton />;
  },

  renderTaskActionButton: (task) => {
    return <TaskBreakdownButton task={task} />;
  },

  renderSettings: () => {
    return <AISettings />;
  }
};
