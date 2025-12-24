import { useEffect, useMemo, useRef, useState } from 'react';
import { VoiceModeOverlay } from '../features/VoiceMode/VoiceModeOverlay';
import { Bot } from 'lucide-react';
import { useTodoStore } from '../../../store/useTodoStore';
import { loadAIPluginConfig } from '../utils/configStorage';
import { appendToVoiceCaptureSection, extractLatestVoiceSession, getVoiceCaptureLines } from '../utils/voiceNotes';
import type { BrainDumpResult, BrainDumpSceneId } from '../features/VoiceMode/brainDumpMock';
import { mockBrainDumpResult } from '../features/VoiceMode/brainDumpMock';

export const BrainDumpButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const markdown = useTodoStore(state => state.markdown);
  const updateMarkdown = useTodoStore(state => state.updateMarkdown);
  const [stage, setStage] = useState<'listening' | 'processing' | 'done'>('listening');
  const tasks = useTodoStore(state => state.tasks);

  const [sceneId, setSceneId] = useState<BrainDumpSceneId>('brain-dump');
  const [brainDumpResult, setBrainDumpResult] = useState<BrainDumpResult | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [kbText, setKbText] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [includeCompletedInContext, setIncludeCompletedInContext] = useState<boolean>(true);
  const [demoTranscript, setDemoTranscript] = useState<string>('');

  const pendingLinesRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const sessionStartedRef = useRef(false);

  const config = loadAIPluginConfig();
  if (!config.voiceModeEnabled) return null;

  const openBrainDump = () => {
    const latest = loadAIPluginConfig();
    setIsOpen(true);
    setStage('listening');
    sessionStartedRef.current = false;
    setBrainDumpResult(null);
    setSelectedTaskIds([]);
    setSceneId((latest.brainDumpDefaultSceneId as BrainDumpSceneId) || 'brain-dump');
    setIncludeCompletedInContext(latest.brainDumpIncludeCompletedByDefault ?? true);
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

    let next = markdown;
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
    const ts = new Date().toISOString();
    pendingLinesRef.current.push(`[${ts}] ${text}`);
    scheduleFlush();
  };

  const ensureSessionStarted = async () => {
    if (sessionStartedRef.current) return;
    sessionStartedRef.current = true;
    const ts = new Date().toISOString();
    await updateMarkdown(appendToVoiceCaptureSection(useTodoStore.getState().markdown, `[VOICE_SESSION ${ts}]`));
  };

  const formatTaskText = (t: { title: string; tags?: string[]; dueDate?: string }) => {
    const tagSuffix = t.tags?.length ? ` ${t.tags.map(x => (x.startsWith('#') ? x : `#${x}`)).join(' ')}` : '';
    const dueSuffix = t.dueDate ? ` due:${t.dueDate}` : '';
    return `${t.title}${tagSuffix}${dueSuffix}`.trim();
  };

  const handleAnalyze = async (payload?: { typedText?: string }) => {
    setStage('processing');
    await flushPending();

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

    const result = mockBrainDumpResult({ transcript, sceneId });
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
    for (const t of toApply) {
      await store.addTask(formatTaskText(t));
    }

    setStage('done');
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

  return (
    <>
      <button
        className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
        onClick={() => {
          openBrainDump();
        }}
        title="Brain Dump"
      >
        <Bot size={18} />
      </button>

      <VoiceModeOverlay
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setStage('listening');
          sessionStartedRef.current = false;
        }}
        onFinalTranscript={handleFinalTranscript}
        onStopListening={() => setStage('listening')}
        onAnalyze={handleAnalyze}
        onStart={() => {
          void ensureSessionStarted();
        }}
        language={config.speechLanguage === 'auto' ? undefined : config.speechLanguage}
        showTranscript={config.showVoiceTranscript}
        stage={stage}
        anchorId="todo-list-shell"
        autoStartListening={true}

        brainDumpEnabled={true}
        sceneId={sceneId}
        onSceneChange={setSceneId}
        sceneLabelOverrides={sceneLabelOverrides}
        brainDumpResult={brainDumpResult}
        selectedTaskIds={selectedTaskIds}
        onToggleTaskSelected={toggleTaskSelected}
        onApplySelectedTasks={applySelectedTasks}
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
