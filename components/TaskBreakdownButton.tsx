import { useMemo, useState } from 'react';
import { Wand2 } from 'lucide-react';
import type { Task } from '../../../lib/MarkdownParser';
import { useTodoStore } from '../../../store/useTodoStore';
import { loadAIPluginConfig } from '../utils/configStorage';
import { LLMService } from '../services/LLMService';

function parseSubtasks(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[-*]\s+/, ''))
    .map(l => l.replace(/^\d+\.?\s+/, ''))
    .map(l => l.replace(/^\[\s?[xX]?\s?\]\s+/, ''))
    .filter(Boolean);
}

export function TaskBreakdownButton({ task }: { task: Task }) {
  const [isWorking, setIsWorking] = useState(false);
  const tasks = useTodoStore(s => s.tasks);
  const insertTaskAfter = useTodoStore(s => s.insertTaskAfter);

  const config = loadAIPluginConfig();
  const enabled = config.taskBreakdownEnabled;

  const prompt = useMemo(() => {
    const tpl = config.taskBreakdownPrompt || '';
    return tpl.includes('{{task}}') ? tpl.replaceAll('{{task}}', task.text) : `${tpl}\n\nTask: ${task.text}`;
  }, [config.taskBreakdownPrompt, task.text]);

  if (!enabled) return null;
  if (task.type !== 'task') return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!navigator.onLine) {
      alert('You are offline. AI features are disabled.');
      return;
    }

    setIsWorking(true);
    try {
      const llm = new LLMService(config);
      const raw = await llm.generate(prompt, tasks);
      const subtasks = parseSubtasks(raw);

      if (subtasks.length === 0) {
        alert('No subtasks generated. Try adjusting the prompt in AI settings.');
        return;
      }

      // Insert in reverse so the final order reads top-to-bottom.
      for (let i = subtasks.length - 1; i >= 0; i--) {
        await insertTaskAfter(task.id, subtasks[i]);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate task breakdown.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <button
      className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-primary"
      title={isWorking ? 'Generating…' : 'Break down task'}
      onClick={handleClick}
      disabled={isWorking}
    >
      <Wand2 size={16} />
    </button>
  );
}
