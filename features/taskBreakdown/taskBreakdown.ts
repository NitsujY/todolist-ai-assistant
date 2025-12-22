import type { Task } from '../../../../lib/MarkdownParser';
import type { AIPluginConfig } from '../../config';
import { LLMService } from '../../services/LLMService';

export function buildTaskBreakdownPrompt(template: string, taskText: string): string {
  const tpl = template || '';
  if (tpl.includes('{{task}}')) return tpl.replaceAll('{{task}}', taskText);
  return `${tpl}\n\nTask: ${taskText}`.trim();
}

export function parseTaskBreakdownLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .map((line) => line.replace(/^\d+\.?\s+/, ''))
    .map((line) => line.replace(/^\[\s?[xX]?\s?\]\s+/, ''))
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface TaskBreakdownResult {
  rawText: string;
  subtasks: string[];
}

export async function generateTaskBreakdown(args: {
  taskText: string;
  contextTasks: Task[];
  config: AIPluginConfig;
}): Promise<TaskBreakdownResult> {
  const { taskText, contextTasks, config } = args;

  const prompt = buildTaskBreakdownPrompt(config.taskBreakdownPrompt || '', taskText);
  const llm = new LLMService(config);
  const rawText = await llm.generate(prompt, contextTasks);
  let subtasks = parseTaskBreakdownLines(rawText);

  // Safety fallback: keep UX usable if provider returns empty text.
  if (subtasks.length === 0) {
    subtasks = [
      'Clarify goal and success criteria',
      'List constraints and dependencies',
      'Break into milestones',
      'Define next 1–2 concrete actions',
    ];
  }

  return { rawText, subtasks };
}
