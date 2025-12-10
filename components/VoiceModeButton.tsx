import React, { useState } from 'react';
import { VoiceModeOverlay } from '../features/VoiceMode/VoiceModeOverlay';

export const VoiceModeButton = () => {
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

  return (
    <>
      <button 
        className="btn btn-ghost btn-sm btn-circle"
        onClick={() => setIsVoiceModeOpen(true)}
        title="Voice Mode"
      >
        ✨
      </button>
      <VoiceModeOverlay 
        isOpen={isVoiceModeOpen} 
        onClose={() => setIsVoiceModeOpen(false)}
        onCommand={(text) => console.log('Command:', text)}
      />
    </>
  );
};
