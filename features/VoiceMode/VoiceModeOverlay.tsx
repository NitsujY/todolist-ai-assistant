import React, { useState, useEffect } from 'react';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (text: string) => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({ isOpen, onClose, onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = React.useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('Voice Mode: Started listening');
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('Voice Mode: Stopped listening');
      // If we have a transcript, send it as a command. 
      // Note: We need to access the latest state of transcript here, 
      // but since this is a closure, we might get stale state.
      // Better to rely on the event result or use a ref for transcript.
    };

    // We need to handle the final result in onresult to ensure we have the text
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);
      
      if (event.results[current].isFinal) {
         onCommand(transcriptText);
         // Optional: Close overlay or restart listening?
         // For now, let's keep it open but maybe stop listening to process
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
      setTranscript(''); // Clear previous transcript
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

  // Silence unused variable warnings for now
  void onCommand;
  void setTranscript;
  void transcript;

  if (!isOpen) return null;

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
          <p className="text-base-content/60">{transcript || "Say 'Add task buy milk'..."}</p>
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
