import { useState, useEffect } from 'react';
import { t } from '../../utils/i18n';
import { MODEL_URLS } from '../../services/history';

const ModelDownload = ({ onContinue, onDownloadModel }) => {
    const [selectedModels, setSelectedModels] = useState({
        lfm2_thinking: true,
        qwen25_15b: false
    });

    const [downloadStatus, setDownloadStatus] = useState({
        lfm2_thinking: 'idle',
        qwen25_15b: 'idle'
    });

    const [downloadProgress, setDownloadProgress] = useState({
        lfm2_thinking: { loaded: 0, total: 0, percentage: 0 },
        qwen25_15b: { loaded: 0, total: 0, percentage: 0 }
    });

    const [errorMessage, setErrorMessage] = useState('');

    // Check if models are already cached on mount via worker (avoid main-thread OPFS lock conflicts)
    useEffect(() => {
        let isMounted = true;
        const checkCacheWorker = new Worker(
            new URL('../../engine/wllama.worker.js', import.meta.url),
            { type: 'module' }
        );

        checkCacheWorker.onmessage = (e) => {
            if (!isMounted) {
                checkCacheWorker.terminate();
                return;
            }

            if (e.data.type === 'cache_status') {
                const cachedUrls = e.data.cachedUrls || [];
                console.log('[ModelDownload] Cached URLs from worker:', cachedUrls);
                let lfmInCache = false;

                for (const [modelType, modelUrl] of Object.entries(MODEL_URLS)) {
                    if (cachedUrls.some(url => url.includes(modelUrl) || modelUrl.includes(url))) {
                        setDownloadStatus(prev => ({ ...prev, [modelType]: 'downloaded' }));
                        if (modelType === 'lfm2_thinking' || modelType === 'thinking') lfmInCache = true;
                    }
                }

                checkCacheWorker.terminate();

                // Auto-start lfm2_thinking download ONLY if not already cached
                if (!lfmInCache) {
                    setTimeout(() => {
                        if (isMounted) {
                            handleDownload('lfm2_thinking');
                        }
                    }, 200);
                }
            }
        };

        checkCacheWorker.onerror = (err) => {
            console.warn('[ModelDownload] Cache check worker error:', err);
            checkCacheWorker.terminate();
            if (isMounted) {
                setTimeout(() => handleDownload('lfm2_thinking'), 200);
            }
        };

        checkCacheWorker.postMessage({ type: 'check_cache' });

        return () => {
            isMounted = false;
            checkCacheWorker.terminate();
        };
    }, []);

    const handleModelToggle = (modelType) => {
        setSelectedModels(prev => ({
            ...prev,
            [modelType]: !prev[modelType]
        }));
        setErrorMessage('');
    };

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleDownload = async (modelType) => {
        if (downloadStatus[modelType] === 'downloaded' || downloadStatus[modelType] === 'downloading') {
            return;
        }

        console.log(`[ModelDownload] Starting download for ${modelType}`);
        setDownloadStatus(prev => ({ ...prev, [modelType]: 'downloading' }));
        setErrorMessage('');

        try {
            await onDownloadModel(modelType, MODEL_URLS[modelType], (progress) => {
                setDownloadProgress(prev => ({
                    ...prev,
                    [modelType]: progress
                }));
            });

            console.log(`[ModelDownload] Download completed for ${modelType}`);
            setDownloadStatus(prev => ({ ...prev, [modelType]: 'downloaded' }));
        } catch (error) {
            if (error.message && error.message.includes("Download already in progress")) {
                console.log(`[ModelDownload] Ignoring concurrent download for ${modelType}`);
                return;
            }

            console.error(`[ModelDownload] Failed to download ${modelType}:`, error);
            setDownloadStatus(prev => ({ ...prev, [modelType]: 'error' }));
            setErrorMessage(t('modelDownload.downloadError') + ': ' + error.message);
        }
    };

    const handleContinue = () => {
        const hasDownloaded = Object.keys(downloadStatus).some(
            key => downloadStatus[key] === 'downloaded'
        );

        if (!hasDownloaded) {
            setErrorMessage(t('modelDownload.selectAtLeastOne'));
            return;
        }

        const downloadedList = Object.keys(downloadStatus).filter(
            key => downloadStatus[key] === 'downloaded'
        );

        onContinue(downloadedList);
    };

    const handleRedownload = async (modelType) => {
        console.log(`[ModelDownload] Re-downloading ${modelType}`);
        setDownloadStatus(prev => ({ ...prev, [modelType]: 'idle' }));
        setDownloadProgress(prev => ({
            ...prev,
            [modelType]: { loaded: 0, total: 0, percentage: 0 }
        }));

        await handleDownload(modelType);
    };

    const getButtonText = (modelType) => {
        const status = downloadStatus[modelType];
        if (status === 'downloading') return t('modelDownload.downloading');
        if (status === 'downloaded') return t('modelDownload.downloaded');
        return t('modelDownload.download');
    };

    const showRedownloadButton = (modelType) => {
        return downloadStatus[modelType] === 'downloaded';
    };

    const renderProgressBar = (modelType) => {
        if (downloadStatus[modelType] !== 'downloading') return null;
        const progress = downloadProgress[modelType];
        return (
            <div className="download-progress">
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${progress.percentage}%` }}></div>
                </div>
                <div className="progress-text">
                    {formatBytes(progress.loaded)} / {formatBytes(progress.total)} ({progress.percentage}%)
                </div>
            </div>
        );
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-content">
                <div className="onboarding-header">
                    <h1 className="onboarding-title">{t('modelDownload.title')}</h1>
                    <p className="onboarding-subtitle">{t('modelDownload.subtitle')}</p>
                </div>

                <div className="model-options">
                    {/* Primary Model: LFM2.5 1.2B Thinking */}
                    <div className={`model-card ${selectedModels.lfm2_thinking ? 'selected' : ''}`}>
                        <div className="model-card-header">
                            <input
                                type="checkbox"
                                id="lfm2-thinking-model"
                                checked={selectedModels.lfm2_thinking}
                                onChange={() => handleModelToggle('lfm2_thinking')}
                                className="model-checkbox"
                            />
                            <label htmlFor="lfm2-thinking-model" className="model-name">
                                {t('modelDownload.lfm2ThinkingModel')} <span className="model-size">{t('modelDownload.lfm2ThinkingSize')}</span>
                            </label>
                        </div>
                        <p className="model-description">{t('modelDownload.lfm2ThinkingDesc')}</p>
                        {renderProgressBar('lfm2_thinking')}
                        <div className="model-buttons">
                            <button
                                className={`model-download-btn ${downloadStatus.lfm2_thinking === 'downloaded' ? 'downloaded' : ''}`}
                                onClick={() => handleDownload('lfm2_thinking')}
                                disabled={downloadStatus.lfm2_thinking === 'downloading' || downloadStatus.lfm2_thinking === 'downloaded'}
                            >
                                {getButtonText('lfm2_thinking')}
                            </button>
                            {showRedownloadButton('lfm2_thinking') && (
                                <button
                                    className="model-redownload-btn"
                                    onClick={() => handleRedownload('lfm2_thinking')}
                                    disabled={downloadStatus.lfm2_thinking === 'downloading'}
                                >
                                    🔄 {t('modelDownload.redownload')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary Model: Qwen 2.5 1.5B Instruct */}
                    <div className={`model-card ${selectedModels.qwen25_15b ? 'selected' : ''}`}>
                        <div className="model-card-header">
                            <input
                                type="checkbox"
                                id="qwen25-15b-model"
                                checked={selectedModels.qwen25_15b}
                                onChange={() => handleModelToggle('qwen25_15b')}
                                className="model-checkbox"
                            />
                            <label htmlFor="qwen25-15b-model" className="model-name">
                                {t('modelDownload.qwen25Model')} <span className="model-size">{t('modelDownload.qwen25Size')}</span>
                            </label>
                        </div>
                        <p className="model-description">{t('modelDownload.qwen25Desc')}</p>
                        {renderProgressBar('qwen25_15b')}
                        <div className="model-buttons">
                            <button
                                className={`model-download-btn ${downloadStatus.qwen25_15b === 'downloaded' ? 'downloaded' : ''}`}
                                onClick={() => handleDownload('qwen25_15b')}
                                disabled={!selectedModels.qwen25_15b || downloadStatus.qwen25_15b === 'downloading' || downloadStatus.qwen25_15b === 'downloaded'}
                            >
                                {getButtonText('qwen25_15b')}
                            </button>
                            {showRedownloadButton('qwen25_15b') && (
                                <button
                                    className="model-redownload-btn"
                                    onClick={() => handleRedownload('qwen25_15b')}
                                    disabled={downloadStatus.qwen25_15b === 'downloading'}
                                >
                                    🔄 {t('modelDownload.redownload')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {errorMessage && (
                    <div className="onboarding-error">
                        {errorMessage}
                    </div>
                )}

                <div className="onboarding-note" style={{ textAlign: 'center', marginTop: '20px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    <p>{t('modelDownload.customModelNote') || '💡 You can add custom models (.gguf) or connect to LM Studio later in Settings.'}</p>
                </div>

                <button
                    className="onboarding-continue-btn"
                    onClick={handleContinue}
                    disabled={!Object.keys(downloadStatus).some(k => downloadStatus[k] === 'downloaded')}
                >
                    {t('modelDownload.continue')}
                </button>
            </div>
        </div>
    );
};

export default ModelDownload;
