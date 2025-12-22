import React, { useEffect, useRef, useState } from 'react';
import { Mic, X, Loader2, CheckCircle2 } from 'lucide-react';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onFinalTranscript: (text: string) => void;
  onStop: () => void;
  language?: string;
  showTranscript?: boolean;
  stage?: 'listening' | 'processing' | 'done';
  anchorId?: string;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onFinalTranscript,
  onStop,
  language,
  showTranscript = true,
  stage = 'listening',
  anchorId,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = React.useRef<any>(null);
  const didStopRef = useRef(false);
  const [anchorStyle, setAnchorStyle] = useState<{ left: number; width: number } | null>(null);

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
      alert('Speech recognition is not supported in this browser.');
      return;
    }

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
      if (!didStopRef.current) {
        didStopRef.current = true;
        onStop();
      }
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
        setFinalTranscript(prev => (prev + finalDelta).trim());
        setInterimTranscript('');
        const full = (finalTranscript + ' ' + finalDelta).trim();
        if (full) {
          onFinalTranscript(full);
          setFinalTranscript('');
          setInterimTranscript('');
        }
      } else {
        setInterimTranscript(interim.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (isOpen) {
      computeAnchor();
      setFinalTranscript('');
      setInterimTranscript('');
      didStopRef.current = false;
      startListening();
    } else {
      stopListening();
    }
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => computeAnchor();
    const onScroll = () => computeAnchor();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, anchorId]);

  if (!isOpen) return null;

  const displayTranscript = (finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();

  const isPulsing = stage === 'listening' && isListening;

  const title =
    stage === 'processing'
      ? 'Summarizing…'
      : stage === 'done'
        ? 'Saved'
        : isListening
          ? 'Listening…'
          : 'Starting…';

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
                <div className="text-xs text-base-content/60 truncate">
                  {stage === 'listening' ? 'Speak naturally. Final text will be captured.' : stage === 'processing' ? 'Writing summary into this document…' : 'Voice notes updated.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {stage === 'listening' ? (
                <button
                  className="btn btn-sm btn-outline btn-error rounded-full"
                  onClick={() => {
                    didStopRef.current = true;
                    stopListening();
                    onStop();
                  }}
                >
                  Stop
                </button>
              ) : (
                <button className="btn btn-sm btn-ghost" onClick={onClose}>
                  Close
                </button>
              )}

              <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose} title="Dismiss">
                <X size={16} />
              </button>
            </div>
          </div>

          {showTranscript && (
            <div className="mt-3">
              <div className="text-xs text-base-content/60 mb-1">Live transcript</div>
              <div className="bg-base-200/40 border border-base-300 rounded-xl px-3 py-2 min-h-[48px]">
                <div className="text-sm text-base-content/80 break-words">
                  {displayTranscript || (stage === 'listening' ? '…' : '')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
