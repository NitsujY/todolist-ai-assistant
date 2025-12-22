import React, { useState, useEffect } from 'react';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (text: string) => void;
  language?: string;
  showTranscript?: boolean;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onCommand,
  language,
  showTranscript = true,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = React.useRef<any>(null);

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
          onCommand(full);
          // Reset after dispatch so the user sees a fresh buffer
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
      setFinalTranscript('');
      setInterimTranscript('');
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

  if (!isOpen) return null;

  const displayTranscript = (finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base-100/95 backdrop-blur-sm">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 btn btn-ghost btn-circle"
        title="Close Voice Mode"
      >
        ✕
      </button>
      
      <div className="text-center space-y-8">
        <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-primary/20 scale-110' : 'bg-base-200'}`}>
          <div className={`w-24 h-24 rounded-full bg-primary flex items-center justify-center transition-all duration-300 ${isListening ? 'animate-pulse' : ''}`}>
            <span className="text-4xl">🎤</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">I'm listening...</h2>
          {showTranscript ? (
            <div className="w-full max-w-xl mx-auto">
              <div className="text-left text-xs text-base-content/60 mb-1">Live transcript</div>
              <div className="bg-base-200/50 border border-base-300 rounded-lg px-4 py-3 min-h-[64px]">
                <div className="text-base-content/80 break-words">
                  {displayTranscript || "Say: 'Add task buy milk'…"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-base-content/60">Say: "Add task buy milk"…</p>
          )}
        </div>

        <button 
          onClick={onClose}
          className="btn btn-outline btn-error rounded-full px-8"
        >
          Stop Listening
        </button>
      </div>
    </div>
  );
};
