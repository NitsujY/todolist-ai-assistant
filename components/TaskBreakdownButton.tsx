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
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isWorking, setIsWorking] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
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

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(true);
    setStep(1);
    setGenerated([]);
    setSelected({});
  };

  const generate = async () => {
    if (!navigator.onLine) {
      alert('You are offline. AI features are disabled.');
      return;
    }

    setIsWorking(true);
    try {
      const llm = new LLMService(config);
      const raw = await llm.generate(prompt, tasks);
      let subtasks = parseSubtasks(raw);

      // Look & feel first: if provider integration is not ready, show a sensible template.
      if (subtasks.length === 0 || raw.includes('integration pending') || raw.includes('not configured')) {
        subtasks = [
          'Clarify goal and success criteria',
          'List constraints and dependencies',
          'Break into milestones',
          'Define next 1–2 concrete actions',
        ];
      }

      setGenerated(subtasks);
      const nextSelected: Record<string, boolean> = {};
      for (const s of subtasks) nextSelected[s] = true;
      setSelected(nextSelected);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert('Failed to generate task breakdown.');
    } finally {
      setIsWorking(false);
    }
  };

  const apply = async () => {
    const chosen = generated.filter(s => selected[s]);
    if (chosen.length === 0) {
      alert('Select at least one subtask to apply.');
      return;
    }

    setIsWorking(true);
    try {
      for (let i = chosen.length - 1; i >= 0; i--) {
        await insertTaskAfter(task.id, chosen[i]);
      }
      setStep(3);
      setTimeout(() => setIsOpen(false), 600);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <>
      <button
        className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-primary"
        title="Break down task"
        onClick={open}
      >
        <Wand2 size={16} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-base-100 w-full max-w-lg rounded-xl shadow-2xl border border-base-200" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-base-200 flex items-center justify-between">
              <div>
                <div className="font-semibold">Task Breakdown</div>
                <div className="text-xs text-base-content/60">Step {step} of 3</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-base-200/40 border border-base-300 rounded-lg p-3">
                <div className="text-xs text-base-content/60 mb-1">Target task</div>
                <div className="text-sm text-base-content/80 break-words">{task.text}</div>
              </div>

              {step === 1 && (
                <div className="space-y-3">
                  <div className="text-sm text-base-content/70">
                    Generate subtasks using your configured LLM settings.
                  </div>
                  <button className="btn btn-primary w-full" onClick={generate} disabled={isWorking}>
                    {isWorking ? 'Generating…' : 'Generate'}
                  </button>
                  <div className="text-xs text-base-content/50">
                    Prompt is configurable in AI Settings.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="text-xs text-base-content/60">Preview</div>
                  <div className="max-h-56 overflow-y-auto border border-base-200 rounded-lg">
                    {generated.map((s) => (
                      <label key={s} className="flex items-start gap-3 px-3 py-2 hover:bg-base-200/50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary mt-0.5"
                          checked={!!selected[s]}
                          onChange={(e) => setSelected(prev => ({ ...prev, [s]: e.target.checked }))}
                        />
                        <span className="text-sm text-base-content/80">{s}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button className="btn btn-ghost flex-1" onClick={() => setStep(1)} disabled={isWorking}>
                      Back
                    </button>
                    <button className="btn btn-primary flex-1" onClick={apply} disabled={isWorking}>
                      {isWorking ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-sm text-success">Subtasks inserted.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
