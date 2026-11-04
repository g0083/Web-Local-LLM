import React from 'react';
import { MODEL_URLS } from '../services/history';
import { t, getLanguage, setLanguage } from '../utils/i18n';
import { setUserLanguage } from '../services/history';

export default function SettingsModal({
    isOpen,
    onClose,
    config,
    onSave,
    title = "Settings",
    hasWebGPU = false,
    modelConfig = null,
    onSaveModelConfig = null,
    isGenerating = false,
    onRedownload,
    downloadedModels = [],
    onListModels,
    onDeleteModel,
    onAddCustomModel, // New prop
    onRemoveCustomModel, // New prop
    lmStudioConfig = { enabled: false, baseUrl: 'http://localhost:1234/v1', modelId: '' }, // New prop
    onSaveLMStudioConfig // New prop
}) {
    if (!isOpen) return null;


    const [localConfig, setLocalConfig] = React.useState({
        systemPrompt: '',
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxTokens: 2000,
        ...config
    });
    const [localModelConfig, setLocalModelConfig] = React.useState(modelConfig);
    const [localLMStudioConfig, setLocalLMStudioConfig] = React.useState(lmStudioConfig);
    const [customModelUrl, setCustomModelUrl] = React.useState('');
    const [customModelName, setCustomModelName] = React.useState('');
    const [isAddingModel, setIsAddingModel] = React.useState(false);
    const [availableVoices, setAvailableVoices] = React.useState([]);
    const [lmStudioModels, setLmStudioModels] = React.useState([]);
    const [isLoadingLMModels, setIsLoadingLMModels] = React.useState(false);

    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                setAvailableVoices(voices);
            };

            updateVoices();
            window.speechSynthesis.onvoiceschanged = updateVoices;

            return () => {
                window.speechSynthesis.onvoiceschanged = null;
            };
        }
    }, []);

    // Fetch LM Studio models when enabled
    React.useEffect(() => {
        if (localLMStudioConfig.enabled && localLMStudioConfig.baseUrl) {
            fetchLMStudioModels();
        }
    }, [localLMStudioConfig.enabled, localLMStudioConfig.baseUrl]);

    const fetchLMStudioModels = async () => {
        if (!localLMStudioConfig.baseUrl) return;
        setIsLoadingLMModels(true);
        try {
            const url = `${localLMStudioConfig.baseUrl.replace(/\/$/, '')}/models`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    setLmStudioModels(data.data);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch LM Studio models:', e);
        } finally {
            setIsLoadingLMModels(false);
        }
    };

    const applyLMStudioModel = async (modelId) => {
        if (!modelId || !localLMStudioConfig.baseUrl) return;

        try {
            const baseUrl = localLMStudioConfig.baseUrl.replace(/\/$/, '');

            // Load new model via Chat Completion (Standard OpenAI way to force load)
            const url = `${baseUrl}/chat/completions`;
            // We just send a dummy request with max_tokens 1 to trigger loading
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });

            if (res.ok) {
                // Also save config immediately
                // Update the local state first to ensure internal consistency if needed (though we passed modelId)
                const updatedConfig = { ...localLMStudioConfig, modelId };
                if (onSaveLMStudioConfig) onSaveLMStudioConfig(updatedConfig);
                // Optional: alert check? maybe skip alert for auto-apply to be less annoying?
                // Or just a console log?
                console.log("Model switch triggered successfully!");
            } else {
                console.warn("Failed to trigger load. Check if server logs show a model reload.");
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        }
    };


    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setLocalConfig(prev => ({
            ...prev,
            [name]: (type === 'number' || type === 'range') ? parseFloat(value) : value
        }));
    };

    const handleModelConfigChange = (e) => {
        if (isGenerating) return;
        const { name, value, type, checked } = e.target;
        setLocalModelConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value)
        }));
    };

    const handleModelSelectionChange = (e) => {
        if (isGenerating) return;
        const name = e.target.value;

        // Check if it's a built-in model
        let url = MODEL_URLS[name];

        // If not, check if it's a custom model
        if (!url) {
            const customModel = downloadedModels.find(m => m.name === name);
            if (customModel) {
                // For custom models, we use the cacheName or url
                // If it's a file, url might be a blob or cache key, we need to pass what `useEngine` expects.
                // `useEngine` expects `model_url` to be the downloadable URL OR string to identify it.
                // Re-using originalURL or name if valid.
                url = customModel.url || customModel.originalURL || name;
            }
        }

        setLocalModelConfig(prev => ({
            ...prev,
            model_name: name,
            model_url: url
        }));
    };

    const [saveAsDefault, setSaveAsDefault] = React.useState(false);

    const handleSave = () => {
        if (isGenerating) return;
        onSave(localConfig, saveAsDefault);
        if (onSaveModelConfig && localModelConfig) {
            onSaveModelConfig(localModelConfig);
        }
        if (onSaveLMStudioConfig) {
            onSaveLMStudioConfig(localLMStudioConfig);
        }
        onClose();
    };

    const handleAddCustomModel = async (e) => {
        e.preventDefault();
        if (!customModelName || !customModelUrl) return;

        // Force save current config state (e.g. LM Studio disabled) before adding model/reloading
        if (onSaveLMStudioConfig) {
            await onSaveLMStudioConfig(localLMStudioConfig);
        }
        if (onSave) {
            onSave(localConfig, saveAsDefault);
        }

        setIsAddingModel(true);
        try {
            await onAddCustomModel({
                name: customModelName,
                url: customModelUrl,
                type: 'url'
            });

            // Auto-select
            if (onSaveModelConfig) {
                await onSaveModelConfig({
                    model_name: customModelName,
                    model_url: customModelUrl
                });
                // Small delay to ensure storage persistence
                await new Promise(r => setTimeout(r, 500));
            }

            setCustomModelName('');
            setCustomModelUrl('');
        } catch (err) {
            console.error(err);
            alert('Failed to add model: ' + err.message);
        } finally {
            setIsAddingModel(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        if (!fileName.endsWith('.gguf')) {
            alert('Please select a .gguf file');
            return;
        }

        setIsAddingModel(true);
        try {
            await onAddCustomModel({
                name: fileName,
                file: file,
                type: 'file',
                size: file.size
            });

            // Auto-select
            if (onSaveModelConfig) {
                // For file, URL is the fake one we generated in App.jsx... 
                // Wait, SettingsModal doesn't know the fake URL.
                // But App.jsx's `onAddCustomModel` handles DB insertion.
                // We can guess the URL: `https://custom-model/${fileName}`
                await onSaveModelConfig({
                    model_name: fileName,
                    model_url: `https://custom-model/${fileName}`
                });
            }

        } catch (err) {
            console.error(err);
            alert('Failed to add file: ' + err.message);
        } finally {
            setIsAddingModel(false);
        }
    };


    // Track previous isOpen state to detect when modal opens
    const prevIsOpenRef = React.useRef(false);

    // Reset local config when modal opens
    React.useEffect(() => {
        // Only reset when modal transitions from closed to open
        if (isOpen && !prevIsOpenRef.current) {
            setSaveAsDefault(false); // Reset default checkbox
            // Ensure all config properties have default values
            const defaultConfig = {
                systemPrompt: '',
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                maxTokens: 2000,
                voicePitch: 1.0,
                voiceRate: 1.0,
                voiceVolume: 1.0,
                voiceName: '',
                recognitionLanguage: 'ja-JP',
                realTimeSpeech: true,
                useLocalSpeech: false,
                ...config
            };
            setLocalConfig(defaultConfig);
            if (modelConfig) {
                // Ensure model_name exists for older configs
                const safeModelConfig = {
                    ...modelConfig,
                    model_name: modelConfig.model_name || 'thinking'
                };
                setLocalModelConfig(safeModelConfig);
            }
            if (lmStudioConfig) {
                setLocalLMStudioConfig(lmStudioConfig);
            }
            if (onListModels) {
                onListModels();
            }
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen]); // Only depend on isOpen

    return (
        <div className="modal-overlay">
            <div className="modal-content glass">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="modal-body">
                    {isGenerating && (
                        <div className="warning-banner">
                            ⚠️ {getLanguage() === 'ja' ? '生成中は設定を変更できません。' : 'Settings cannot be changed while generation is in progress.'}
                        </div>
                    )}

                    <div className={`setting-group ${isGenerating ? 'disabled-section' : ''}`} style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                        <label>{t('settings.language')}</label>
                        <select
                            value={getLanguage()}
                            onChange={async (e) => {
                                const newLang = e.target.value;
                                setLanguage(newLang);
                                await setUserLanguage(newLang);
                                // Force re-render
                                window.location.reload();
                            }}
                            disabled={isGenerating}
                        >
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                        </select>
                        <small>{t('settings.languageDesc')}</small>
                    </div>

                    <div className={`setting-group ${isGenerating ? 'disabled-section' : ''}`} style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                        <label>{t('settings.systemPrompt')}</label>
                        <textarea
                            name="systemPrompt"
                            value={localConfig.systemPrompt}
                            onChange={handleChange}
                            rows={3}
                            placeholder={t('settings.systemPromptPlaceholder')}
                            disabled={isGenerating}
                        />
                        <small>{t('settings.systemPromptDesc')}</small>
                    </div>

                    {/* Voice Settings Section */}
                    {window.speechSynthesis && (
                        <>
                            <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto', marginTop: '20px', borderTop: '1px solid var(--color-glass-border)', paddingTop: '10px' }}>
                                <label style={{ marginBottom: '10px', display: 'block', color: 'var(--color-accent)' }}>{t('settings.voiceSettings') || 'Voice Settings'}</label>

                                <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto', marginBottom: '15px' }}>
                                    <label>{t('settings.recognitionLanguage') || 'Speech Recognition Language'}</label>
                                    <select
                                        name="recognitionLanguage"
                                        value={localConfig.recognitionLanguage || 'ja-JP'}
                                        onChange={handleChange}
                                        disabled={isGenerating}
                                    >
                                        <option value="ja-JP">日本語 (Japanese)</option>
                                        <option value="en-US">English (US)</option>
                                    </select>
                                </div>

                                <label>{t('settings.voiceName') || 'Voice'}</label>
                                <select
                                    name="voiceName"
                                    value={localConfig.voiceName || ''}
                                    onChange={handleChange}
                                    disabled={isGenerating}
                                >
                                    <option value="">Default</option>
                                    {availableVoices.map((voice) => (
                                        <option key={voice.name} value={voice.name}>
                                            {voice.name} ({voice.lang})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        name="realTimeSpeech"
                                        checked={localConfig.realTimeSpeech || false}
                                        onChange={(e) => setLocalConfig(prev => ({ ...prev, realTimeSpeech: e.target.checked }))}
                                        style={{ width: 'auto', margin: 0, transform: 'scale(1.2)' }}
                                    />
                                    <span>{t('settings.realTimeSpeech')}</span>
                                </label>
                            </div>

                            <div className="setting-group" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        name="useLocalSpeech"
                                        checked={false}
                                        readOnly
                                        disabled
                                        style={{ width: 'auto', margin: 0, transform: 'scale(1.2)' }}
                                    />
                                    <span>{t('ui.localSpeechDisabled')}</span>
                                </label>
                                <small style={{ display: 'block', marginTop: '4px', color: 'var(--color-text-muted)' }}>
                                    {t('ui.featureUnavailable')}
                                </small>
                            </div>


                            <div className="setting-row" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                                <div className="setting-group">
                                    <label>{t('settings.formattedPitch') ? t('settings.formattedPitch').replace('{value}', localConfig.voicePitch || 1.0) : `Pitch: ${localConfig.voicePitch || 1.0}`}</label>
                                    <input
                                        type="range"
                                        name="voicePitch"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={localConfig.voicePitch || 1.0}
                                        onChange={handleChange}
                                        disabled={isGenerating}
                                    />
                                </div>
                                <div className="setting-group">
                                    <label>{t('settings.formattedRate') ? t('settings.formattedRate').replace('{value}', localConfig.voiceRate || 1.0) : `Rate: ${localConfig.voiceRate || 1.0}`}</label>
                                    <input
                                        type="range"
                                        name="voiceRate"
                                        min="0.5"
                                        max="2"
                                        step="0.1"
                                        value={localConfig.voiceRate || 1.0}
                                        onChange={handleChange}
                                        disabled={isGenerating}
                                    />
                                </div>
                            </div>
                            <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                                <label>{t('settings.formattedVolume') ? t('settings.formattedVolume').replace('{value}', localConfig.voiceVolume || 1.0) : `Volume: ${localConfig.voiceVolume || 1.0}`}</label>
                                <input
                                    type="range"
                                    name="voiceVolume"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={localConfig.voiceVolume || 1.0}
                                    onChange={handleChange}
                                    disabled={isGenerating}
                                />
                            </div>
                        </>
                    )}

                    <div className="setting-row" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                        <div className="setting-group">
                            <label>{t('settings.temperature')} ({localConfig.temperature})</label>
                            <input
                                type="range"
                                name="temperature"
                                min="0"
                                max="2"
                                step="0.1"
                                value={localConfig.temperature}
                                onChange={handleChange}
                                disabled={isGenerating}
                            />
                            <small>{t('settings.temperatureDesc')}</small>
                        </div>

                        <div className="setting-group">
                            <label>{t('settings.topP')} ({localConfig.topP})</label>
                            <input
                                type="range"
                                name="topP"
                                min="0"
                                max="1"
                                step="0.05"
                                value={localConfig.topP}
                                onChange={handleChange}
                                disabled={isGenerating}
                            />
                            <small>{t('settings.topPDesc')}</small>
                        </div>
                    </div>

                    <div className="setting-row" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                        <div className="setting-group">
                            <label>{t('settings.topK')}</label>
                            <input
                                type="number"
                                name="topK"
                                value={localConfig.topK}
                                onChange={handleChange}
                                disabled={isGenerating}
                            />
                            <small>{t('settings.topKDesc')}</small>
                        </div>

                        <div className="setting-group">
                            <label>{t('settings.maxTokens')}</label>
                            <input
                                type="number"
                                name="maxTokens"
                                value={localConfig.maxTokens}
                                onChange={handleChange}
                                disabled={isGenerating}
                            />
                            <small>{t('settings.maxTokensDesc')}</small>
                        </div>
                    </div>

                    {/* Performance Settings (Global Only) */}
                    {localModelConfig && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            <hr style={{ margin: '20px 0', borderColor: 'var(--color-glass-border)' }} />
                            <h4 style={{ marginBottom: '12px', color: 'var(--color-accent)' }}>
                                ⚡ Performance Settings
                            </h4>
                            <small style={{ display: 'block', marginBottom: '16px', color: 'var(--color-text-muted)' }}>
                                Changes require page reload to take effect.
                            </small>

                            <div className="setting-group" style={{ marginBottom: '16px' }}>
                                <div className="performance-settings">
                                    <h3 className="section-title">⚡ {t('settings.modelSelection')}</h3>
                                    <p className="section-desc">{t('settings.modelSelectionDesc')}</p>
                                    <div style={{ marginTop: '8px', marginBottom: '14px' }}>
                                        {hasWebGPU ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                ⚡ WebGPU Acceleration: Active (Hardware Offloaded)
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid #eab308', color: '#eab308', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                ⚙️ CPU WASM Mode (Multi-threaded)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                                    <select
                                        value={localLMStudioConfig.enabled ? 'lmstudio' : (localModelConfig?.model_name || 'lfm2_thinking')}
                                        onChange={(e) => {
                                            if (e.target.value === 'lmstudio') return;
                                            handleModelSelectionChange(e);
                                        }}
                                        disabled={isGenerating || localLMStudioConfig.enabled}
                                    >
                                        {localLMStudioConfig.enabled && <option value="lmstudio">🤖 LM Studio (Active)</option>}
                                        <optgroup label="Built-in Models">
                                            <option value="lfm2_thinking">⭐ {t('modelDownload.lfm2ThinkingModel')} (Recommended)</option>
                                            <option value="lfm2_instruct">💬 {t('modelDownload.lfm2InstructModel')}</option>
                                            <option value="qwen25_15b">🌐 {t('modelDownload.qwen25Model')}</option>
                                            <option value="thinking">Liquid LFM 1.2B Thinking (Legacy)</option>
                                            <option value="instruct">Liquid LFM 1.2B Instruct (Legacy)</option>
                                        </optgroup>
                                        <optgroup label="Custom Models" key="custom-models">
                                            {downloadedModels.filter(m => !MODEL_URLS[m.name]).map(m => (
                                                <option key={m.name} value={m.name}>{m.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    {localLMStudioConfig.enabled && (
                                        <div style={{ fontSize: '0.9em', color: 'var(--color-accent)', marginTop: '8px', fontWeight: 'bold' }}>
                                            ✅ LM Studio is Active.
                                        </div>
                                    )}
                                    <small>{t('settings.modelSelectionDesc')}</small>
                                </div>

                                <div className="setting-group" style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                                    <label>{t('settings.threads')} ({localModelConfig.n_threads || 4})</label>
                                    <input
                                        type="range"
                                        name="n_threads"
                                        min="1"
                                        max={navigator.hardwareConcurrency || 16}
                                        step="1"
                                        value={localModelConfig.n_threads || 4}
                                        onChange={handleModelConfigChange}
                                        disabled={isGenerating}
                                    />
                                    <small>{t('settings.threadsDesc')}</small>
                                </div>

                                {/* Model Management Section */}
                                <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <h4 style={{ marginBottom: '12px', color: 'var(--color-accent)', fontSize: '0.9rem' }}>
                                        📦 {t('settings.modelManagement') || 'Model Management'}
                                    </h4>
                                    <div className="model-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {Object.entries(MODEL_URLS).map(([key, url]) => {
                                            const filename = url.split('/').pop().split('?')[0];
                                            const downloadedFile = downloadedModels.find(m => m.name === filename);
                                            const isDownloaded = !!downloadedFile;

                                            return (
                                                <div key={key} style={{
                                                    background: 'rgba(0,0,0,0.2)',
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                            {key === 'lfm2_thinking' ? t('modelDownload.lfm2ThinkingModel') :
                                                             key === 'lfm2_instruct' ? t('modelDownload.lfm2InstructModel') :
                                                             key === 'qwen25_15b' ? t('modelDownload.qwen25Model') :
                                                             key === 'thinking' ? t('modelDownload.lfm2ThinkingModel') + ' (Legacy)' :
                                                             t('modelDownload.lfm2InstructModel') + ' (Legacy)'}
                                                        </div>
                                                        <div style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>
                                                            {isDownloaded ?
                                                                `${(downloadedFile.size / 1024 / 1024).toFixed(1)} MB` :
                                                                'Not downloaded'}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        {isDownloaded ? (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(t('common.delete') + ` ${key}?`)) onDeleteModel(downloadedFile.cacheName || downloadedFile.name);
                                                                    }}
                                                                    className="icon-btn"
                                                                    title={t('common.delete')}
                                                                    style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
                                                                >
                                                                    🗑️
                                                                </button>
                                                                <button
                                                                    onClick={() => onRedownload(key)}
                                                                    className="icon-btn"
                                                                    title={t('settings.redownloadModel')}
                                                                    style={{ color: 'var(--color-accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
                                                                >
                                                                    🔄
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => onRedownload(key)}
                                                                className="secondary-btn"
                                                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                                            >
                                                                ⬇️ Download
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Custom Models List */}
                                        {downloadedModels.filter(m => {
                                            const builtInFilenames = Object.values(MODEL_URLS).map(u => u.split('/').pop().split('?')[0]);
                                            return !builtInFilenames.includes(m.name);
                                        }).map((model) => (
                                            <div key={model.name} style={{
                                                background: 'rgba(0,0,0,0.2)',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginTop: '8px'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{model.name}</div>
                                                    <div style={{ fontSize: '0.8em', color: 'var(--color-text-muted)' }}>
                                                        Custom Model • {(model.size / 1024 / 1024).toFixed(1)} MB
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm(`Delete custom model "${model.name}"?`)) {
                                                                // 1. Remove from history
                                                                // We need the ID, but here we only have name. 
                                                                // onRemoveCustomModel usually expects ID.
                                                                // But we can try to find it in the history list if we had it, or we can just try to delete by name in a loop?
                                                                // Actually, let's just assume we delete the cache and let the user remove the entry if it persists?
                                                                // No, we should clean up.
                                                                // We don't have the customModels list with IDs here (we computed it from downloadedModels).
                                                                // Ideally SettingsModal should receive `customModels` with IDs.
                                                                // But `downloadedModels` items *might* have ID if they came from history merge?
                                                                // Let's check useEngine... useEngine merges: { ...c, size: ... } from history.
                                                                // So `model.id` should be available if it came from history!

                                                                if (model.id && onRemoveCustomModel) {
                                                                    await onRemoveCustomModel(model.id);
                                                                }

                                                                // 2. Remove from Cache API (if it was a file/url)
                                                                try {
                                                                    const cache = await caches.open('wllama');
                                                                    // Try removing by typical URL patterns
                                                                    await cache.delete(`https://custom-model/${model.name}`);
                                                                    if (model.url) await cache.delete(model.url);
                                                                } catch (e) { console.error("Cache clear error", e); }

                                                                // 3. Remove from OPFS (if it was downloaded there)
                                                                if (onDeleteModel) {
                                                                    onDeleteModel(model.name);
                                                                }

                                                                // Reload to refresh lists
                                                                window.location.reload();
                                                            }
                                                        }}
                                                        className="icon-btn"
                                                        title={t('common.delete')}
                                                        style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <small>{t('settings.redownloadDesc')}</small>
                                </div>

                                {/* Custom Model Addition */}
                                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <h4 style={{ marginBottom: '12px', color: 'var(--color-accent)', fontSize: '0.9rem' }}>
                                        ➕ Add Custom Model
                                    </h4>

                                    <div className="setting-group">
                                        <label>Add from URL (.gguf)</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                placeholder="Model Name"
                                                value={customModelName}
                                                onChange={e => setCustomModelName(e.target.value)}
                                                disabled={isAddingModel}
                                            />
                                            <input
                                                placeholder="https://.../model.gguf"
                                                value={customModelUrl}
                                                onChange={e => setCustomModelUrl(e.target.value)}
                                                disabled={isAddingModel}
                                            />
                                            <button
                                                onClick={handleAddCustomModel}
                                                disabled={isAddingModel || !customModelName || !customModelUrl}
                                                className="btn-primary"
                                                style={{ minWidth: '80px' }}
                                            >
                                                {isAddingModel ? 'Adding...' : 'Add'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="setting-group" style={{ marginTop: '10px' }}>
                                        <label>Or Add Local File (.gguf)</label>
                                        <input
                                            type="file"
                                            accept=".gguf"
                                            onChange={handleFileUpload}
                                            disabled={isAddingModel}
                                        />
                                        <small>File will be cached in browser storage. (Warning: Larger files may fail depending on browser limits)</small>
                                    </div>
                                </div>

                                {/* LM Studio Integration */}
                                <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                    <h4 style={{ marginBottom: '12px', color: 'var(--color-accent)', fontSize: '0.9rem' }}>
                                        🤖 LM Studio Integration
                                    </h4>
                                    <div className="setting-group">
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                            <input
                                                type="checkbox"
                                                checked={localLMStudioConfig.enabled}
                                                onChange={(e) => setLocalLMStudioConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                                disabled={isGenerating}
                                            />
                                            <span>Enable LM Studio (or OpenAI compatible)</span>
                                        </label>
                                    </div>
                                    {localLMStudioConfig.enabled && (
                                        <div style={{ paddingLeft: '20px' }}>
                                            <div className="setting-group">
                                                <label>Base URL</label>
                                                <input
                                                    type="text"
                                                    value={localLMStudioConfig.baseUrl}
                                                    onChange={(e) => setLocalLMStudioConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                                                    placeholder="http://localhost:1234/v1"
                                                />
                                            </div>
                                            <div className="setting-group">
                                                <div className="setting-group">
                                                    <label>Model ID {lmStudioModels.length > 0 && <span style={{ fontSize: '0.8em', color: 'green' }}>({lmStudioModels.length} found)</span>}</label>
                                                    {lmStudioModels.length > 0 ? (
                                                        <select
                                                            value={localLMStudioConfig.modelId}
                                                            onChange={(e) => {
                                                                const newModelId = e.target.value;
                                                                setLocalLMStudioConfig(prev => ({ ...prev, modelId: newModelId }));
                                                                // Auto-apply when selected from dropdown
                                                                if (newModelId) {
                                                                    applyLMStudioModel(newModelId);
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Select a model...</option>
                                                            {lmStudioModels.map(m => (
                                                                <option key={m.id} value={m.id}>{m.id}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={localLMStudioConfig.modelId}
                                                            onChange={(e) => setLocalLMStudioConfig(prev => ({ ...prev, modelId: e.target.value }))}
                                                            placeholder="local-model"
                                                        />
                                                    )}
                                                    <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '0.9em' }}>
                                                        {isLoadingLMModels ? 'Fetching models...' : (
                                                            <a href="#" onClick={(e) => { e.preventDefault(); fetchLMStudioModels(); }} style={{ color: 'var(--color-accent)' }}>
                                                                🔄 Refresh Models
                                                            </a>
                                                        )}
                                                        {localLMStudioConfig.modelId && (
                                                            <a href="#" onClick={async (e) => {
                                                                e.preventDefault();
                                                                // Trigger a dry run or explicit load to "switch" the model
                                                                try {
                                                                    const baseUrl = localLMStudioConfig.baseUrl.replace(/\/$/, '');

                                                                    // 1. Try to "Identify currently loaded" - Best effort
                                                                    // Note: Standard API doesn't always return 'loaded' state in /models
                                                                    // We will skip strict identification and assume we need to switch if the user clicked this.

                                                                    // 2. Try to "Eject" current model (heuristic endpoints)
                                                                    try {
                                                                        console.log("Attempting to unload/eject current model...");
                                                                        // Try common unload endpoints
                                                                        await fetch(`${baseUrl}/models/unload`, { method: 'POST', body: JSON.stringify({}) }).catch(() => { });
                                                                        await fetch(`${baseUrl}/internal/eject_model`, { method: 'POST', body: JSON.stringify({}) }).catch(() => { });
                                                                    } catch (e) {
                                                                        // Ignore unload errors, it might not be supported
                                                                        console.log("Unload not supported or failed, proceeding to load.");
                                                                    }

                                                                    // 3. Load new model via Chat Completion (Standard OpenAI way to force load)
                                                                    const url = `${baseUrl}/chat/completions`;
                                                                    // We just send a dummy request with max_tokens 1 to trigger loading
                                                                    const res = await fetch(url, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            model: localLMStudioConfig.modelId,
                                                                            messages: [{ role: 'user', content: 'test' }],
                                                                            max_tokens: 1
                                                                        })
                                                                    });

                                                                    if (res.ok) {
                                                                        alert("Model switch triggered successfully! (Legacy model ejected if possible)");
                                                                        // Also save config
                                                                        if (onSaveLMStudioConfig) onSaveLMStudioConfig(localLMStudioConfig);
                                                                    } else {
                                                                        alert("Failed to trigger load. Check server logs.");
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert("Error: " + err.message);
                                                                }
                                                            }} style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                                                                ⚡ Apply / Load
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="setting-row">
                                <div className="setting-group">
                                    <label>Batch Size (n_batch)</label>
                                    <select
                                        name="n_batch"
                                        value={localModelConfig.n_batch}
                                        onChange={handleModelConfigChange}
                                        disabled={isGenerating}
                                    >
                                        <option value={256}>256</option>
                                        <option value={512}>512 (Default)</option>
                                        <option value={1024}>1024</option>
                                        <option value={2048}>2048</option>
                                    </select>
                                    <small>Larger = faster prompt processing</small>
                                </div>

                                <div className="setting-group">
                                    <label>Flash Attention</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        <input
                                            type="checkbox"
                                            name="flash_attn"
                                            checked={localModelConfig.flash_attn}
                                            onChange={handleModelConfigChange}
                                            disabled={isGenerating}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                        <span>Enable Flash Attention</span>
                                    </div>
                                    <small>Optimize attention computation</small>
                                </div>
                            </div>

                            <div className="setting-row">
                                <div className="setting-group">
                                    <label>KV Cache Type (K)</label>
                                    <select
                                        name="cache_type_k"
                                        value={localModelConfig.cache_type_k}
                                        onChange={handleModelConfigChange}
                                        disabled={isGenerating}
                                    >
                                        <option value="f32">f32 (Full)</option>
                                        <option value="f16">f16 (Default)</option>
                                        <option value="q8_0">q8_0 (Quantized)</option>
                                        <option value="q4_0">q4_0 (Aggressive)</option>
                                    </select>
                                    <small>Lower = faster, less memory</small>
                                </div>

                                <div className="setting-group">
                                    <label>KV Cache Type (V)</label>
                                    <select
                                        name="cache_type_v"
                                        value={localModelConfig.cache_type_v}
                                        onChange={handleModelConfigChange}
                                        disabled={isGenerating}
                                    >
                                        <option value="f32">f32 (Full)</option>
                                        <option value="f16">f16 (Default)</option>
                                        <option value="q8_0">q8_0 (Quantized)</option>
                                        <option value="q4_0">q4_0 (Aggressive)</option>
                                    </select>
                                    <small>Lower = faster, less memory</small>
                                </div>
                            </div>


                            {/* Debug Section */}
                            <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                                <h4 style={{ marginBottom: '12px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    🔧 Debug & Danger Zone
                                </h4>

                                <div className="setting-group">
                                    <label>{t('settings.resetData')}</label>
                                    <button
                                        onClick={async () => {
                                            if (confirm(t('settings.resetDataDesc') + '\n\n' + t('chat.deleteConfirm'))) {
                                                const { clearAllData } = await import('../services/history');
                                                await clearAllData();
                                                window.location.reload();
                                            }
                                        }}
                                        className="action-btn-danger"
                                        style={{ borderColor: 'rgba(239, 68, 68, 0.5)', background: 'transparent' }}
                                    >
                                        💣 {t('settings.resetData')}
                                    </button>
                                    <small>{t('settings.resetDataDesc')}</small>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap-reverse', gap: '10px' }}>
                    {/* Left side: Defaults Checkbox */}
                    <div className="defaults-check" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            id="saveAsDefault"
                            checked={saveAsDefault}
                            onChange={(e) => setSaveAsDefault(e.target.checked)}
                            style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                        />
                        <label htmlFor="saveAsDefault" style={{ marginBottom: 0, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            {t('settings.saveAsDefault') || 'Save as new Default for future chats'}
                        </label>
                    </div>

                    {/* Right side: Actions */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn-primary"
                            disabled={isGenerating}
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div >
        </div >
    );

}
