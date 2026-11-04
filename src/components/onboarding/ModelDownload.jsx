import { useState, useEffect } from 'react';
import { t } from '../../utils/i18n';
import { MODEL_URLS } from '../../services/history';

const ModelDownload = ({ onContinue, onDownloadModel }) => {
    const [selectedModels, setSelectedModels] = useState({
        lfm3: true,
        lfm3_fast: false
    });

    const [downloadStatus, setDownloadStatus] = useState({
        lfm3: 'idle',
        lfm3_fast: 'idle'
    });

    const [downloadProgress, setDownloadProgress] = useState({
        lfm3: { loaded: 0, total: 0, percentage: 0 },
        lfm3_fast: { loaded: 0, total: 0, percentage: 0 }
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
                let lfm3InCache = false;

                for (const [modelType, modelUrl] of Object.entries(MODEL_URLS)) {
                    if (cachedUrls.some(url => url.includes(modelUrl) || modelUrl.includes(url))) {
                        setDownloadStatus(prev => ({ ...prev, [modelType]: 'downloaded' }));
                        if (modelType === 'lfm3') lfm3InCache = true;
                    }
                }

                checkCacheWorker.terminate();

                // Auto-start lfm3 download ONLY if not already cached
                if (!lfm3InCache) {
                    setTimeout(() => {
                        if (isMounted) {
                            handleDownload('lfm3');
                        }
                    }, 200);
                }
            }
        };

        checkCacheWorker.onerror = (err) => {
            console.warn('[ModelDownload] Cache check worker error:', err);
            checkCacheWorker.terminate();
            if (isMounted) {
                setTimeout(() => handleDownload('lfm3'), 200);
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
                    {/* Primary Model: LFM3 1.7B */}
                    <div className={`model-card ${selectedModels.lfm3 ? 'selected' : ''}`}>
                        <div className="model-card-header">
                            <input
                                type="checkbox"
                                id="lfm3-model"
                                checked={selectedModels.lfm3}
                                onChange={() => handleModelToggle('lfm3')}
                                className="model-checkbox"
                            />
                            <label htmlFor="lfm3-model" className="model-name">
                                {t('modelDownload.lfm3Model')} <span className="model-size">{t('modelDownload.lfm3Size')}</span>
                            </label>
                        </div>
                        <p className="model-description">{t('modelDownload.lfm3Desc')}</p>
                        {renderProgressBar('lfm3')}
                        <div className="model-buttons">
                            <button
                                className={`model-download-btn ${downloadStatus.lfm3 === 'downloaded' ? 'downloaded' : ''}`}
                                onClick={() => handleDownload('lfm3')}
                                disabled={downloadStatus.lfm3 === 'downloading' || downloadStatus.lfm3 === 'downloaded'}
                            >
                                {getButtonText('lfm3')}
                            </button>
                            {showRedownloadButton('lfm3') && (
                                <button
                                    className="model-redownload-btn"
                                    onClick={() => handleRedownload('lfm3')}
                                    disabled={downloadStatus.lfm3 === 'downloading'}
                                >
                                    🔄 {t('modelDownload.redownload')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary Model: LFM3 1.7B Fast */}
                    <div className={`model-card ${selectedModels.lfm3_fast ? 'selected' : ''}`}>
                        <div className="model-card-header">
                            <input
                                type="checkbox"
                                id="lfm3-fast-model"
                                checked={selectedModels.lfm3_fast}
                                onChange={() => handleModelToggle('lfm3_fast')}
                                className="model-checkbox"
                            />
                            <label htmlFor="lfm3-fast-model" className="model-name">
                                {t('modelDownload.lfm3FastModel')} <span className="model-size">{t('modelDownload.lfm3FastSize')}</span>
                            </label>
                        </div>
                        <p className="model-description">{t('modelDownload.lfm3FastDesc')}</p>
                        {renderProgressBar('lfm3_fast')}
                        <div className="model-buttons">
                            <button
                                className={`model-download-btn ${downloadStatus.lfm3_fast === 'downloaded' ? 'downloaded' : ''}`}
                                onClick={() => handleDownload('lfm3_fast')}
                                disabled={!selectedModels.lfm3_fast || downloadStatus.lfm3_fast === 'downloading' || downloadStatus.lfm3_fast === 'downloaded'}
                            >
                                {getButtonText('lfm3_fast')}
                            </button>
                            {showRedownloadButton('lfm3_fast') && (
                                <button
                                    className="model-redownload-btn"
                                    onClick={() => handleRedownload('lfm3_fast')}
                                    disabled={downloadStatus.lfm3_fast === 'downloading'}
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
