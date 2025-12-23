import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Save, Settings2, X } from 'lucide-react';
import type { AIPluginConfig } from '../config';
import { loadAIPluginConfig, saveAIPluginConfig } from '../utils/configStorage';

export const AISettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AIPluginConfig>(() => loadAIPluginConfig());
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    setConfig(loadAIPluginConfig());
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSave = () => {
    setStatus('saving');
    saveAIPluginConfig(config);
    setTimeout(() => setStatus('saved'), 500);
    setTimeout(() => setStatus('idle'), 2000);
  };

  const providerLabel = useMemo(() => {
    if (config.provider === 'private') return 'Managed Service';
    return `BYOK (${config.provider})`;
  }, [config.provider]);

  const effectiveSpeechLang = useMemo(() => {
    if (config.speechLanguage && config.speechLanguage !== 'auto') return config.speechLanguage;
    return navigator.language || 'en-US';
  }, [config.speechLanguage]);

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
        onClick={() => setIsOpen(true)}
        title="AI Settings"
      >
        <Settings2 size={16} />
      </button>
      <span className="text-xs text-base-content/50 hidden sm:inline">{providerLabel}</span>

      {isOpen && (
        <div className="fixed inset-0 z-[200]">
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
            aria-label="Close AI settings"
          />

          {/* Full-screen settings page */}
          <div className="absolute inset-0 w-full bg-base-100 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
              <div>
                <div className="font-semibold">AI Assistant</div>
                <div className="text-xs text-base-content/60">Settings</div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-sm btn-circle"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="space-y-3">
                <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">LLM Settings</div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">Provider</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={config.provider}
                    onChange={(e) => setConfig({ ...config, provider: e.target.value as AIPluginConfig['provider'] })}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure-openai">Azure OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="private">Private Endpoint (Managed)</option>
                  </select>
                  <div className="text-xs text-base-content/60 mt-1">
                    {config.provider === 'private'
                      ? 'Use your paid managed service (requires License Key).'
                      : 'Bring your own key (stored locally in this browser).'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {config.provider !== 'azure-openai' && (
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text">Model (optional)</span>
                      </label>
                      <input
                        className="input input-bordered w-full"
                        value={config.model || ''}
                        onChange={(e) => setConfig({ ...config, model: e.target.value })}
                        placeholder={config.provider === 'openai' ? 'gpt-4.1-mini' : 'leave blank'}
                      />
                    </div>
                  )}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text">Temperature</span>
                      <span className="label-text-alt text-base-content/50">{(config.temperature ?? 0.2).toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={config.temperature ?? 0.2}
                      onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
                      className="range range-primary range-sm"
                    />
                  </div>
                </div>

                {config.provider === 'azure-openai' && (
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text">Azure Endpoint</span>
                      </label>
                      <input
                        className="input input-bordered w-full"
                        value={config.azureEndpoint || ''}
                        onChange={(e) => setConfig({ ...config, azureEndpoint: e.target.value })}
                        placeholder="https://<resource>.openai.azure.com"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text">API Version</span>
                        </label>
                        <input
                          className="input input-bordered w-full"
                          value={config.azureApiVersion || ''}
                          onChange={(e) => setConfig({ ...config, azureApiVersion: e.target.value })}
                          placeholder="2024-06-01"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text">Deployment</span>
                        </label>
                        <input
                          className="input input-bordered w-full"
                          value={config.azureDeployment || ''}
                          onChange={(e) => setConfig({ ...config, azureDeployment: e.target.value })}
                          placeholder="my-gpt-4o-mini-deployment"
                        />
                      </div>
                    </div>

                    <div className="text-xs text-base-content/60">
                      Azure uses a <span className="font-mono">deployment name</span> (not a model name). Your key is still entered below.
                    </div>
                  </div>
                )}

                {config.provider === 'private' && (
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text">Private Endpoint URL</span>
                    </label>
                    <input
                      className="input input-bordered w-full"
                      value={config.privateEndpointUrl || ''}
                      onChange={(e) => setConfig({ ...config, privateEndpointUrl: e.target.value })}
                      placeholder="https://api.your-service.example"
                    />
                  </div>
                )}

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">{config.provider === 'private' ? 'License Key' : 'API Key'}</span>
                  </label>
                  <div className="join w-full">
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="input input-bordered join-item w-full"
                      value={config.provider === 'private' ? (config.licenseKey || '') : (config.apiKey || '')}
                      onChange={(e) => {
                        if (config.provider === 'private') {
                          setConfig({ ...config, licenseKey: e.target.value });
                        } else {
                          setConfig({ ...config, apiKey: e.target.value });
                        }
                      }}
                      placeholder={config.provider === 'private' ? 'Enter license key…' : 'Enter API key…'}
                    />
                    <button
                      className="btn join-item"
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">Keys are saved to localStorage on this device.</div>
                </div>
              </div>

              <div className="divider my-0" />

              <div className="space-y-3">
                <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Brain Dump</div>

                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={config.voiceModeEnabled}
                    onChange={(e) => setConfig({ ...config, voiceModeEnabled: e.target.checked })}
                  />
                  <span className="label-text">Enable Brain Dump</span>
                </label>

                <button
                  className="btn btn-sm btn-primary w-full"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    window.dispatchEvent(new CustomEvent('ai:open-brain-dump'));
                  }}
                  disabled={!config.voiceModeEnabled}
                  title={config.voiceModeEnabled ? 'Open Brain Dump' : 'Enable Brain Dump to open'}
                >
                  Open Brain Dump
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text">Speech-to-Text</span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={config.speechToTextProvider}
                      onChange={(e) => setConfig({ ...config, speechToTextProvider: e.target.value as AIPluginConfig['speechToTextProvider'] })}
                    >
                      <option value="webSpeech">Web Speech (free)</option>
                      <option value="whisper" disabled>
                        Whisper (endpoint) – coming soon
                      </option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text">Language</span>
                      <span className="label-text-alt text-base-content/50">Now: {effectiveSpeechLang}</span>
                    </label>
                    <input
                      className="input input-bordered w-full"
                      value={config.speechLanguage}
                      onChange={(e) => setConfig({ ...config, speechLanguage: e.target.value })}
                      placeholder="auto / en-US / zh-TW"
                    />
                  </div>
                </div>

                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={config.showVoiceTranscript}
                    onChange={(e) => setConfig({ ...config, showVoiceTranscript: e.target.checked })}
                  />
                  <span className="label-text">Show real-time transcript</span>
                </label>

                <details className="border border-base-200 rounded-xl p-3">
                  <summary className="cursor-pointer text-sm">Advanced: Scene labels</summary>
                  <div className="mt-3 form-control">
                    <label className="label py-1">
                      <span className="label-text">Scene label overrides (JSON)</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered w-full min-h-[120px]"
                      value={config.brainDumpSceneLabelsJson || ''}
                      onChange={(e) => setConfig({ ...config, brainDumpSceneLabelsJson: e.target.value })}
                      placeholder={`{\n  "brain-dump": "Brain Dump",\n  "project-brainstorm": "Brainstorm",\n  "dev-todo": "Dev TODO",\n  "daily-reminders": "Reminders"\n}`}
                    />
                    <div className="text-xs text-base-content/60 mt-1">
                      Keys must be one of: brain-dump, project-brainstorm, dev-todo, daily-reminders.
                    </div>
                  </div>
                </details>
              </div>

              <div className="divider my-0" />

              <div className="space-y-3">
                <div className="text-xs font-semibold text-base-content/70 uppercase tracking-wider">Features</div>

                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={config.smartTagsEnabled}
                    onChange={(e) => setConfig({ ...config, smartTagsEnabled: e.target.checked })}
                  />
                  <span className="label-text">Smart Tags (background)</span>
                </label>

                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={config.taskBreakdownEnabled}
                    onChange={(e) => setConfig({ ...config, taskBreakdownEnabled: e.target.checked })}
                  />
                  <span className="label-text">Task Breakdown (magic wand)</span>
                </label>

                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={config.chatEnabled}
                    onChange={(e) => setConfig({ ...config, chatEnabled: e.target.checked })}
                  />
                  <span className="label-text">Chat (coming soon)</span>
                </label>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text">Task Breakdown Prompt</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full min-h-[120px]"
                    value={config.taskBreakdownPrompt}
                    onChange={(e) => setConfig({ ...config, taskBreakdownPrompt: e.target.value })}
                  />
                  <div className="text-xs text-base-content/60 mt-1">
                    Tip: Use <span className="font-mono">{'{{task}}'}</span> as a placeholder.
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-base-200 p-4 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setIsOpen(false)}>
                Close
              </button>
              <button className="btn btn-primary gap-2" onClick={handleSave} disabled={status === 'saving'}>
                {status === 'saved' ? 'Saved' : 'Save'}
                <Save size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
