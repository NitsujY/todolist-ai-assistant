import type { BrainDumpResult } from '../features/VoiceMode/brainDumpMock';

export const BRAIN_DUMP_HISTORY_START = '<!-- AI_BRAIN_DUMP_HISTORY:START -->';
export const BRAIN_DUMP_HISTORY_END = '<!-- AI_BRAIN_DUMP_HISTORY:END -->';

export type BrainDumpHistory = {
  updatedAt: string;
  result: BrainDumpResult;
  selectedTaskIds: string[];
  includeCompletedInContext: boolean;
  kbText: string;
  systemPrompt: string;
};

const normalizeNewlines = (s: string) => s.replace(/\r\n/g, '\n');

export function readBrainDumpHistory(markdown: string): BrainDumpHistory | null {
  const md = normalizeNewlines(markdown);
  const start = md.indexOf(BRAIN_DUMP_HISTORY_START);
  const end = md.indexOf(BRAIN_DUMP_HISTORY_END);
  if (start === -1 || end === -1 || end <= start) return null;

  const raw = md.slice(start + BRAIN_DUMP_HISTORY_START.length, end).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<BrainDumpHistory>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.result || typeof parsed.result !== 'object') return null;
    if (typeof parsed.updatedAt !== 'string') return null;

    const selectedTaskIds = Array.isArray(parsed.selectedTaskIds)
      ? parsed.selectedTaskIds.filter(x => typeof x === 'string')
      : [];

    return {
      updatedAt: parsed.updatedAt,
      // Trust the schema coming from our own writer.
      result: parsed.result as BrainDumpResult,
      selectedTaskIds,
      includeCompletedInContext: typeof parsed.includeCompletedInContext === 'boolean' ? parsed.includeCompletedInContext : true,
      kbText: typeof parsed.kbText === 'string' ? parsed.kbText : '',
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
    };
  } catch {
    return null;
  }
}

export function upsertBrainDumpHistory(markdown: string, history: BrainDumpHistory): string {
  let md = normalizeNewlines(markdown);

  const payload = JSON.stringify(history, null, 2);

  if (!md.includes(BRAIN_DUMP_HISTORY_START) || !md.includes(BRAIN_DUMP_HISTORY_END)) {
    md = md.trimEnd();
    md += `\n\n${BRAIN_DUMP_HISTORY_START}\n${payload}\n${BRAIN_DUMP_HISTORY_END}\n`;
    return md;
  }

  const start = md.indexOf(BRAIN_DUMP_HISTORY_START);
  const end = md.indexOf(BRAIN_DUMP_HISTORY_END);
  if (start === -1 || end === -1 || end <= start) return md;

  const before = md.slice(0, start + BRAIN_DUMP_HISTORY_START.length);
  const after = md.slice(end);
  return `${before}\n${payload}\n${after}`;
}

export function clearBrainDumpHistory(markdown: string): string {
  const md = normalizeNewlines(markdown);
  const start = md.indexOf(BRAIN_DUMP_HISTORY_START);
  const end = md.indexOf(BRAIN_DUMP_HISTORY_END);
  if (start === -1 || end === -1 || end <= start) return md;

  const before = md.slice(0, start).trimEnd();
  const after = md.slice(end + BRAIN_DUMP_HISTORY_END.length).trimStart();
  const joined = `${before}\n\n${after}`.trimEnd();
  return joined + '\n';
}
