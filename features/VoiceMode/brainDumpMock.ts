export type BrainDumpSceneId = 'brain-dump' | 'project-brainstorm' | 'dev-todo' | 'daily-reminders';

export type BrainDumpTaskSuggestion = {
  id: string;
  title: string;
  tags?: string[];
  dueDate?: string; // YYYY-MM-DD
  confidence?: number; // 0..1
  rationale?: string;
};

export type BrainDumpClarifyingQuestion = {
  question: string;
  choices?: string[];
};

export type BrainDumpResult = {
  sceneId: BrainDumpSceneId;
  summaryBullets: string[];
  mindClearingHints: string[];
  clarifyingQuestions: BrainDumpClarifyingQuestion[];
  tasks: BrainDumpTaskSuggestion[];
  transcript: string;
};

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

const splitSentences = (s: string) => {
  const t = normalize(s);
  if (!t) return [];
  return t
    .split(/(?<=[.!?。！？])\s+/)
    .map(x => x.trim())
    .filter(Boolean);
};

const pickSceneHints = (sceneId: BrainDumpSceneId) => {
  switch (sceneId) {
    case 'dev-todo':
      return {
        defaultTags: ['dev'],
        hintPrefix: 'To unblock yourself:',
      };
    case 'project-brainstorm':
      return {
        defaultTags: ['project'],
        hintPrefix: 'To clarify the direction:',
      };
    case 'daily-reminders':
      return {
        defaultTags: ['reminder'],
        hintPrefix: 'To reduce mental load:',
      };
    default:
      return {
        defaultTags: [],
        hintPrefix: 'To clear your mind:',
      };
  }
};

const slugId = () => {
  // Stable-enough id for UI; not used as persisted key.
  return `t_${Math.random().toString(16).slice(2)}`;
};

const toTitleCase = (s: string) => s.replace(/^\w/, c => c.toUpperCase());

const maybeExtractDueDate = (s: string): string | undefined => {
  // UI-only heuristic. If the user says "by Friday" we can’t infer exact date safely without real date parsing.
  // For now, only extract explicit YYYY-MM-DD.
  const m = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (!m) return undefined;
  return m[0];
};

const inferTasksFromSentences = (sentences: string[], sceneId: BrainDumpSceneId): BrainDumpTaskSuggestion[] => {
  const { defaultTags } = pickSceneHints(sceneId);

  const taskish = sentences
    .flatMap(s => s.split(/\s*(?:and|then|also|另外|然后)\s+/i).map(x => x.trim()).filter(Boolean))
    .filter(s => /\b(need to|remember to|follow up|send|email|call|schedule|book|buy|fix|review|ship|deploy|submit|renew|plan|write|update|check|pay)\b/i.test(s) || s.length <= 80);

  const uniq: string[] = [];
  for (const s of taskish) {
    const cleaned = s.replace(/^[-•]\s*/, '').trim();
    const normalized = cleaned.toLowerCase();
    if (!uniq.some(u => u.toLowerCase() === normalized)) uniq.push(cleaned);
  }

  const limited = uniq.slice(0, 8);

  return limited.map((raw, idx) => {
    const dueDate = maybeExtractDueDate(raw);
    const title = toTitleCase(raw)
      .replace(/\b(i|we)\b\s*/gi, '')
      .replace(/^to\s+/i, '')
      .trim();

    return {
      id: `${slugId()}_${idx}`,
      title: title || raw,
      tags: defaultTags.length ? defaultTags : undefined,
      dueDate,
      confidence: 0.55,
      rationale: 'Mock extraction (UI preview)',
    };
  });
};

export function mockBrainDumpResult(opts: { transcript: string; sceneId: BrainDumpSceneId }): BrainDumpResult {
  const transcript = normalize(opts.transcript);
  const sentences = splitSentences(transcript);

  const summaryBullets = sentences.slice(0, 3).map(s => {
    const t = s.length > 140 ? s.slice(0, 137) + '…' : s;
    return t;
  });

  const tasks = inferTasksFromSentences(sentences, opts.sceneId);

  const hints: string[] = [];
  const { hintPrefix } = pickSceneHints(opts.sceneId);

  if (tasks.length > 0) {
    hints.push(`${hintPrefix} pick the next 1 task to do now.`);
  }
  if (sentences.length > 1) {
    hints.push('Capture any missing names/dates while it’s fresh.');
  }

  const clarifyingQuestions: BrainDumpClarifyingQuestion[] = [];
  if (tasks.some(t => /next week|tomorrow|later/i.test(t.title))) {
    clarifyingQuestions.push({
      question: 'When should this happen?',
      choices: ['Today', 'Tomorrow', 'This week', 'Next week'],
    });
  }

  return {
    sceneId: opts.sceneId,
    summaryBullets: summaryBullets.length ? summaryBullets : ['(No speech captured)'],
    mindClearingHints: hints.length ? hints : ['Say one more sentence: “The next concrete step is …”'],
    clarifyingQuestions,
    tasks,
    transcript,
  };
}
