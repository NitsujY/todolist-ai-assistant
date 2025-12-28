import { useEffect, useMemo, useRef, useState } from 'react';
import { VoiceModeOverlay } from '../features/VoiceMode/VoiceModeOverlay';
import { Mic, Pencil, Trash2 } from 'lucide-react';
import { useTodoStore } from '../../../store/useTodoStore';
import { loadAIPluginConfig } from '../utils/configStorage';
import { appendToVoiceCaptureSection, extractLatestVoiceSession, getVoiceCaptureLines } from '../utils/voiceNotes';
import type { BrainDumpResult, BrainDumpSceneId } from '../features/VoiceMode/brainDumpMock';
import { mockBrainDumpResult } from '../features/VoiceMode/brainDumpMock';
import { generateBrainDumpResultLLM } from '../features/VoiceMode/brainDumpLLM';
import { generateTaskMergePlan, type TaskMergeAction } from '../features/taskMerge/taskMerge';
import { clearBrainDumpHistory, readBrainDumpHistory, upsertBrainDumpHistory } from '../utils/brainDumpHistory';

export const BrainDumpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const markdown = useTodoStore(state => state.markdown);
  const updateMarkdown = useTodoStore(state => state.updateMarkdown);
  const [stage, setStage] = useState<'listening' | 'processing' | 'done'>('listening');
  const tasks = useTodoStore(state => state.tasks);
  const pluginConfig = useTodoStore(state => state.pluginConfig);
  const [autoStartOnOpen, setAutoStartOnOpen] = useState(true);

  const [sceneId, setSceneId] = useState<BrainDumpSceneId>('brain-dump');
  const [brainDumpResult, setBrainDumpResult] = useState<BrainDumpResult | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [kbText, setKbText] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [includeCompletedInContext, setIncludeCompletedInContext] = useState<boolean>(true);
  const [demoTranscript, setDemoTranscript] = useState<string>('');
  const [initialTypeInsteadOpen, setInitialTypeInsteadOpen] = useState(false);

  const pendingLinesRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const sessionStartedRef = useRef(false);

  const config = useMemo(() => loadAIPluginConfig(), [pluginConfig]);
  
  // Reserve space for the fixed bottom bar so it doesn't overlap list content
  // or bottom action bars (e.g. "Save Changes" in raw editor mode).
  useEffect(() => {
    if (!config.voiceModeEnabled) {
      document.documentElement.style.setProperty('--ai-bottom-bar-offset', '0px');
      return;
    }
    const root = document.documentElement;
    const barVisible = !isOpen;
    root.style.setProperty('--ai-bottom-bar-offset', barVisible ? '64px' : '0px');
    return () => {
      root.style.setProperty('--ai-bottom-bar-offset', '0px');
    };
  }, [isOpen, config.voiceModeEnabled]);

  const persistedHistory = useMemo(() => readBrainDumpHistory(markdown), [markdown]);

  const openBrainDumpNew = () => {
    const latest = loadAIPluginConfig();
    setInitialTypeInsteadOpen(false);
    setAutoStartOnOpen(true);
    setIsOpen(true);
    setStage('listening');
    sessionStartedRef.current = false;
    setBrainDumpResult(null);
    setSelectedTaskIds([]);
    setKbText('');
    setSystemPrompt('');
    setDemoTranscript('');
    setSceneId((latest.brainDumpDefaultSceneId as BrainDumpSceneId) || 'brain-dump');
    setIncludeCompletedInContext(latest.brainDumpIncludeCompletedByDefault ?? true);
  };

  const openBrainDumpResume = () => {
    const h = persistedHistory;
    if (!h) return;
    // Open the Brain Dump page without starting analysis or auto-listening.
    // User can tap the mic control inside the overlay when they want.
    setInitialTypeInsteadOpen(false);
    setAutoStartOnOpen(false);
    setIsOpen(true);
    setStage('done');
    sessionStartedRef.current = false;
    setSceneId(h.result.sceneId);
    setIncludeCompletedInContext(h.includeCompletedInContext);
    setKbText(h.kbText);
    setSystemPrompt(h.systemPrompt);
    setBrainDumpResult(h.result);
    setSelectedTaskIds(h.selectedTaskIds.length ? h.selectedTaskIds : h.result.tasks.map(t => t.id));
    setDemoTranscript(h.result.transcript || '');
  };

  const openBrainDump = () => {
    if (persistedHistory) openBrainDumpResume();
    else openBrainDumpNew();
  };

  const openBrainDumpTyping = () => {
    const latest = loadAIPluginConfig();
    setInitialTypeInsteadOpen(true);
    setAutoStartOnOpen(false);
    setIsOpen(true);
    setStage('listening');
    sessionStartedRef.current = false;
    setBrainDumpResult(null);
    setSelectedTaskIds([]);
    setKbText('');
    setSystemPrompt('');
    setSceneId((latest.brainDumpDefaultSceneId as BrainDumpSceneId) || 'brain-dump');
    setIncludeCompletedInContext(latest.brainDumpIncludeCompletedByDefault ?? true);

    const seeded = persistedHistory?.result.transcript || '';
    setDemoTranscript(seeded);
  };

  const clearSavedSuggestions = async () => {
    const next = clearBrainDumpHistory(useTodoStore.getState().markdown);
    await updateMarkdown(next);
    // Keep UI state minimal/clean.
    setBrainDumpResult(null);
    setSelectedTaskIds([]);
    setStage('listening');
  };

  const sceneLabelOverrides = useMemo(() => {
    if (!config.brainDumpSceneLabelsJson) return {} as Partial<Record<BrainDumpSceneId, string>>;
    try {
      const parsed = JSON.parse(config.brainDumpSceneLabelsJson) as Record<string, unknown>;
      const allowed: BrainDumpSceneId[] = ['brain-dump', 'project-brainstorm', 'dev-todo', 'daily-reminders'];
      const out: Partial<Record<BrainDumpSceneId, string>> = {};
      for (const k of allowed) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim()) out[k] = v.trim();
      }
      return out;
    } catch {
      return {} as Partial<Record<BrainDumpSceneId, string>>;
    }
  }, [config.brainDumpSceneLabelsJson]);

  useEffect(() => {
    const onOpenEvent = () => openBrainDump();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Cmd/Ctrl+Shift+B opens Brain Dump
      const isMacOrCmd = e.metaKey;
      const isCtrl = e.ctrlKey;
      if (!(isMacOrCmd || isCtrl)) return;
      if (!e.shiftKey) return;
      if (e.key.toLowerCase() !== 'b') return;
      openBrainDump();
    };

    window.addEventListener('ai:open-brain-dump', onOpenEvent as EventListener);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('ai:open-brain-dump', onOpenEvent as EventListener);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const flushPending = async () => {
    const lines = pendingLinesRef.current;
    if (lines.length === 0) return;
    pendingLinesRef.current = [];

    // Use the freshest markdown to avoid overwriting concurrent updates
    // (e.g. session marker insertion) with a stale render snapshot.
    let next = useTodoStore.getState().markdown;
    for (const l of lines) {
      next = appendToVoiceCaptureSection(next, l);
    }
    await updateMarkdown(next);
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      void flushPending();
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    };
  }, []);

  const handleFinalTranscript = (text: string) => {
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const ts = new Date().toISOString();
      pendingLinesRef.current.push(`[VOICE_SESSION ${ts}]`);
    }
    const ts = new Date().toISOString();
    pendingLinesRef.current.push(`[${ts}] ${text}`);
    scheduleFlush();
  };

  const formatTaskText = (t: { title: string; tags?: string[]; dueDate?: string }) => {
    const tagSuffix = t.tags?.length ? ` ${t.tags.map(x => (x.startsWith('#') ? x : `#${x}`)).join(' ')}` : '';
    const dueSuffix = t.dueDate ? ` due:${t.dueDate}` : '';
    return `${t.title}${tagSuffix}${dueSuffix}`.trim();
  };

  const handleAnalyze = async (payload?: { typedText?: string }) => {
    setStage('processing');
    await flushPending();

    const latestConfig = loadAIPluginConfig();

    const typedText = payload?.typedText?.trim();
    const transcript = typedText
      ? typedText
      : (() => {
          const latestMarkdown = useTodoStore.getState().markdown;
          const lines = getVoiceCaptureLines(latestMarkdown);
          const { sessionLines } = extractLatestVoiceSession(lines);
          return sessionLines
            .map(l => l.replace(/^\[[^\]]+\]\s*/, '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
        })();

    const contextTasks = (includeCompletedInContext ? tasks : tasks.filter(t => !t.completed)).slice(0, 50);

    let result: BrainDumpResult;
    try {
      result = await generateBrainDumpResultLLM({
        inputText: transcript,
        sceneId,
        contextTasks,
        kbText,
        systemPrompt,
        config: latestConfig,
      });
    } catch (e) {
      console.error('Brain Dump LLM failed, falling back to mock', e);
      result = mockBrainDumpResult({ transcript, sceneId });
    }

    // Persist last result so the user can resume later without making an AI call.
    try {
      const historyMarkdown = upsertBrainDumpHistory(useTodoStore.getState().markdown, {
        updatedAt: new Date().toISOString(),
        result,
        selectedTaskIds: result.tasks.map(t => t.id),
        includeCompletedInContext,
        kbText,
        systemPrompt,
      });
      await updateMarkdown(historyMarkdown);
    } catch (e) {
      console.warn('Failed to persist Brain Dump history', e);
    }

    setBrainDumpResult(result);
    setSelectedTaskIds(result.tasks.map(t => t.id));
    setStage('done');
  };

  const handleGeneratePreviewFromDemo = () => {
    const result = mockBrainDumpResult({ transcript: demoTranscript, sceneId });
    setBrainDumpResult(result);
    setSelectedTaskIds(result.tasks.map(t => t.id));
    setStage('done');
  };

  const toggleTaskSelected = (taskId: string) => {
    setSelectedTaskIds(prev => (prev.includes(taskId) ? prev.filter(x => x !== taskId) : [...prev, taskId]));
  };

  const applySelectedTasks = async () => {
    if (!brainDumpResult) return;
    const toApply = brainDumpResult.tasks.filter(t => selectedTaskIds.includes(t.id));
    if (toApply.length === 0) return;

    const store = useTodoStore.getState();

    const configForApply = loadAIPluginConfig();
    const suggestions = toApply.map(t => {
      const base = formatTaskText(t);
      if (!t.subtasks?.length) return base;
      const lines = t.subtasks.map(s => `- ${s}`).join('\n');
      return `${base}\nSubtasks:\n${lines}`;
    });

    const applyAction = async (action: TaskMergeAction) => {
      const currentTasks = useTodoStore.getState().tasks;

      const resolveTaskId = (taskId?: string, taskLine?: number): string | undefined => {
        if (typeof taskLine === 'number' && Number.isFinite(taskLine)) {
          const byLine = currentTasks.find(t => t.type === 'task' && t.id.startsWith(`${taskLine}-`));
          if (byLine) return byLine.id;
        }
        if (taskId) {
          // Best-effort: if the exact id no longer exists, try by line prefix.
          if (currentTasks.some(t => t.id === taskId)) return taskId;
          const m = taskId.match(/^(\d+)-/);
          if (m) {
            const byLine = currentTasks.find(t => t.type === 'task' && t.id.startsWith(`${m[1]}-`));
            if (byLine) return byLine.id;
          }
        }
        return undefined;
      };

      if (action.type === 'add_task') {
        await store.addTask(action.text);
        return;
      }

      if (action.type === 'update_task_text') {
        const targetId = resolveTaskId(action.targetTaskId, action.targetTaskLine);
        if (!targetId) return;
        await store.updateTaskText(targetId, action.newText);
        return;
      }

      if (action.type === 'add_subtasks') {
        const targetId = resolveTaskId(action.targetTaskId, action.targetTaskLine);
        if (!targetId) return;
        const targetTask = currentTasks.find(t => t.id === targetId);
        const existingDesc = (targetTask?.description || '').trim();
        const subtaskBlock = action.subtasks.map(s => `- [ ] ${s}`).join('\n');
        const nextDesc = existingDesc ? `${existingDesc}\n\n${subtaskBlock}` : subtaskBlock;
        await store.updateTaskDescription(targetId, nextDesc);
        return;
      }
    };

    try {
      const plan = await generateTaskMergePlan({
        userInput: (brainDumpResult.transcript || '').trim() || suggestions.join(' '),
        suggestions,
        existingTasks: (includeCompletedInContext ? tasks : tasks.filter(t => !t.completed)).slice(0, 80),
        config: configForApply,
      });

      if (plan.actions.length > 0) {
        for (const action of plan.actions) {
          // noop is intentionally a no-op
          if (action.type === 'noop') continue;
          await applyAction(action);
        }
      } else {
        // Fallback: preserve parent+subtasks locally.
        for (const t of toApply) {
          const beforeIds = new Set(useTodoStore.getState().tasks.map(x => x.id));
          const title = formatTaskText(t);
          await store.addTask(title);

          if (t.subtasks?.length) {
            const afterTasks = useTodoStore.getState().tasks;
            const created = afterTasks.find(x => !beforeIds.has(x.id) && x.text === title) || afterTasks.find(x => !beforeIds.has(x.id));
            if (created) {
              const subtaskBlock = t.subtasks.map(s => `- [ ] ${s}`).join('\n');
              await store.updateTaskDescription(created.id, subtaskBlock);
            }
          }
        }
      }
    } catch (e) {
      console.error('Task merge plan failed, falling back to addTask', e);
      for (const t of toApply) {
        const beforeIds = new Set(useTodoStore.getState().tasks.map(x => x.id));
        const title = formatTaskText(t);
        await store.addTask(title);

        if (t.subtasks?.length) {
          const afterTasks = useTodoStore.getState().tasks;
          const created = afterTasks.find(x => !beforeIds.has(x.id) && x.text === title) || afterTasks.find(x => !beforeIds.has(x.id));
          if (created) {
            const subtaskBlock = t.subtasks.map(s => `- [ ] ${s}`).join('\n');
            await store.updateTaskDescription(created.id, subtaskBlock);
          }
        }
      }
    }

    // After apply: return to list view. Resume remains available via the
    // persistent bottom bar backed by markdown history.
    setStage('done');
    setIsOpen(false);
  };

  const applyNextActions = async () => {
    if (!brainDumpResult) return;
    const nextActions = (brainDumpResult.nextActions || []).map(x => x.trim()).filter(Boolean);
    if (nextActions.length === 0) return;

    const store = useTodoStore.getState();
    const beforeIds = new Set(store.tasks.map(t => t.id));
    const date = new Date().toISOString().slice(0, 10);
    const parentTitle = `Brain Dump next actions (${date})`;

    await store.addTask(parentTitle);
    const afterTasks = useTodoStore.getState().tasks;
    const created = afterTasks.find(t => !beforeIds.has(t.id) && t.text === parentTitle) || afterTasks.find(t => !beforeIds.has(t.id));
    if (!created) return;

    const subtaskBlock = nextActions.map(s => `- [ ] ${s}`).join('\n');
    await store.updateTaskDescription(created.id, subtaskBlock);
  };

  const contextPreviewLines = useMemo(() => {
    const relevantTasks = includeCompletedInContext ? tasks : tasks.filter(t => !t.completed);
    const titles = relevantTasks.slice(0, 10).map(t => `${t.completed ? 'Done' : 'Open'} task: ${t.text}`);
    const kbLines = kbText
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map(l => `KB: ${l.replace(/^[-•]\s*/, '')}`);
    const promptLines = systemPrompt
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map(l => `System: ${l}`);
    return [...promptLines, ...kbLines, ...titles];
  }, [tasks, kbText, includeCompletedInContext, systemPrompt]);

  if (!config.voiceModeEnabled) return null;

  return (
    <>
      {!isOpen ? (
        <div className="fixed left-1/2 bottom-3 -translate-x-1/2 z-40 w-[min(48rem,calc(100vw-1.5rem))]">
          <div
            className="border border-base-300 rounded-2xl bg-base-100 shadow-lg px-3 py-2 flex items-center justify-between gap-3 cursor-pointer"
            role="button"
            tabIndex={0}
            title="Start Brain Dump (voice)"
            onClick={() => {
              // If there are saved results, resume the analysis screen.
              // Otherwise start a fresh voice capture session.
              openBrainDump();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              openBrainDump();
            }}
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Brain Dump</div>
              <div className="text-xs text-base-content/60 truncate">
                {persistedHistory
                  ? `Saved — ${persistedHistory.result.tasks.length} suggestion${persistedHistory.result.tasks.length === 1 ? '' : 's'}`
                  : 'Tap bar to start'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {persistedHistory ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  title="Clear saved suggestions"
                  onClick={(e) => {
                    e.stopPropagation();
                    void clearSavedSuggestions();
                  }}
                >
                  <Trash2 size={18} />
                </button>
              ) : null}

              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                title="Type instead"
                onClick={(e) => {
                  e.stopPropagation();
                  openBrainDumpTyping();
                }}
              >
                <Pencil size={18} />
              </button>

              <button
                type="button"
                className="btn btn-sm btn-circle"
                title="Open Brain Dump"
                onClick={(e) => {
                  e.stopPropagation();
                  openBrainDump();
                }}
              >
                <Mic size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <VoiceModeOverlay
        isOpen={isOpen}
        onClose={() => {
          void flushPending();
          setIsOpen(false);
          setInitialTypeInsteadOpen(false);
          // Minimize behavior: keep stage/results so reopening is instant.
        }}
        onFinalTranscript={handleFinalTranscript}
        onStopListening={() => setStage('listening')}
        onAnalyze={handleAnalyze}
        language={config.speechLanguage === 'auto' ? undefined : config.speechLanguage}
        showTranscript={config.showVoiceTranscript}
        stage={stage}
        anchorId="todo-list-shell"
        autoStartListening={autoStartOnOpen}
        initialTypeInsteadOpen={initialTypeInsteadOpen}

        brainDumpEnabled={true}
        sceneId={sceneId}
        onSceneChange={setSceneId}
        sceneLabelOverrides={sceneLabelOverrides}
        brainDumpResult={brainDumpResult}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelected={toggleTaskSelected}
        onApplySelectedTasks={applySelectedTasks}
        onApplyNextActions={applyNextActions}
        kbText={kbText}
        onKbTextChange={setKbText}
        contextPreviewLines={contextPreviewLines}

        demoTranscript={demoTranscript}
        onDemoTranscriptChange={setDemoTranscript}
        onGeneratePreview={handleGeneratePreviewFromDemo}

        includeCompletedInContext={includeCompletedInContext}
        onIncludeCompletedInContextChange={setIncludeCompletedInContext}

        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
      />
    </>
  );
};
