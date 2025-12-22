import { useState } from 'react';
import { VoiceModeOverlay } from '../features/VoiceMode/VoiceModeOverlay';
import { Bot } from 'lucide-react';
import { useTodoStore } from '../../../store/useTodoStore';

export const VoiceModeButton = () => {
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const addTask = useTodoStore(state => state.addTask);

  const handleCommand = (text: string) => {
    console.log('Received Voice Command:', text);
    const lowerText = text.toLowerCase();
    
    // Simple heuristic for now: "Add task [content]"
    if (lowerText.startsWith('add task') || lowerText.startsWith('create task')) {
      const content = text.substring(text.indexOf('task') + 4).trim();
      if (content) {
        addTask(content);
        // Optional: Provide audio feedback
        const utterance = new SpeechSynthesisUtterance(`Added task: ${content}`);
        window.speechSynthesis.speak(utterance);
      }
    } else {
        // Fallback: just add whatever was said if it's short? 
        // Or maybe say "I didn't catch that"
        // For this demo, let's just add it if it doesn't match a command, assuming the user just wants to dictate.
        // But to be safe, let's require "add" or just add it.
        // Let's just add it for now to be "friendly"
        addTask(text);
        const utterance = new SpeechSynthesisUtterance(`Added: ${text}`);
        window.speechSynthesis.speak(utterance);
    }
    
    // Close overlay after command? Or keep open for multiple?
    // Let's keep it open for now, user can close manually.
    // Actually, maybe we should restart listening?
  };

  return (
    <>
      <button 
        className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
        onClick={() => setIsVoiceModeOpen(true)}
        title="Voice Mode"
      >
        <Bot size={18} />
      </button>
      <VoiceModeOverlay 
        isOpen={isVoiceModeOpen} 
        onClose={() => setIsVoiceModeOpen(false)}
        onCommand={handleCommand}
      />
    </>
  );
};
