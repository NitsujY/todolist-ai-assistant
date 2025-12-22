export const VOICE_CAPTURE_START = '<!-- AI_VOICE_CAPTURE:START -->';
export const VOICE_CAPTURE_END = '<!-- AI_VOICE_CAPTURE:END -->';

export const VOICE_SUMMARY_START = '<!-- AI_VOICE_SUMMARY:START -->';
export const VOICE_SUMMARY_END = '<!-- AI_VOICE_SUMMARY:END -->';

const normalizeNewlines = (s: string) => s.replace(/\r\n/g, '\n');

export function ensureVoiceCaptureSection(markdown: string): string {
  const md = normalizeNewlines(markdown);
  if (md.includes(VOICE_CAPTURE_START) && md.includes(VOICE_CAPTURE_END)) return md;

  const suffix = [
    '',
    VOICE_CAPTURE_START,
    VOICE_CAPTURE_END,
    '',
  ].join('\n');

  return md.trimEnd() + suffix;
}

export function appendToVoiceCaptureSection(markdown: string, line: string): string {
  const md = ensureVoiceCaptureSection(normalizeNewlines(markdown));
  const idx = md.lastIndexOf(VOICE_CAPTURE_END);
  if (idx === -1) return md;

  const before = md.slice(0, idx).trimEnd();
  const after = md.slice(idx);
  return `${before}\n${line}\n${after}`;
}

export function getVoiceCaptureLines(markdown: string): string[] {
  const md = normalizeNewlines(markdown);
  const start = md.indexOf(VOICE_CAPTURE_START);
  const end = md.indexOf(VOICE_CAPTURE_END);
  if (start === -1 || end === -1 || end <= start) return [];

  const content = md.slice(start + VOICE_CAPTURE_START.length, end);
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
}

export function extractLatestVoiceSession(lines: string[]): { sessionId: string | null; sessionLines: string[] } {
  // Session marker format: [VOICE_SESSION 2025-12-22T17:00:00.000Z]
  const markerPrefix = '[VOICE_SESSION ';
  let lastMarkerIndex = -1;
  let lastSessionId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith(markerPrefix) && l.endsWith(']')) {
      lastMarkerIndex = i;
      lastSessionId = l.slice(markerPrefix.length, -1);
    }
  }

  if (lastMarkerIndex === -1) return { sessionId: null, sessionLines: lines };
  return { sessionId: lastSessionId, sessionLines: lines.slice(lastMarkerIndex + 1) };
}

export function upsertVoiceSummary(markdown: string, bulletLines: string[]): string {
  let md = normalizeNewlines(markdown);

  if (!md.includes(VOICE_SUMMARY_START) || !md.includes(VOICE_SUMMARY_END)) {
    md = md.trimEnd();
    md += `\n\n${VOICE_SUMMARY_START}\n${VOICE_SUMMARY_END}\n`;
  }

  const start = md.indexOf(VOICE_SUMMARY_START);
  const end = md.indexOf(VOICE_SUMMARY_END);
  if (start === -1 || end === -1 || end <= start) return md;

  const before = md.slice(0, start + VOICE_SUMMARY_START.length);
  const after = md.slice(end);

  const body = bulletLines.length
    ? '\n' + bulletLines.map(l => (l.startsWith('- ') ? l : `- ${l}`)).join('\n') + '\n'
    : '\n- (empty)\n';

  return before + body + after;
}

export function simpleSummarizeVoiceLines(lines: string[]): string[] {
  // Heuristic fallback summary: de-dupe, keep last N, split into short bullets.
  const cleaned = lines
    .map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim())
    .filter(Boolean);

  const uniq: string[] = [];
  for (const l of cleaned) {
    if (!uniq.includes(l)) uniq.push(l);
  }

  const tail = uniq.slice(Math.max(0, uniq.length - 8));
  return tail.map(l => {
    const sentence = l.split(/(?<=[.!?。！？])\s+/)[0] || l;
    return sentence.length > 120 ? sentence.slice(0, 117) + '…' : sentence;
  });
}
