import { useEffect, useRef, useState } from 'react';
import { VoiceModeOverlay } from '../features/VoiceMode/VoiceModeOverlay';
import { Bot } from 'lucide-react';
import { useTodoStore } from '../../../store/useTodoStore';
import { loadAIPluginConfig } from '../utils/configStorage';
import { appendToVoiceCaptureSection, extractLatestVoiceSession, getVoiceCaptureLines, simpleSummarizeVoiceLines, upsertVoiceSummary } from '../utils/voiceNotes';

export const VoiceModeButton = () => {
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const markdown = useTodoStore(state => state.markdown);
  const updateMarkdown = useTodoStore(state => state.updateMarkdown);
  const [stage, setStage] = useState<'listening' | 'processing' | 'done'>('listening');

  const pendingLinesRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const config = loadAIPluginConfig();
  if (!config.voiceModeEnabled) return null;

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

  const handleStartSession = async () => {
    setStage('listening');
    const ts = new Date().toISOString();
    await updateMarkdown(appendToVoiceCaptureSection(markdown, `[VOICE_SESSION ${ts}]`));
  };

  const handleStopAndSummarize = async () => {
    if (stage !== 'listening') return;
    setStage('processing');

    await flushPending();

    const latestMarkdown = useTodoStore.getState().markdown;
    const lines = getVoiceCaptureLines(latestMarkdown);
    const { sessionLines } = extractLatestVoiceSession(lines);
    const summary = simpleSummarizeVoiceLines(sessionLines);

    const updated = upsertVoiceSummary(latestMarkdown, summary);
    await updateMarkdown(updated);

    setStage('done');
    setTimeout(() => {
      setIsVoiceModeOpen(false);
      setStage('listening');
    }, 800);
  };

  return (
    <>
      <button 
        className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
        onClick={async () => {
          setIsVoiceModeOpen(true);
          await handleStartSession();
        }}
        title="Voice Mode"
      >
        <Bot size={18} />
      </button>
      <VoiceModeOverlay 
        isOpen={isVoiceModeOpen} 
        onClose={() => setIsVoiceModeOpen(false)}
        onFinalTranscript={handleFinalTranscript}
        onStop={handleStopAndSummarize}
        language={config.speechLanguage === 'auto' ? undefined : config.speechLanguage}
        showTranscript={config.showVoiceTranscript}
        stage={stage}
        anchorId="todo-list-shell"
      />
    </>
  );
};
