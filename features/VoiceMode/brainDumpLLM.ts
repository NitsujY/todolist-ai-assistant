import type { Task } from '../../../../lib/MarkdownParser';
import type { AIPluginConfig } from '../../config';
import { LLMService } from '../../services/LLMService';
import type { BrainDumpClarifyingQuestion, BrainDumpResult, BrainDumpSceneId, BrainDumpTaskSuggestion } from './brainDumpMock';

const DUE_DATE_RE = /^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getString = (obj: Record<string, unknown>, key: string): string => {
  const v = obj[key];
  return typeof v === 'string' ? v.trim() : '';
};

const getNumber = (obj: Record<string, unknown>, key: string): number | undefined => {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

const sceneInstruction = (sceneId: BrainDumpSceneId) => {
  switch (sceneId) {
    case 'dev-todo':
      return 'Prefer short, actionable engineering tasks. Use tags like dev when appropriate.';
    case 'project-brainstorm':
      return 'Prefer next actions and decisions. Keep tasks lightweight and concrete.';
    case 'daily-reminders':
      return 'Prefer time-bound reminders and routine actions. Only include a due date when explicitly stated as YYYY-MM-DD.';
    default:
      return 'General brain dump. Extract concrete next steps and avoid duplicates.';
  }
};

const coerceStringArray = (value: unknown, max: number): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
};

const coerceQuestions = (value: unknown): BrainDumpClarifyingQuestion[] => {
  if (!Array.isArray(value)) return [];
  const out: BrainDumpClarifyingQuestion[] = [];
  for (const v of value) {
    if (!isRecord(v)) continue;
    const question = getString(v, 'question');
    if (!question) continue;
    const rawChoices = v['choices'];
    const choices = Array.isArray(rawChoices)
      ? rawChoices
          .map((c: unknown) => (typeof c === 'string' ? c.trim() : ''))
          .filter(Boolean)
          .slice(0, 6)
      : undefined;
    out.push({ question, choices: choices?.length ? choices : undefined });
    if (out.length >= 2) break;
  }
  return out;
};

