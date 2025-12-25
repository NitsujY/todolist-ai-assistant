import React, { useEffect, useRef, useState } from 'react';
import { Mic, X, Loader2, CheckCircle2, Pause } from 'lucide-react';
import type { BrainDumpResult, BrainDumpSceneId } from './brainDumpMock';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onFinalTranscript: (text: string) => void;
  /** Called when voice capture stops (manual stop or recognition ended). Does NOT imply analysis. */
  onStopListening?: () => void;
  /** Called when user explicitly requests Brain Dump analysis. */
  onAnalyze?: (payload?: { typedText?: string }) => void;
  onStart?: () => void;
  language?: string;
  showTranscript?: boolean;
  stage?: 'listening' | 'processing' | 'done';
  anchorId?: string;
  autoStartListening?: boolean;

  // Brain Dump (UI preview) – optional
  brainDumpEnabled?: boolean;
  sceneId?: BrainDumpSceneId;
  onSceneChange?: (sceneId: BrainDumpSceneId) => void;
  sceneLabelOverrides?: Partial<Record<BrainDumpSceneId, string>>;
  brainDumpResult?: BrainDumpResult | null;
  selectedTaskIds?: string[];
  onToggleTaskSelected?: (taskId: string) => void;
  onApplySelectedTasks?: () => void;
  kbText?: string;
  onKbTextChange?: (next: string) => void;
  contextPreviewLines?: string[];

  // Demo preview (no mic)
  demoTranscript?: string;
  onDemoTranscriptChange?: (next: string) => void;
  onGeneratePreview?: () => void;

  // Context options
  includeCompletedInContext?: boolean;
  onIncludeCompletedInContextChange?: (next: boolean) => void;

  // Per-file system prompt/theme (UI-only)
  systemPrompt?: string;
  onSystemPromptChange?: (next: string) => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onFinalTranscript,
  onStopListening,
  onAnalyze,
  onStart,
  language,
  showTranscript = true,
  stage = 'listening',
  anchorId,
  autoStartListening = true,

  brainDumpEnabled = false,
  sceneId: _sceneId,
  onSceneChange: _onSceneChange,
  sceneLabelOverrides: _sceneLabelOverrides,
  brainDumpResult,
  selectedTaskIds,
  onToggleTaskSelected,
  onApplySelectedTasks,
  kbText: _kbText,
  onKbTextChange: _onKbTextChange,
  contextPreviewLines: _contextPreviewLines,

  demoTranscript,
  onDemoTranscriptChange,
  onGeneratePreview: _onGeneratePreview,

  includeCompletedInContext: _includeCompletedInContext,
  onIncludeCompletedInContextChange: _onIncludeCompletedInContextChange,

  systemPrompt: _systemPrompt,
  onSystemPromptChange: _onSystemPromptChange,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micAutoPaused, setMicAutoPaused] = useState(false);
  const [micSupportError, setMicSupportError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [typeInsteadOpen, setTypeInsteadOpen] = useState(false);
  const typingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const didStopRef = useRef(false);
  const manualStopRef = useRef(false);
  const wantListeningRef = useRef(false);
  const stageRef = useRef<'listening' | 'processing' | 'done'>(stage);
  const autoRestartAttemptsRef = useRef(0);
  const autoRestartWindowStartRef = useRef(0);
  const [anchorStyle, setAnchorStyle] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Always allow Escape to close the overlay.
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const computeAnchor = () => {
    if (!anchorId) {
      setAnchorStyle(null);
      return;
    }
    const el = document.getElementById(anchorId);
    if (!el) {
      setAnchorStyle(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const width = Math.max(280, Math.min(rect.width - 32, 768));
    const left = rect.left + rect.width / 2;
    setAnchorStyle({ left, width });
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setMicSupportError('Speech recognition is not supported in this browser.');
      return;
    }

    // Ensure we don't leave a previous recognition instance running.
    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.abort === 'function') recognitionRef.current.abort();
        else recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    // User intent is "keep listening" unless they manually stop.
    wantListeningRef.current = true;
    manualStopRef.current = false;
    setMicAutoPaused(false);
    setMicSupportError(null);

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language || navigator.language || 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('Voice Mode: Started listening');
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('Voice Mode: Stopped listening');

      // Safari/Chrome speech recognition may end unexpectedly (silence/timeout/network).
      // If the user didn't tap Stop, we try to auto-restart to preserve the "continuous capture" feel.
      const shouldAutoRestart =
        wantListeningRef.current &&
        !manualStopRef.current &&
        stageRef.current === 'listening' &&
        isOpen;

      if (shouldAutoRestart) {
        const now = Date.now();
        if (now - autoRestartWindowStartRef.current > 8000) {
          autoRestartWindowStartRef.current = now;
          autoRestartAttemptsRef.current = 0;
        }
        autoRestartAttemptsRef.current += 1;

        if (autoRestartAttemptsRef.current <= 3) {
          window.setTimeout(() => {
            if (!isOpen) return;
            if (!wantListeningRef.current) return;
            if (stageRef.current !== 'listening') return;
            startListening();
          }, 250);
          return;
        }

        // Too many restarts in a short window; pause and prompt the user to continue.
        wantListeningRef.current = false;
        setMicAutoPaused(true);
        onStopListening?.();
        return;
      }

      onStopListening?.();
    };

    // We need to handle the final result in onresult to ensure we have the text
    recognition.onresult = (event: any) => {
      let interim = '';
      let finalDelta = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r?.[0]?.transcript || '';
        if (r.isFinal) {
          finalDelta += text;
        } else {
          interim += text;
        }
      }

      if (finalDelta) {
        const cleaned = finalDelta.trim();
        if (cleaned) {
          setFinalTranscript(prev => (prev ? `${prev} ${cleaned}` : cleaned));
          onFinalTranscript(cleaned);
        }
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
      // Don't spin forever on errors.
      wantListeningRef.current = false;
      setMicAutoPaused(true);
      onStopListening?.();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = (reason: 'manual' | 'cleanup' = 'cleanup') => {
    if (reason === 'manual') {
      manualStopRef.current = true;
      wantListeningRef.current = false;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        // abort() tends to stop more immediately than stop() and is better for "pause now" UX.
        if (typeof recognition.abort === 'function') recognition.abort();
        else recognition.stop();
      } catch {
        // ignore
      }
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (isOpen) {
      computeAnchor();
      setFinalTranscript('');
      setInterimTranscript('');
      didStopRef.current = false;
      setMicAutoPaused(false);
      setMicSupportError(null);
      autoRestartAttemptsRef.current = 0;
      autoRestartWindowStartRef.current = Date.now();
      if (autoStartListening) {
        onStart?.();
        startListening();
      }
    } else {
      stopListening('cleanup');
    }
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          if (typeof recognitionRef.current.abort === 'function') recognitionRef.current.abort();
          else recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => computeAnchor();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, anchorId]);

  // Note: we intentionally do not autosize the textarea. Autosizing tends to
  // create jumpy layout and multiple scroll regions. Instead we give the editor
  // a stable, generous height and keep scrolling inside the textarea.

  if (!isOpen) return null;

  const displayTranscript = (finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();

  const isPulsing = stage === 'listening' && isListening;

  const title = isListening ? 'Listening…' : stage === 'processing' ? 'Analyzing…' : 'Brain Dump';

  const startOrContinue = () => {
    didStopRef.current = false;
    setMicAutoPaused(false);
    onStart?.();
    startListening();
  };

  const pauseForTyping = () => {
    // Treat switching to typing as a manual pause of the mic.
    if (isListening || wantListeningRef.current || recognitionRef.current) {
      didStopRef.current = true;
      stopListening('manual');
      onStopListening?.();
    }
  };

  const handleStop = () => {
    didStopRef.current = true;
    stopListening('manual');
    onStopListening?.();
  };

  const handleAnalyze = () => {
    // If the mic is still on, stop it first; otherwise the header stays on
    // "Listening…" and results won't show while isListening is true.
    if (isListening || wantListeningRef.current || recognitionRef.current) {
      didStopRef.current = true;
      stopListening('manual');
      onStopListening?.();
    }

    const typed = (demoTranscript || '').trim();
    const useTyped = typeInsteadOpen && typed.length > 0;
    // Defer a tick so any final transcript event/flush can land.
    window.setTimeout(() => {
      onAnalyze?.(useTyped ? { typedText: typed } : undefined);
    }, 50);
  };

  if (brainDumpEnabled) {
    const showResults = !isListening && stage === 'done' && !!brainDumpResult;
    const isDesktopReviewFullScreen = !isMobile && stage === 'done' && !isListening;
    const showTranscriptPanel = showTranscript && !typeInsteadOpen;
    const showResultsPanel = showResults && !typeInsteadOpen;
    const isFullScreen = isMobile || isDesktopReviewFullScreen;

    return (
      <div className="fixed inset-0 z-50">
        {/* Blur/dim the list view behind the sheet */}
        <button
          type="button"
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close Brain Dump"
        />

        <div
          className={
            isFullScreen
              ? 'absolute inset-0 bg-base-100 flex flex-col'
              : 'absolute left-1/2 bottom-0 -translate-x-1/2 w-full max-w-3xl bg-base-100 flex flex-col border border-base-300 rounded-t-2xl shadow-2xl'
          }
          style={
            isFullScreen
              ? undefined
              : {
                  // Desktop capture uses a bottom-sheet. When typing is open, give
                  // the editor substantially more room without exceeding the screen.
                  maxHeight: typeInsteadOpen ? '85vh' : '50vh',
                  // Note: maxHeight alone allows the sheet to shrink to content.
                  // When typing is open we want the editor to visibly fill the view,
                  // so we pin the sheet height to the same value.
                  height: typeInsteadOpen ? '85vh' : undefined,
                }
          }
        >
        <div className="border-b border-base-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-primary/15 text-primary transition-transform ${isPulsing ? 'animate-pulse' : ''}`}>
              {stage === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{title}</div>
              <div className="text-xs text-base-content/60 truncate">
                {stage === 'done'
                  ? 'Finished — review and apply.'
                  : isListening
                    ? 'Tap the circle to pause.'
                    : 'Tap the circle to continue.'}
              </div>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} title="Close" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Content: avoid whole-page scroll; keep a single scroll area */}
        <div
          className={`flex-1 flex flex-col gap-3 px-4 py-3 ${typeInsteadOpen ? 'pb-2 overflow-hidden' : 'pb-4 overflow-y-auto'} min-h-0`}
        >
          {showTranscriptPanel ? (
            <div
              className={`border border-base-300 rounded-xl px-3 py-3 bg-base-200/30 shrink-0 ${
                typeInsteadOpen ? 'max-h-[8vh] overflow-hidden' : 'overflow-hidden'
              }`}
            >
              <div className="text-sm text-base-content/90 whitespace-pre-wrap break-words">{displayTranscript || (micSupportError ? '' : '…')}</div>
              {!isListening ? (
                <div className="text-xs text-base-content/60 mt-2">
                  {micSupportError
                    ? micSupportError
                    : micAutoPaused
                      ? 'Mic paused by the browser. Tap the center button to continue.'
                      : stage === 'done'
                        ? 'Finished. Review below or keep recording.'
                        : 'Paused. Tap Finish when you’re done.'}
                </div>
              ) : null}
            </div>
          ) : null}

          {showResultsPanel ? (
            <div className={`space-y-3 ${typeInsteadOpen ? 'shrink-0 max-h-[8vh] overflow-hidden' : 'shrink-0'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-base-300 rounded-xl p-3 bg-base-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Tasks</div>
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => onApplySelectedTasks?.()}
                      disabled={!onApplySelectedTasks || !brainDumpResult.tasks.length || !selectedTaskIds?.length}
                      title="Apply selected tasks to your list"
                      type="button"
                    >
                      Apply
                    </button>
                  </div>

                  {brainDumpResult.tasks.length === 0 ? (
                    <div className="text-sm text-base-content/60 mt-2">No tasks detected.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {brainDumpResult.tasks.map(t => {
                        const checked = selectedTaskIds?.includes(t.id) ?? true;
                        return (
                          <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm checkbox-primary mt-0.5"
                              checked={checked}
                              onChange={() => onToggleTaskSelected?.(t.id)}
                              disabled={!onToggleTaskSelected}
                            />
                            <div className="min-w-0">
                              <div className="text-sm text-base-content/90 break-words">{t.title}</div>
                              {(t.tags?.length || t.dueDate) ? (
                                <div className="text-xs text-base-content/60 flex flex-wrap gap-2">
                                  {t.tags?.length ? <span>{t.tags.map(x => `#${x}`).join(' ')}</span> : null}
                                  {t.dueDate ? <span>{`due:${t.dueDate}`}</span> : null}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border border-base-300 rounded-xl p-3 bg-base-100">
                    <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Next actions</div>
                  <div className="mt-2 space-y-3">
                    <ul className="text-sm text-base-content/80 list-disc pl-5 space-y-1">
                      {brainDumpResult.summaryBullets.map((b, i) => (
                        <li key={`s_${i}`} className="break-words">{b}</li>
                      ))}
                    </ul>
                    <ul className="text-sm text-base-content/80 list-disc pl-5 space-y-1">
                        {brainDumpResult.nextActions.map((b, i) => (
                        <li key={`h_${i}`} className="break-words">{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Typing mode: lets the user edit the same input as voice (collapsed by default). */}
          <div className={typeInsteadOpen ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0'}>
            <div className={`border border-base-300 rounded-xl p-3 bg-base-100 ${typeInsteadOpen ? 'flex flex-col min-h-0 flex-1' : ''}`}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2"
                onClick={() => {
                  setTypeInsteadOpen(prev => {
                    const nextOpen = !prev;
                    if (nextOpen) {
                      // If the user chooses to type, pause the mic.
                      pauseForTyping();

                      // If there isn't typed input yet, seed it from the current transcript so typing
                      // feels like editing the same input (true combined input).
                      if (!(demoTranscript ?? '').trim()) {
                        const seeded = displayTranscript.trim();
                        if (seeded) onDemoTranscriptChange?.(seeded);
                      }
                    }
                    return nextOpen;
                  });
                }}
              >
                <span className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Use typing</span>
                <span className="text-xs text-base-content/50 select-none">{typeInsteadOpen ? '▾' : '▸'}</span>
              </button>

              {typeInsteadOpen ? (
                <div className="mt-3 flex flex-col min-h-0 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Edit input</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-base-content/50">
                        {stage === 'processing'
                          ? 'Analyzing…'
                          : stage === 'done'
                            ? 'Edit and update results'
                            : 'Type, then finish'}
                      </div>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={handleAnalyze}
                        disabled={!onAnalyze || stage === 'processing' || !(demoTranscript ?? '').trim()}
                        title={stage === 'done' ? 'Update results from typed text' : 'Finish and analyze typed text'}
                      >
                        {stage === 'done' ? 'Update results' : 'Finish'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={typingTextareaRef}
                    className="textarea textarea-bordered w-full mt-2 resize-none overflow-y-auto overscroll-contain touch-pan-y flex-1 min-h-0 h-full"
                    // Let flexbox constrain height so the bottom controls never overlap.
                    // Scrolling stays inside the textarea.
                    style={
                      {
                        WebkitOverflowScrolling: 'touch',
                        height: '100%',
                        maxHeight: '100%',
                        flex: '1 1 auto',
                      } as React.CSSProperties
                    }
                    value={demoTranscript ?? ''}
                    onChange={(e) => {
                      onDemoTranscriptChange?.(e.target.value);
                    }}
                    onWheel={(e) => {
                      // Keep scrolling inside the editor (avoid trapping the wheel on the overlay).
                      e.stopPropagation();
                    }}
                    onTouchMove={(e) => {
                      // Same as wheel: prevent the overlay from eating the scroll gesture.
                      e.stopPropagation();
                    }}
                    onFocus={() => {
                      // Safety: focusing the editor should always stop the mic.
                      pauseForTyping();
                    }}
                    placeholder="Type or edit your brain dump input…"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Fixed bottom controls (no overlap with transcript) */}
        <div className={`border-t border-base-200 px-4 ${typeInsteadOpen ? 'py-2' : 'py-3'}`}>
          {/* Single primary action when paused (no A/B buttons) */}
          {!typeInsteadOpen && !isListening && stage !== 'processing' && stage !== 'done' ? (
            <button
              type="button"
              className="btn btn-primary w-full mb-3"
              onClick={handleAnalyze}
              disabled={!onAnalyze}
              title="Finish and run Brain Dump"
            >
              Finish
            </button>
          ) : null}

          <div className={`relative ${typeInsteadOpen ? 'h-14' : 'h-20'} flex items-center`}>
            {/* Center mic control stays centered even when Finish is visible */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <button
                type="button"
                className={`btn btn-circle btn-primary ${typeInsteadOpen ? 'w-12 h-12' : 'w-16 h-16'} ${stage === 'processing' ? 'btn-disabled' : ''}`}
                onClick={() => {
                  if (stage === 'processing') return;
                  if (isListening) {
                    handleStop();
                  } else {
                    startOrContinue();
                  }
                }}
                aria-label={isListening ? 'Pause recording' : 'Continue recording'}
                title={isListening ? 'Pause' : 'Continue'}
              >
                {isListening ? <Pause size={typeInsteadOpen ? 18 : 22} /> : <Mic size={typeInsteadOpen ? 18 : 22} />}
              </button>

              <div className="text-xs text-base-content/70">
                {stage === 'processing'
                  ? 'Analyzing…'
                  : micSupportError
                    ? 'Mic unsupported'
                    : isListening
                      ? 'Tap to pause'
                      : 'Tap to continue'}
              </div>
            </div>

            {/* No competing A/B button here; Finish/Update lives in review Options */}
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="pointer-events-auto absolute bottom-4"
        style={
          anchorStyle
            ? {
                left: `${anchorStyle.left}px`,
                width: `${anchorStyle.width}px`,
                transform: 'translateX(-50%)',
              }
            : {
                left: '50%',
                width: 'calc(100% - 2rem)',
                maxWidth: '48rem',
                transform: 'translateX(-50%)',
              }
        }
      >
        <div className="bg-base-100/90 backdrop-blur border border-base-300 shadow-xl rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-primary/15 text-primary transition-transform ${isPulsing ? 'animate-pulse' : ''}`}>
                {stage === 'processing' ? <Loader2 size={18} className="animate-spin" /> : stage === 'done' ? <CheckCircle2 size={18} /> : <Mic size={18} />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{title}</div>
                {stage === 'listening' ? (
                  <div className="text-xs text-base-content/60 truncate">Listening</div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stage === 'listening' ? (
                <button
                  className="btn btn-sm btn-outline btn-error rounded-full"
                  onClick={() => {
                    didStopRef.current = true;
                    stopListening();
                    onStopListening?.();
                  }}
                  type="button"
                >
                  Stop
                </button>
              ) : (
                <>
                  {!autoStartListening && !isListening && (
                    <button
                      className="btn btn-sm btn-primary rounded-full"
                      onClick={() => {
                        onStart?.();
                        startListening();
                      }}
                      type="button"
                    >
                      Start
                    </button>
                  )}
                </>
              )}

              <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose} title="Close" type="button">
                <X size={16} />
              </button>
            </div>
          </div>

          {showTranscript && stage === 'listening' && (
            <div className="mt-3 bg-base-200/40 border border-base-300 rounded-xl px-3 py-2 min-h-[48px]">
              <div className="text-sm text-base-content/80 break-words">{displayTranscript || '…'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
