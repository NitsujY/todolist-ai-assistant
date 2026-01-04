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
  
  // Mount the Brain Dump bottom bar persistently.
  // It must not be tied to sidebar hover/collapse or overflow menus.
  renderGlobal: () => {
    return <BrainDumpButton />;
  },

  renderDashboard: () => {
    return null;
  },

  renderHeaderButton: () => {
    return null;
  },

  renderTaskActionButton: (task) => {
    return (
      <span className="contents" data-task-action="breakdown">
        <TaskBreakdownButton task={task} />
      </span>
    );
  },

  renderSettings: () => {
    return <AISettings />;
  }
};
