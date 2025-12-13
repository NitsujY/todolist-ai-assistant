import React, { useState, useEffect } from 'react';
import { Settings, X, Eye, EyeOff, Save, Key } from 'lucide-react';
import { AIPluginConfig, DEFAULT_CONFIG } from '../config';

export const AISettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AIPluginConfig>(DEFAULT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const saved = localStorage.getItem('ai-plugin-config');
    if (saved) {
      try {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to parse AI config', e);
      }
    }
  }, []);

  const handleSave = () => {
    setStatus('saving');
    localStorage.setItem('ai-plugin-config', JSON.stringify(config));
    setTimeout(() => setStatus('saved'), 500);
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center p-2 bg-base-200 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Settings size={20} />
          </div>
          <div>
            <div className="font-bold">AI Configuration</div>
            <div className="text-xs opacity-60">
              {config.provider === 'private' ? 'Managed Service' : `BYOK (${config.provider})`}
            </div>
          </div>
        </div>
        <button 
          className="btn btn-sm btn-ghost"
          onClick={() => setIsOpen(true)}
        >
          Configure
        </button>
      </div>

      {/* Settings Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-base-100 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-base-200">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings size={20} />
                AI Assistant Settings
              </h3>
              <button onClick={() => setIsOpen(false)} className="btn btn-ghost btn-sm btn-circle">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Provider Selection */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold">AI Provider</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                >
                  <option value="openai">OpenAI (GPT-4/3.5)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="private">Private Endpoint (Managed)</option>
                </select>
                <label className="label">
                  <span className="label-text-alt opacity-60">
                    {config.provider === 'private' 
                      ? 'Requires a valid license key.' 
                      : 'Connect directly to the provider with your own API key.'}
                  </span>
                </label>
              </div>

              {/* API Key Input */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold flex items-center gap-2">
                    <Key size={16} />
                    {config.provider === 'private' ? 'License Key' : 'API Key'}
                  </span>
                </label>
                <div className="join w-full">
                  <input 
                    type={showKey ? "text" : "password"}
                    placeholder={config.provider === 'private' ? "Enter license key..." : "sk-..."}
                    className="input input-bordered join-item w-full font-mono text-sm"
                    value={config.provider === 'private' ? (config.licenseKey || '') : (config.apiKey || '')}
                    onChange={(e) => {
                      if (config.provider === 'private') {
                        setConfig({ ...config, licenseKey: e.target.value });
                      } else {
                        setConfig({ ...config, apiKey: e.target.value });
                      }
                    }}
                  />
                  <button 
                    className="btn join-item border-base-300"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="divider">Features</div>

              {/* Feature Toggles */}
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-4">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-primary" 
                      checked={config.voiceModeEnabled}
                      onChange={(e) => setConfig({ ...config, voiceModeEnabled: e.target.checked })}
                    />
                    <div>
                      <span className="label-text font-bold block">Voice Mode</span>
                      <span className="label-text-alt opacity-70">Enable voice commands and speech-to-text interface.</span>
                    </div>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-4">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-primary" 
                      checked={config.smartTagsEnabled}
                      onChange={(e) => setConfig({ ...config, smartTagsEnabled: e.target.checked })}
                    />
                    <div>
                      <span className="label-text font-bold block">Smart Tags</span>
                      <span className="label-text-alt opacity-70">Automatically suggest tags for new tasks based on content.</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-base-200 bg-base-50 rounded-b-xl flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setIsOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary gap-2" 
                onClick={handleSave}
                disabled={status === 'saving'}
              >
                {status === 'saved' ? 'Saved!' : 'Save Changes'}
                <Save size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
