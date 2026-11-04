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
    onAddCustomModel,
    onRemoveCustomModel,
    lmStudioConfig = { enabled: false, baseUrl: 'http://localhost:1234/v1', modelId: '' },
    onSaveLMStudioConfig
}) {
    if (!isOpen) return null;

    const isGlobal = !!modelConfig;
    const [activeTab, setActiveTab] = React.useState(isGlobal ? 'hardware' : 'generation');

    const [localConfig, setLocalConfig] = React.useState({
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
    });

    const [localModelConfig, setLocalModelConfig] = React.useState(modelConfig);
    const [localLMStudioConfig, setLocalLMStudioConfig] = React.useState(lmStudioConfig);
    const [customModelUrl, setCustomModelUrl] = React.useState('');
    const [customModelName, setCustomModelName] = React.useState('');
    const [isAddingModel, setIsAddingModel] = React.useState(false);
    const [availableVoices, setAvailableVoices] = React.useState([]);
    const [lmStudioModels, setLmStudioModels] = React.useState([]);
    const [isLoadingLMModels, setIsLoadingLMModels] = React.useState(false);
    const [appliedNotice, setAppliedNotice] = React.useState(false);
    const [saveAsDefault, setSaveAsDefault] = React.useState(false);

    // Hardware WebGPU detector
    const [gpuInfo, setGpuInfo] = React.useState({
        vendor: '',
        architecture: '',
        description: '',
        loaded: false
    });

    React.useEffect(() => {
        let isMounted = true;
        if (typeof navigator !== 'undefined' && navigator.gpu) {
            navigator.gpu.requestAdapter().then(async (adapter) => {
                if (!isMounted || !adapter) return;
                let info = adapter.info;
                if (!info && adapter.requestAdapterInfo) {
                    try {
                        info = await adapter.requestAdapterInfo();
                    } catch (e) { }
                }
                if (info) {
                    setGpuInfo({
                        vendor: info.vendor || '',
                        architecture: info.architecture || '',
                        description: info.description || info.device || '',
                        loaded: true
                    });
                }
            }).catch(() => {});
        }
        return () => { isMounted = false; };
    }, []);

    // Speech synthesis voices
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

    // Reset local config when modal opens
    const prevIsOpenRef = React.useRef(false);
    React.useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            setSaveAsDefault(false);
            setLocalConfig({
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
            });
            if (modelConfig) {
                setLocalModelConfig({
                    ...modelConfig,
                    model_name: modelConfig.model_name || 'lfm2_thinking'
                });
            }
            if (lmStudioConfig) {
                setLocalLMStudioConfig(lmStudioConfig);
            }
            if (onListModels) {
                onListModels();
            }
            setActiveTab(isGlobal ? 'hardware' : 'generation');
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen]);

    // LM Studio models fetching
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
            const url = `${baseUrl}/chat/completions`;
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
                const updatedConfig = { ...localLMStudioConfig, modelId };
                if (onSaveLMStudioConfig) onSaveLMStudioConfig(updatedConfig);
                alert(getLanguage() === 'ja' ? 'LM Studioのモデルを適用しました！' : 'LM Studio model applied!');
            } else {
                alert(getLanguage() === 'ja' ? 'モデル切り替えに失敗しました。サーバーのログをご確認ください。' : 'Failed to switch model. Check server logs.');
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

    const handleModelSelectionChange = (name) => {
        if (isGenerating) return;
        let url = MODEL_URLS[name];
        if (!url) {
            const customModel = downloadedModels.find(m => m.name === name);
            if (customModel) {
                url = customModel.url || customModel.originalURL || name;
            }
        }
        setLocalModelConfig(prev => ({
            ...prev,
            model_name: name,
            model_url: url
        }));
    };

    const handleApplyGpuRecommended = () => {
        if (!localModelConfig) return;
        setLocalModelConfig(prev => ({
            ...prev,
            n_gpu_layers: 99,
            cache_type_k: 'f16',
            cache_type_v: 'f16',
            n_batch: 256,
            flash_attn: false
        }));
        setAppliedNotice(true);
        setTimeout(() => setAppliedNotice(false), 4000);
    };

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

        if (onSaveLMStudioConfig) await onSaveLMStudioConfig(localLMStudioConfig);
        if (onSave) onSave(localConfig, saveAsDefault);

        setIsAddingModel(true);
        try {
            await onAddCustomModel({
                name: customModelName,
                url: customModelUrl,
                type: 'url'
            });

            if (onSaveModelConfig) {
                await onSaveModelConfig({
                    model_name: customModelName,
                    model_url: customModelUrl
                });
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

            if (onSaveModelConfig) {
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

    const testSpeechVoice = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const testText = getLanguage() === 'ja'
            ? 'こんにちは！これはローカルAIの音声テストです。'
            : 'Hello! This is a test of the local AI speech output.';
        const utterance = new SpeechSynthesisUtterance(testText);
        if (localConfig.voiceName) {
            const voice = availableVoices.find(v => v.name === localConfig.voiceName);
            if (voice) utterance.voice = voice;
        }
        utterance.pitch = localConfig.voicePitch || 1.0;
        utterance.rate = localConfig.voiceRate || 1.0;
        utterance.volume = localConfig.voiceVolume || 1.0;
        window.speechSynthesis.speak(utterance);
    };

    const promptPresets = [
        { label: getLanguage() === 'ja' ? '標準アシスタント' : 'Default Assistant', prompt: getLanguage() === 'ja' ? 'あなたは親切で知的なAIアシスタントです。ユーザーの質問に日本語で的確かつ簡潔に答えてください。' : 'You are a helpful and intelligent AI assistant.' },
        { label: getLanguage() === 'ja' ? 'プログラミング特化' : 'Coding Expert', prompt: getLanguage() === 'ja' ? 'あなたは熟練のシニアエンジニアです。クリーンで実用的なコード、解説、最適な設計案を提示してください。' : 'You are an expert senior software engineer. Provide clean, secure, and idiomatic code with clear explanations.' },
        { label: getLanguage() === 'ja' ? '論理的・客観的' : 'Logical & Analytical', prompt: getLanguage() === 'ja' ? 'あなたは論理的思考に長けた専門家です。事実と推論を区別し、前提を整理して論理的な結論を導いてください。' : 'You are an analytical thinker. Break problems into structured steps and draw objective, reasoned conclusions.' },
        { label: getLanguage() === 'ja' ? '親しみやすい雑談' : 'Casual Friendly', prompt: getLanguage() === 'ja' ? 'あなたはフレンドリーで親切な会話パートナーです。親身で自然な口調で楽しく会話してください。' : 'You are a friendly and enthusiastic conversational partner.' }
    ];

    const currentModelName = localModelConfig?.model_name || 'lfm2_thinking';

    return (
        <div className="modal-overlay">
            <div className="modal-content settings-modal-dialog glass">
                {/* Header */}
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚙️</span>
                        <span>{title}</span>
                    </h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                {/* Tab Bar */}
                <div className="settings-tab-bar">
                    {isGlobal && (
                        <button
                            type="button"
                            className={`settings-tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
                            onClick={() => setActiveTab('hardware')}
                        >
                            <span>⚡</span>
                            <span>{t('settings.tabHardware') || 'Hardware & Models'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className={`settings-tab-btn ${activeTab === 'generation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('generation')}
                    >
                        <span>💬</span>
                        <span>{t('settings.tabGeneration') || 'AI Parameters'}</span>
                    </button>
                    <button
                        type="button"
                        className={`settings-tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
                        onClick={() => setActiveTab('voice')}
                    >
                        <span>🔊</span>
                        <span>{t('settings.tabVoice') || 'Voice & UI'}</span>
                    </button>
                    {isGlobal && (
                        <>
                            <button
                                type="button"
                                className={`settings-tab-btn ${activeTab === 'external' ? 'active' : ''}`}
                                onClick={() => setActiveTab('external')}
                            >
                                <span>🔌</span>
                                <span>{t('settings.tabExternal') || 'External (LM Studio)'}</span>
                            </button>
                            <button
                                type="button"
                                className={`settings-tab-btn ${activeTab === 'data' ? 'active' : ''}`}
                                onClick={() => setActiveTab('data')}
                            >
                                <span>🗑️</span>
                                <span>{t('settings.tabData') || 'Storage & Reset'}</span>
                            </button>
                        </>
                    )}
                </div>

                {/* Body */}
                <div className="modal-body">
                    {isGenerating && (
                        <div className="warning-banner" style={{ marginBottom: '16px' }}>
                            ⚠️ {getLanguage() === 'ja' ? 'AI生成中は設定を変更できません。生成完了までお待ちください。' : 'Settings cannot be changed while AI generation is in progress.'}
                        </div>
                    )}

                    {appliedNotice && (
                        <div style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            border: '1px solid #22c55e',
                            color: '#86efac',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            ✅ {t('settings.recommendedApplied')}
                        </div>
                    )}

                    {/* TAB 1: HARDWARE & MODELS */}
                    {isGlobal && activeTab === 'hardware' && localModelConfig && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            {/* Prominent Hardware Status Card */}
                            <div className={`hw-status-card ${hasWebGPU ? 'gpu-active' : 'cpu-mode'}`}>
                                <div className="hw-status-header">
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                            {t('settings.hwStatusTitle')}
                                        </div>
                                        <div className={`hw-badge-status ${hasWebGPU ? 'gpu' : 'cpu'}`}>
                                            <span className="hw-status-pulse"></span>
                                            {hasWebGPU ? t('settings.gpuActiveTitle') : t('settings.cpuActiveTitle')}
                                        </div>
                                    </div>
                                    {hasWebGPU && (
                                        <button
                                            type="button"
                                            className="btn-apply-gpu-recom"
                                            onClick={handleApplyGpuRecommended}
                                            title={t('settings.applyGpuRecommendedDesc')}
                                        >
                                            {t('settings.applyGpuRecommended')}
                                        </button>
                                    )}
                                </div>

                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                                    {hasWebGPU ? t('settings.gpuActiveDesc') : t('settings.cpuActiveDesc')}
                                </p>

                                <div className="hw-metrics-grid">
                                    <div className="hw-metric-item">
                                        <div className="hw-metric-label">{t('settings.gpuDevice')}</div>
                                        <div className="hw-metric-value" title={gpuInfo.description || (gpuInfo.vendor ? `${gpuInfo.vendor} (${gpuInfo.architecture})` : 'WebGPU Adapter')}>
                                            {hasWebGPU
                                                ? (gpuInfo.vendor ? `${gpuInfo.vendor.toUpperCase()} ${gpuInfo.architecture ? `(${gpuInfo.architecture})` : ''}` : 'Hardware GPU')
                                                : 'None (CPU fallback)'}
                                        </div>
                                    </div>
                                    <div className="hw-metric-item">
                                        <div className="hw-metric-label">{t('settings.gpuLayers')}</div>
                                        <div className="hw-metric-value highlight">
                                            {localModelConfig.n_gpu_layers > 0
                                                ? `${localModelConfig.n_gpu_layers} layers (${t('settings.allLayers')})`
                                                : '0 (CPU only)'}
                                        </div>
                                    </div>
                                    <div className="hw-metric-item">
                                        <div className="hw-metric-label">{t('settings.kvCacheMode')}</div>
                                        <div className="hw-metric-value highlight">
                                            {localModelConfig.cache_type_k || 'f16'} (GPU Direct)
                                        </div>
                                    </div>
                                    <div className="hw-metric-item">
                                        <div className="hw-metric-label">{t('settings.batchSize')}</div>
                                        <div className="hw-metric-value">
                                            {localModelConfig.n_batch || 256}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Model Selection */}
                            <div className="setting-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span>📦</span>
                                    <span>{t('settings.modelSelection')}</span>
                                </label>
                                <small style={{ display: 'block', marginBottom: '14px', color: 'var(--color-text-muted)' }}>
                                    {t('settings.modelSelectionDesc')}
                                </small>

                                <div className="model-cards-container">
                                    {/* Built-in Model 1: LFM2.5 Thinking */}
                                    <div
                                        className={`model-select-card ${currentModelName === 'lfm2_thinking' ? 'selected' : ''}`}
                                        onClick={() => handleModelSelectionChange('lfm2_thinking')}
                                    >
                                        <div className="model-select-card-info">
                                            <div className="model-select-card-title">
                                                <span>⭐ {t('modelDownload.lfm2ThinkingModel')}</span>
                                                {currentModelName === 'lfm2_thinking' && <span className="badge-active-model">{t('settings.activeModelBadge')}</span>}
                                            </div>
                                            <div className="model-select-card-desc">
                                                {t('modelDownload.lfm2ThinkingDesc')} • ~0.7 GB
                                            </div>
                                        </div>
                                        <input
                                            type="radio"
                                            name="active_model"
                                            checked={currentModelName === 'lfm2_thinking'}
                                            onChange={() => handleModelSelectionChange('lfm2_thinking')}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                    </div>

                                    {/* Built-in Model 2: LFM2.5 Instruct */}
                                    <div
                                        className={`model-select-card ${currentModelName === 'lfm2_instruct' ? 'selected' : ''}`}
                                        onClick={() => handleModelSelectionChange('lfm2_instruct')}
                                    >
                                        <div className="model-select-card-info">
                                            <div className="model-select-card-title">
                                                <span>💬 {t('modelDownload.lfm2InstructModel')}</span>
                                                {currentModelName === 'lfm2_instruct' && <span className="badge-active-model">{t('settings.activeModelBadge')}</span>}
                                            </div>
                                            <div className="model-select-card-desc">
                                                {t('modelDownload.lfm2InstructDesc')} • ~0.7 GB
                                            </div>
                                        </div>
                                        <input
                                            type="radio"
                                            name="active_model"
                                            checked={currentModelName === 'lfm2_instruct'}
                                            onChange={() => handleModelSelectionChange('lfm2_instruct')}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                    </div>

                                    {/* Built-in Model 3: Qwen 2.5 1.5B */}
                                    <div
                                        className={`model-select-card ${currentModelName === 'qwen25_15b' ? 'selected' : ''}`}
                                        onClick={() => handleModelSelectionChange('qwen25_15b')}
                                    >
                                        <div className="model-select-card-info">
                                            <div className="model-select-card-title">
                                                <span>🌐 {t('modelDownload.qwen25Model')}</span>
                                                {currentModelName === 'qwen25_15b' && <span className="badge-active-model">{t('settings.activeModelBadge')}</span>}
                                            </div>
                                            <div className="model-select-card-desc">
                                                {t('modelDownload.qwen25Desc')} • ~1.1 GB
                                            </div>
                                        </div>
                                        <input
                                            type="radio"
                                            name="active_model"
                                            checked={currentModelName === 'qwen25_15b'}
                                            onChange={() => handleModelSelectionChange('qwen25_15b')}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                    </div>

                                    {/* Custom Models */}
                                    {downloadedModels.filter(m => !MODEL_URLS[m.name]).map(m => (
                                        <div
                                            key={m.name}
                                            className={`model-select-card ${currentModelName === m.name ? 'selected' : ''}`}
                                            onClick={() => handleModelSelectionChange(m.name)}
                                        >
                                            <div className="model-select-card-info">
                                                <div className="model-select-card-title">
                                                    <span>📁 {m.name}</span>
                                                    {currentModelName === m.name && <span className="badge-active-model">{t('settings.activeModelBadge')}</span>}
                                                </div>
                                                <div className="model-select-card-desc">
                                                    Custom Model • {(m.size / 1024 / 1024).toFixed(1)} MB
                                                </div>
                                            </div>
                                            <input
                                                type="radio"
                                                name="active_model"
                                                checked={currentModelName === m.name}
                                                onChange={() => handleModelSelectionChange(m.name)}
                                                style={{ width: 'auto', margin: 0 }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Downloaded Models Storage Manager */}
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>💾</span>
                                    <span>{t('settings.modelManagement')}</span>
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {Object.entries(MODEL_URLS).map(([key, url]) => {
                                        const filename = url.split('/').pop().split('?')[0];
                                        const downloadedFile = downloadedModels.find(m => m.name === filename);
                                        const isDownloaded = !!downloadedFile;

                                        return (
                                            <div key={key} style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                                                        {key === 'lfm2_thinking' ? t('modelDownload.lfm2ThinkingModel') :
                                                         key === 'lfm2_instruct' ? t('modelDownload.lfm2InstructModel') :
                                                         key === 'qwen25_15b' ? t('modelDownload.qwen25Model') :
                                                         key === 'thinking' ? 'LFM 1.2B Thinking (Legacy)' :
                                                         'LFM 1.2B Instruct (Legacy)'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: isDownloaded ? '#4ade80' : 'var(--color-text-muted)' }}>
                                                        {isDownloaded ? `✓ ${getLanguage() === 'ja' ? 'ダウンロード済み' : 'Downloaded'} (${(downloadedFile.size / 1024 / 1024).toFixed(1)} MB)` : (getLanguage() === 'ja' ? '未ダウンロード' : 'Not downloaded')}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {isDownloaded ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (confirm(t('common.delete') + ` ${key}?`)) onDeleteModel(downloadedFile.cacheName || downloadedFile.name);
                                                                }}
                                                                className="icon-btn"
                                                                title={t('common.delete')}
                                                                style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
                                                            >
                                                                🗑️
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => onRedownload(key)}
                                                                className="icon-btn"
                                                                title={t('settings.redownloadModel')}
                                                                style={{ color: 'var(--color-accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
                                                            >
                                                                🔄
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onRedownload(key)}
                                                            className="secondary-btn"
                                                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            ⬇️ Download
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Custom Models in storage */}
                                    {downloadedModels.filter(m => {
                                        const builtInFilenames = Object.values(MODEL_URLS).map(u => u.split('/').pop().split('?')[0]);
                                        return !builtInFilenames.includes(m.name);
                                    }).map((model) => (
                                        <div key={model.name} style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{model.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                                                    Custom Model • {(model.size / 1024 / 1024).toFixed(1)} MB
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (confirm(`Delete custom model "${model.name}"?`)) {
                                                        if (model.id && onRemoveCustomModel) await onRemoveCustomModel(model.id);
                                                        try {
                                                            const cache = await caches.open('wllama');
                                                            await cache.delete(`https://custom-model/${model.name}`);
                                                            if (model.url) await cache.delete(model.url);
                                                        } catch (e) { }
                                                        if (onDeleteModel) onDeleteModel(model.name);
                                                        window.location.reload();
                                                    }
                                                }}
                                                className="icon-btn"
                                                title={t('common.delete')}
                                                style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Add Custom Model */}
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>➕</span>
                                    <span>{t('settings.addModelTitle')}</span>
                                </h4>
                                <div className="setting-group" style={{ marginBottom: '12px' }}>
                                    <label style={{ fontSize: '0.85rem' }}>{t('settings.addModelUrl')}</label>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <input
                                            placeholder="Model Name (e.g. MyModel)"
                                            value={customModelName}
                                            onChange={e => setCustomModelName(e.target.value)}
                                            disabled={isAddingModel}
                                            style={{ flex: '1 1 140px' }}
                                        />
                                        <input
                                            placeholder="https://.../model.gguf"
                                            value={customModelUrl}
                                            onChange={e => setCustomModelUrl(e.target.value)}
                                            disabled={isAddingModel}
                                            style={{ flex: '2 1 240px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCustomModel}
                                            disabled={isAddingModel || !customModelName || !customModelUrl}
                                            className="btn-primary"
                                            style={{ minWidth: '80px' }}
                                        >
                                            {isAddingModel ? 'Adding...' : 'Add'}
                                        </button>
                                    </div>
                                </div>

                                <div className="setting-group">
                                    <label style={{ fontSize: '0.85rem' }}>{t('settings.addModelFile')}</label>
                                    <input
                                        type="file"
                                        accept=".gguf"
                                        onChange={handleFileUpload}
                                        disabled={isAddingModel}
                                    />
                                </div>
                            </div>

                            {/* Advanced Hardware Tuning Accordion */}
                            <details style={{ background: 'rgba(0,0,0,0.2)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    ⚙️ {t('settings.advancedHardware')}
                                </summary>
                                <div style={{ marginTop: '16px' }}>
                                    <div className="setting-row">
                                        <div className="setting-group">
                                            <label>{t('settings.gpuLayers')} ({localModelConfig.n_gpu_layers ?? 99})</label>
                                            <input
                                                type="range"
                                                name="n_gpu_layers"
                                                min="0"
                                                max="99"
                                                step="1"
                                                value={localModelConfig.n_gpu_layers ?? 99}
                                                onChange={handleModelConfigChange}
                                                disabled={isGenerating}
                                            />
                                            <small>{getLanguage() === 'ja' ? '99 = 全層GPU実行（推奨）。0 = CPUのみ。' : '99 = Full GPU offload (recommended). 0 = CPU only.'}</small>
                                        </div>

                                        <div className="setting-group">
                                            <label>{t('settings.threads')} ({localModelConfig.n_threads || 4})</label>
                                            <input
                                                type="range"
                                                name="n_threads"
                                                min="1"
                                                max={typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 16) : 16}
                                                step="1"
                                                value={localModelConfig.n_threads || 4}
                                                onChange={handleModelConfigChange}
                                                disabled={isGenerating}
                                            />
                                            <small>{t('settings.threadsDesc')}</small>
                                        </div>
                                    </div>

                                    <div className="setting-row">
                                        <div className="setting-group">
                                            <label>{t('settings.batchSize')}</label>
                                            <select
                                                name="n_batch"
                                                value={localModelConfig.n_batch || 256}
                                                onChange={handleModelConfigChange}
                                                disabled={isGenerating}
                                            >
                                                <option value={256}>256 (WebGPU Optimal)</option>
                                                <option value={512}>512</option>
                                                <option value={1024}>1024</option>
                                            </select>
                                            <small>{getLanguage() === 'ja' ? 'プロンプト評価時のバッチサイズ' : 'Prompt evaluation batch size'}</small>
                                        </div>

                                        <div className="setting-group">
                                            <label>Flash Attention</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                <input
                                                    type="checkbox"
                                                    name="flash_attn"
                                                    checked={localModelConfig.flash_attn || false}
                                                    onChange={handleModelConfigChange}
                                                    disabled={isGenerating}
                                                    style={{ width: 'auto', margin: 0 }}
                                                />
                                                <span>Enable Flash Attention</span>
                                            </div>
                                            <small>{getLanguage() === 'ja' ? '対応モデルで注意機構を最適化' : 'Attention optimization for supported models'}</small>
                                        </div>
                                    </div>

                                    <div className="setting-row">
                                        <div className="setting-group">
                                            <label>KV Cache Type (K)</label>
                                            <select
                                                name="cache_type_k"
                                                value={localModelConfig.cache_type_k || 'f16'}
                                                onChange={handleModelConfigChange}
                                                disabled={isGenerating}
                                            >
                                                <option value="f16">f16 (WebGPU Native / Peak Speed)</option>
                                                <option value="q8_0">q8_0 (Quantized)</option>
                                                <option value="q4_0">q4_0 (Aggressive)</option>
                                                <option value="f32">f32 (Full 32-bit)</option>
                                            </select>
                                        </div>
                                        <div className="setting-group">
                                            <label>KV Cache Type (V)</label>
                                            <select
                                                name="cache_type_v"
                                                value={localModelConfig.cache_type_v || 'f16'}
                                                onChange={handleModelConfigChange}
                                                disabled={isGenerating}
                                            >
                                                <option value="f16">f16 (WebGPU Native / Peak Speed)</option>
                                                <option value="q8_0">q8_0 (Quantized)</option>
                                                <option value="q4_0">q4_0 (Aggressive)</option>
                                                <option value="f32">f32 (Full 32-bit)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    )}

                    {/* TAB 2: GENERATION PARAMETERS */}
                    {activeTab === 'generation' && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            {/* System Prompt */}
                            <div className="setting-group" style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🧠</span>
                                    <span>{t('settings.systemPrompt')}</span>
                                </label>
                                <textarea
                                    name="systemPrompt"
                                    value={localConfig.systemPrompt}
                                    onChange={handleChange}
                                    rows={4}
                                    placeholder={t('settings.systemPromptPlaceholder')}
                                    disabled={isGenerating}
                                    style={{ marginTop: '6px' }}
                                />
                                <small style={{ display: 'block', margin: '4px 0 8px 0' }}>{t('settings.systemPromptDesc')}</small>

                                {/* System Prompt Presets */}
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                                    {getLanguage() === 'ja' ? 'プリセットから適用:' : 'Apply Preset:'}
                                </div>
                                <div className="prompt-presets-bar">
                                    {promptPresets.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="prompt-preset-chip"
                                            onClick={() => setLocalConfig(prev => ({ ...prev, systemPrompt: preset.prompt }))}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                    {localConfig.systemPrompt && (
                                        <button
                                            type="button"
                                            className="prompt-preset-chip"
                                            style={{ color: '#ef4444' }}
                                            onClick={() => setLocalConfig(prev => ({ ...prev, systemPrompt: '' }))}
                                        >
                                            {getLanguage() === 'ja' ? 'クリア' : 'Clear'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Temperature with intuitive guidance */}
                            <div className="setting-group" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                        {t('settings.temperature')} ({localConfig.temperature})
                                    </label>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: localConfig.temperature < 0.4 ? '#38bdf8' : (localConfig.temperature <= 0.8 ? '#4ade80' : '#f59e0b'),
                                        fontWeight: 600
                                    }}>
                                        {localConfig.temperature < 0.4
                                            ? (getLanguage() === 'ja' ? '厳格・論理的 (コード・事実確認)' : 'Strict & Precise (Code/Facts)')
                                            : (localConfig.temperature <= 0.8
                                                ? (getLanguage() === 'ja' ? 'バランス (推奨・日常会話)' : 'Balanced (Recommended)')
                                                : (getLanguage() === 'ja' ? '創造的・自由 (アイデア出し)' : 'Creative & Expressive'))}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    name="temperature"
                                    min="0"
                                    max="2"
                                    step="0.05"
                                    value={localConfig.temperature}
                                    onChange={handleChange}
                                    disabled={isGenerating}
                                    style={{ marginTop: '8px' }}
                                />
                                <small>{t('settings.temperatureDesc')}</small>
                            </div>

                            <div className="setting-row">
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

                                <div className="setting-group">
                                    <label>{t('settings.topK')} ({localConfig.topK})</label>
                                    <input
                                        type="number"
                                        name="topK"
                                        value={localConfig.topK}
                                        onChange={handleChange}
                                        disabled={isGenerating}
                                    />
                                    <small>{t('settings.topKDesc')}</small>
                                </div>
                            </div>

                            <div className="setting-group" style={{ marginBottom: '20px' }}>
                                <label>{t('settings.maxTokens')} ({localConfig.maxTokens})</label>
                                <input
                                    type="number"
                                    name="maxTokens"
                                    step="128"
                                    min="256"
                                    max="4096"
                                    value={localConfig.maxTokens}
                                    onChange={handleChange}
                                    disabled={isGenerating}
                                />
                                <small>{t('settings.maxTokensDesc')}</small>
                            </div>

                            <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => {
                                    setLocalConfig(prev => ({
                                        ...prev,
                                        systemPrompt: '',
                                        temperature: 0.7,
                                        topP: 0.9,
                                        topK: 40,
                                        maxTokens: 2000
                                    }));
                                }}
                                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                            >
                                🔄 {t('settings.resetParams')}
                            </button>
                        </div>
                    )}

                    {/* TAB 3: VOICE & UI LANGUAGE */}
                    {activeTab === 'voice' && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            {/* Interface Language */}
                            <div className="setting-group" style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '0.95rem', fontWeight: 600 }}>🌐 {t('settings.language')}</label>
                                <select
                                    value={getLanguage()}
                                    onChange={async (e) => {
                                        const newLang = e.target.value;
                                        setLanguage(newLang);
                                        await setUserLanguage(newLang);
                                        window.location.reload();
                                    }}
                                    disabled={isGenerating}
                                    style={{ marginTop: '6px' }}
                                >
                                    <option value="ja">日本語 (Japanese)</option>
                                    <option value="en">English</option>
                                </select>
                                <small>{t('settings.languageDesc')}</small>
                            </div>

                            {/* Voice Settings */}
                            {typeof window !== 'undefined' && window.speechSynthesis && (
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-accent)' }}>
                                            🔊 {t('settings.voiceSettings')}
                                        </h4>
                                        <button
                                            type="button"
                                            className="secondary-btn"
                                            onClick={testSpeechVoice}
                                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                        >
                                            ▶️ {getLanguage() === 'ja' ? '声をテスト試聴' : 'Test Voice'}
                                        </button>
                                    </div>

                                    <div className="setting-row">
                                        <div className="setting-group">
                                            <label>{t('settings.recognitionLanguage')}</label>
                                            <select
                                                name="recognitionLanguage"
                                                value={localConfig.recognitionLanguage || 'ja-JP'}
                                                onChange={handleChange}
                                                disabled={isGenerating}
                                            >
                                                <option value="ja-JP">日本語 (ja-JP)</option>
                                                <option value="en-US">English (en-US)</option>
                                            </select>
                                        </div>

                                        <div className="setting-group">
                                            <label>{t('settings.voiceName')}</label>
                                            <select
                                                name="voiceName"
                                                value={localConfig.voiceName || ''}
                                                onChange={handleChange}
                                                disabled={isGenerating}
                                            >
                                                <option value="">Default OS Voice</option>
                                                {availableVoices.map((voice) => (
                                                    <option key={voice.name} value={voice.name}>
                                                        {voice.name} ({voice.lang})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="setting-row">
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

                                    <div className="setting-group" style={{ marginTop: '10px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                            <input
                                                type="checkbox"
                                                name="realTimeSpeech"
                                                checked={localConfig.realTimeSpeech || false}
                                                onChange={(e) => setLocalConfig(prev => ({ ...prev, realTimeSpeech: e.target.checked }))}
                                                style={{ width: 'auto', margin: 0 }}
                                            />
                                            <span>{t('settings.realTimeSpeech')}</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: EXTERNAL (LM STUDIO) */}
                    {isGlobal && activeTab === 'external' && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>🤖</span>
                                    <span>LM Studio / Local Server Integration</span>
                                </h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
                                    {getLanguage() === 'ja'
                                        ? 'LM StudioやOllamaなどのローカルOpenAI互換サーバーに接続し、PC上の別モデルを使用できます。'
                                        : 'Connect to LM Studio or Ollama (OpenAI compatible server) to use models running on your local machine.'}
                                </p>

                                <div className="setting-group" style={{ marginBottom: '14px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={localLMStudioConfig.enabled}
                                            onChange={(e) => setLocalLMStudioConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                            disabled={isGenerating}
                                            style={{ width: 'auto', margin: 0 }}
                                        />
                                        <span style={{ fontWeight: 600 }}>
                                            {getLanguage() === 'ja' ? 'LM Studio連携を有効化する' : 'Enable LM Studio (OpenAI Compatible)'}
                                        </span>
                                    </label>
                                </div>

                                {localLMStudioConfig.enabled && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                                            <label>Model ID {lmStudioModels.length > 0 && <span style={{ color: '#4ade80' }}>({lmStudioModels.length} models found)</span>}</label>
                                            {lmStudioModels.length > 0 ? (
                                                <select
                                                    value={localLMStudioConfig.modelId}
                                                    onChange={(e) => {
                                                        const newModelId = e.target.value;
                                                        setLocalLMStudioConfig(prev => ({ ...prev, modelId: newModelId }));
                                                        if (newModelId) applyLMStudioModel(newModelId);
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
                                        </div>

                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                type="button"
                                                className="secondary-btn"
                                                onClick={fetchLMStudioModels}
                                                disabled={isLoadingLMModels}
                                                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                                            >
                                                🔄 {isLoadingLMModels ? 'Connecting...' : (getLanguage() === 'ja' ? '接続テスト & モデル一覧取得' : 'Test & Fetch Models')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 5: STORAGE & RESET */}
                    {isGlobal && activeTab === 'data' && (
                        <div style={{ opacity: isGenerating ? 0.6 : 1, pointerEvents: isGenerating ? 'none' : 'auto' }}>
                            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>⚠️</span>
                                    <span>{t('settings.resetData')} (Danger Zone)</span>
                                </h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
                                    {t('settings.resetDataDesc')}
                                </p>
                                <button
                                    type="button"
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
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap-reverse', gap: '10px' }}>
                    <div className="defaults-check" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isGlobal && (
                            <>
                                <input
                                    type="checkbox"
                                    id="saveAsDefault"
                                    checked={saveAsDefault}
                                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                                />
                                <label htmlFor="saveAsDefault" style={{ marginBottom: 0, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    {t('settings.saveAsDefault')}
                                </label>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="btn-primary"
                            disabled={isGenerating}
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
