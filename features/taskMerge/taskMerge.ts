import type { Task } from '../../../../lib/MarkdownParser';
import type { AIPluginConfig } from '../../config';
import { LLMService } from '../../services/LLMService';

export type TaskMergeAction =
  | {
      type: 'add_task';
      text: string;
    }
  | {
      type: 'update_task_text';
      targetTaskId?: string;
      targetTaskLine?: number;
      newText: string;
    }
  | {
      type: 'add_subtasks';
      targetTaskId?: string;
      targetTaskLine?: number;
      subtasks: string[];
    }
  | {
      type: 'noop';
      reason?: string;
    };

export interface TaskMergePlan {
  actions: TaskMergeAction[];
  notes?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getString = (obj: Record<string, unknown>, key: string): string => {
  const v = obj[key];
  return typeof v === 'string' ? v.trim() : '';
};

const getNumber = (obj: Record<string, unknown>, key: string): number | undefined => {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

const coerceStringArray = (value: unknown, max: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
};

const extractJsonFromText = (text: string): unknown => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error('No JSON object found in model response.');
};

const parseLineNumberFromTaskId = (taskId: string): number | undefined => {
  const m = taskId.match(/^(\d+)-/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
};

const buildTaskMergePrompt = (args: {
  userInput: string;
  suggestions: string[];
  existingTasks: Array<{ id: string; line: number; text: string; completed: boolean }>;
}): string => {
  const { userInput, suggestions, existingTasks } = args;

  return [
    'You are a task organizer. Decide how to apply suggested tasks to an existing markdown todo list.',
    '',
    'You must choose actions to avoid duplicates:',
    '- update an existing task text when the suggestion is basically the same thing but more specific',
    '- add the suggestion as a subtask when it belongs under an existing parent task',
    '- add a new task when there is no good match',
    '- noop when everything is already covered',
    '',
    'Return STRICT JSON ONLY. No prose.',
    'Schema:',
    '{',
    '  "actions": [',
    '    { "type": "update_task_text", "targetTaskLine": number, "newText": string },',
    '    { "type": "add_subtasks", "targetTaskLine": number, "subtasks": string[] },',
    '    { "type": "add_task", "text": string },',
    '    { "type": "noop", "reason"?: string }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Prefer updating an existing task over adding a new duplicate.',
    '- If the user input is a single atomic action, prefer a single update_task_text or add_task. Do NOT create planning steps.',
    '- For update_task_text, keep it as one clear action, verb-led.',
    '- For add_subtasks, each subtask must be a concrete action line.',
    '- Do not reference tasks not in the existing list.',
    '',
    'Existing tasks (open + done):',
    JSON.stringify(existingTasks),
    '',
    'User input:',
    userInput.trim(),
    '',
    'Selected suggestions to apply:',
    JSON.stringify(suggestions),
  ]
    .filter(Boolean)
    .join('\n');
};

const coerceActions = (value: unknown): TaskMergeAction[] => {
  if (!Array.isArray(value)) return [];
  const out: TaskMergeAction[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const type = getString(item, 'type');

    if (type === 'add_task') {
      const text = getString(item, 'text');
      if (!text) continue;
      out.push({ type: 'add_task', text });
    }

    if (type === 'update_task_text') {
      const newText = getString(item, 'newText');
      const targetTaskId = getString(item, 'targetTaskId');
      const targetTaskLine = getNumber(item, 'targetTaskLine');
      if (!newText) continue;
      if (!targetTaskId && typeof targetTaskLine !== 'number') continue;
      out.push({
        type: 'update_task_text',
        targetTaskId: targetTaskId || undefined,
        targetTaskLine,
        newText,
      });
    }

    if (type === 'add_subtasks') {
      const targetTaskId = getString(item, 'targetTaskId');
      const targetTaskLine = getNumber(item, 'targetTaskLine');
      const subtasks = coerceStringArray(item['subtasks'], 12);
      if (subtasks.length === 0) continue;
      if (!targetTaskId && typeof targetTaskLine !== 'number') continue;
      out.push({
        type: 'add_subtasks',
        targetTaskId: targetTaskId || undefined,
        targetTaskLine,
        subtasks,
      });
    }

    if (type === 'noop') {
      const reason = getString(item, 'reason');
      out.push({ type: 'noop', reason: reason || undefined });
    }

    if (out.length >= 8) break;
  }

  return out;
};

export async function generateTaskMergePlan(args: {
  userInput: string;
  suggestions: string[];
  existingTasks: Task[];
  config: AIPluginConfig;
}): Promise<TaskMergePlan> {
  const { userInput, suggestions, existingTasks, config } = args;

  const tasksForPrompt = existingTasks.slice(0, 60).map(t => ({
    id: t.id,
    line: parseLineNumberFromTaskId(t.id) ?? -1,
    text: t.text,
    completed: t.completed,
  }));

  const prompt = buildTaskMergePrompt({
    userInput,
    suggestions,
    existingTasks: tasksForPrompt,
  });

  const llm = new LLMService(config);
  const raw = await llm.generate(prompt, []);

  try {
    const parsed = extractJsonFromText(raw);
    const obj: Record<string, unknown> = isRecord(parsed) ? parsed : {};
    const actions = coerceActions(obj['actions']);
    const notes = getString(obj, 'notes');
    return { actions, notes: notes || undefined };
  } catch {
    return { actions: [] };
  }
}