const sanitizeTag = (t: string) => t.replace(/^#+/, '').trim().replace(/\s+/g, '-').toLowerCase();

const coerceTasks = (value: unknown): BrainDumpTaskSuggestion[] => {
  if (!Array.isArray(value)) return [];
  const out: BrainDumpTaskSuggestion[] = [];
  for (const v of value) {
    if (!isRecord(v)) continue;
    const title = getString(v, 'title');
    if (!title) continue;

    const rawTags = v['tags'];
    const tags = Array.isArray(rawTags)
      ? rawTags
          .map((x: unknown) => (typeof x === 'string' ? sanitizeTag(x) : ''))
          .filter(Boolean)
          .slice(0, 5)
      : undefined;

    const dueDateRaw = getString(v, 'dueDate');
    const dueDate = dueDateRaw && DUE_DATE_RE.test(dueDateRaw) ? dueDateRaw : undefined;

    const confidenceRaw = getNumber(v, 'confidence');
    const confidence = typeof confidenceRaw === 'number' ? Math.max(0, Math.min(1, confidenceRaw)) : undefined;

    const rationale = getString(v, 'rationale');

    out.push({
      id: `t_${Math.random().toString(16).slice(2)}`,
      title,
      tags: tags?.length ? tags : undefined,
      dueDate,
      confidence,
      rationale: rationale ? rationale : undefined,
    });

    if (out.length >= 12) break;
  }
  return out;
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

const buildBrainDumpPrompt = (args: {
  inputText: string;
  sceneId: BrainDumpSceneId;
  kbText?: string;
  systemPrompt?: string;
}): string => {
  const { inputText, sceneId, kbText, systemPrompt } = args;

  const kb = (kbText || '').trim();
  const sys = (systemPrompt || '').trim();

  return [
    'You are Brain Dump Analyzer.',
    '',
    'Goal: Turn the user\'s messy input into actionable tasks and a short plan.',
    '',
    `Scene: ${sceneId}`,
    `Scene instructions: ${sceneInstruction(sceneId)}`,
    '',
    sys ? `System notes (user provided):\n${sys}` : '',
    kb ? `Knowledge base notes (user provided):\n${kb}` : '',
    '',
    'You are also given a JSON list of existing tasks in the context above. Avoid suggesting duplicates.',
    '',
    'Return STRICT JSON ONLY. No prose. No markdown fences.',
    'Schema:',
    '{',
    '  "sceneId": "brain-dump" | "project-brainstorm" | "dev-todo" | "daily-reminders",',
    '  "summaryBullets": string[]  // 1-5 bullets, short, no trailing punctuation preference ok',
    '  "nextActions": string[]     // 0-3 concrete do-able steps, verb-led',
    '  "clarifyingQuestions": { "question": string, "choices"?: string[] }[] // 0-2',
    '  "tasks": { "title": string, "tags"?: string[], "dueDate"?: "YYYY-MM-DD" }[]',
    '  "sourceText": string',
    '}',
    '',
    'Quality bar for tasks:',
    '- Each task is meaningful and do-able (not vague).',
    '- Start titles with a verb.',
    '- Keep tasks small enough to complete without needing another task to define it.',
    '- Only set dueDate if the user explicitly provided a YYYY-MM-DD date.',
    '',
    'Atomic input rule:',
    '- If the user input is already a single clear action (e.g., "Read the unread tax messages"), do NOT expand it.',
    '- In that case return exactly 1 task and nextActions should be empty (or at most 1 line that repeats the same action).',
    '',
    'User input:',
    inputText.trim(),
  ]
    .filter(Boolean)
    .join('\n');
};

const looksAtomic = (text: string): boolean => {
  const t = text.trim();
  if (!t) return true;
  // Keep this conservative; we only collapse when it's clearly a single action.
  if (t.length > 80) return false;
  if (/\b(and|then|also|另外|然后|並且|而且)\b/i.test(t)) return false;
  if (/[\n;；]/.test(t)) return false;

  // Starts with a common action verb.
  return /^(read|review|check|open|reply|respond|send|email|call|text|pay|buy|book|schedule|fix|update|submit)\b/i.test(t);
};

const normalizeAtomicTaskTitle = (text: string): string => {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  // Capitalize first letter for nicer task titles.
  return t.replace(/^\w/, c => c.toUpperCase());
};

export async function generateBrainDumpResultLLM(args: {
  inputText: string;
  sceneId: BrainDumpSceneId;
  contextTasks: Task[];
  kbText?: string;
  systemPrompt?: string;
  config: AIPluginConfig;
}): Promise<BrainDumpResult> {
  const { inputText, sceneId, contextTasks, kbText, systemPrompt, config } = args;

  const trimmed = inputText.trim();
  if (!trimmed) {
    return {
      sceneId,
      summaryBullets: ['(No input)'],
      nextActions: [],
      clarifyingQuestions: [],
      tasks: [],
      transcript: '',
    };
  }

  const prompt = buildBrainDumpPrompt({ inputText: trimmed, sceneId, kbText, systemPrompt });
  const llm = new LLMService(config);
  const rawText = await llm.generate(prompt, contextTasks);

  try {
    const parsed = extractJsonFromText(rawText);
    const obj: Record<string, unknown> = isRecord(parsed) ? parsed : {};

    const rawSceneId = getString(obj, 'sceneId');
    const outSceneId = (rawSceneId as BrainDumpSceneId) || sceneId;
    const summaryBullets = coerceStringArray(obj['summaryBullets'], 5);
    let nextActions = coerceStringArray(obj['nextActions'], 3);
    const clarifyingQuestions = coerceQuestions(obj['clarifyingQuestions']);
    let tasks = coerceTasks(obj['tasks']);
    const sourceText = getString(obj, 'sourceText') || trimmed;

    // Heuristic: for atomic inputs, avoid over-generating meta steps.
    if (looksAtomic(trimmed)) {
      nextActions = [];
      clarifyingQuestions.splice(0, clarifyingQuestions.length);
      if (tasks.length === 0) {
        tasks = [{ id: `t_${Math.random().toString(16).slice(2)}`, title: normalizeAtomicTaskTitle(trimmed) }];
      } else {
        tasks = tasks.slice(0, 1);
      }
    }

    return {
      sceneId: outSceneId,
      summaryBullets: summaryBullets.length ? summaryBullets : [trimmed.slice(0, 160)],
      nextActions,
      clarifyingQuestions,
      tasks,
      transcript: sourceText,
    };
  } catch {
    const msg = typeof rawText === 'string' ? rawText.trim() : '';
    const hint = msg ? msg.slice(0, 200) : 'Unknown error.';

    return {
      sceneId,
      summaryBullets: [`AI analysis failed: ${hint}`],
      nextActions: [],
      clarifyingQuestions: [],
      tasks: [],
      transcript: trimmed,
    };
  }
}
