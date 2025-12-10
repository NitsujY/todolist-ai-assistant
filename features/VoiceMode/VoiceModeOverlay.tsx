import React, { useState, useEffect } from 'react';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (text: string) => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({ isOpen, onClose, onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startListening = () => {
    setIsListening(true);
    // TODO: Implement Web Speech API
    console.log('Voice Mode: Started listening');
  };

  const stopListening = () => {
    setIsListening(false);
    console.log('Voice Mode: Stopped listening');
  };

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
    }
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
      </div>
    </div>
  );
};
