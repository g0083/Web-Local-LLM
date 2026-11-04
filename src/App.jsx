import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import LicenseModal from './components/LicenseModal';
import SettingsModal from './components/SettingsModal';
import OnboardingFlow from './components/OnboardingFlow';
import AdBanner from './components/AdBanner';
import { useEngine } from './engine/useEngine';
import { MODEL_URLS, getOnboardingComplete, getModelConfig, getUserLanguage, setModelConfig } from './services/history';
import { t, setLanguage } from './utils/i18n';
import './App.css';
import { sha256 } from './utils/crypto';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(null); // null = loading
  const [isLicenseOpen, setIsLicenseOpen] = useState(false); // State for LicenseModal
  const [downloadProgress, setDownloadProgress] = useState(null); // For redownload overlay
  const introWorkerRef = useRef(null); // Ref to track intro worker for cancellation
  const downloadLockRef = useRef(false); // Ref to prevent concurrent downloads synchronously
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // PWA Install Prompt Logic
  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      console.log('[App] PWA beforeinstallprompt stashed');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[App] PWA install choice: ${outcome}`);
    setDeferredPrompt(null);
  };

  const engine = useEngine(showOnboarding !== false);


  // Check onboarding status on mount and handle mobile sidebar
  useEffect(() => {
    // Mobile sidebar check
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const checkOnboarding = async () => {
      const isComplete = await getOnboardingComplete();
      const language = await getUserLanguage();
      setLanguage(language);
      setShowOnboarding(!isComplete);
    };
    checkOnboarding();
  }, []);




  // Handle model download during onboarding
  const handleModelDownload = async (modelType, modelUrl, onProgress) => {
    if (downloadLockRef.current) {
      console.warn("Download already in progress (locked), ignoring request");
      return Promise.reject(new Error("Download already in progress"));
    }

    downloadLockRef.current = true;

    return new Promise(async (resolve, reject) => {
      console.log(`[App] Starting download for ${modelType} from ${modelUrl}`);

      // TERMINATE INTRO WORKER to release OPFS locks
      if (introWorkerRef.current) {
        console.log('[App] Terminating intro worker before download to prevent lock contention');
        introWorkerRef.current.terminate();
        introWorkerRef.current = null;
      }

      let cacheKey;
      try {
        cacheKey = await sha256(modelUrl);
        console.log(`[App] Calculated cache key: ${cacheKey}`);
      } catch (e) {
        console.error("Failed to calculate SHA256", e);
        reject(e);
        downloadLockRef.current = false;
        return;
      }

      // Create a fresh worker for this specific model download
      const downloadWorker = new Worker(
        new URL('./engine/wllama.worker.js', import.meta.url),
        { type: 'module' }
      );

      let isResolved = false;

      const cleanup = () => {
        if (!isResolved) {
          isResolved = true;
          downloadWorker.removeEventListener('message', handleMessage);
          downloadWorker.removeEventListener('error', handleError);
          setTimeout(() => {
            try {
              downloadWorker.terminate();
            } catch (_) {}
            downloadLockRef.current = false;
          }, 100);
        }
      };

      const handleMessage = (event) => {
        const { type, message, loaded, total, percentage, debug } = event.data;

        // console.log(`[App] Worker message:`, event.data);

        if (type === 'progress') {
          // console.log(`[App] Progress: ${loaded}/${total} (${percentage}%)`);
          if (onProgress) {
            onProgress({ loaded, total, percentage });
          }
        } else if (type === 'download_complete') {
          // Model is downloaded successfully
          console.log(`[App] Model ${modelType} downloaded via manual worker flow`);
          cleanup();
          resolve();
        } else if (type === 'error') {
          console.error(`[App] Worker error:`, message, debug);
          cleanup();
          reject(new Error(message));
        }
      };

      const handleError = (error) => {
        console.error(`[App] Worker error event:`, error);
        cleanup();
        reject(error);
      };

      downloadWorker.addEventListener('message', handleMessage);
      downloadWorker.addEventListener('error', handleError);

      // Trigger manual download action
      console.log(`[App] Sending download message to worker`);
      downloadWorker.postMessage({
        type: 'download',
        data: {
          url: modelUrl,
          filename: cacheKey,
          metadataFileName: cacheKey + '.json'
        }
      });
    }).catch(err => {
      downloadLockRef.current = false;
      throw err;
    });
  };

  // Handle re-download request from Settings
  const handleRedownload = async (targetModelName = null) => {
    let modelName;
    let modelUrl;

    if (targetModelName && typeof targetModelName === 'string' && MODEL_URLS[targetModelName]) {
      modelName = targetModelName;
      modelUrl = MODEL_URLS[targetModelName];
    } else {
      const config = await getModelConfig();
      modelName = config.model_name || 'lfm2_thinking';
      modelUrl = config.model_url || MODEL_URLS[modelName] || MODEL_URLS.lfm2_thinking;
    }

    if (!confirm(t('chat.redownloadConfirm') + ` (${modelName})`)) return;

    setDownloadProgress({ loaded: 0, total: 100, percentage: 0, modelName });
    setIsSettingsOpen(false);

    // Clear cache first using a temporary worker
    const worker = new Worker(new URL('./engine/wllama.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'clear_cache' });

    worker.onmessage = (e) => {
      if (e.data.type === 'cleared') {
        worker.terminate();
        // Start download
        handleModelDownload(modelName, modelUrl, (progress) => {
          setDownloadProgress(prev => ({ ...progress, modelName }));
        }).then(() => {
          setDownloadProgress(null);
          // Reload to ensure fresh start with new model
          window.location.reload();
        }).catch(err => {
          console.error("Redownload failed", err);
          alert(t('modelDownload.downloadError'));
          setDownloadProgress(null);
        });
      }
    };
  };

  const DownloadOverlay = () => {
    if (!downloadProgress) return null;
    return (
      <div className="modal-overlay" style={{ zIndex: 2000, background: 'rgba(0,0,0,0.8)' }}>
        <div className="modal-content glass" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
          <h3 style={{ marginBottom: '20px' }}>Downloading {downloadProgress.modelName}...</h3>
          <div className="progress-bar-container" style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
            <div className="progress-bar-fill" style={{ width: `${downloadProgress.percentage}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s' }}></div>
          </div>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {downloadProgress.percentage}%
            {downloadProgress.total > 100 && ` (${Math.round(downloadProgress.loaded / 1024 / 1024)}MB / ${Math.round(downloadProgress.total / 1024 / 1024)}MB)`}
          </p>
        </div>
      </div>
    );
  };


  // Handle intro generation during onboarding
  const handleIntroGeneration = async (prompt, onChunk) => {
    return new Promise((resolve, reject) => {
      console.log(`[App] Starting intro generation`);

      // Create a fresh worker for intro generation
      const introWorker = new Worker(
        new URL('./engine/wllama.worker.js', import.meta.url),
        { type: 'module' }
      );
      introWorkerRef.current = introWorker;

      let isResolved = false;
      let fullText = '';

      const handleMessage = (event) => {
        const { type, data } = event.data;

        console.log(`[App] Intro worker message:`, event.data);

        if (type === 'ready') {
          console.log(`[App] Intro worker ready, starting generation`);
          // Worker is ready, now send the chat request
          introWorker.postMessage({
            type: 'chat',
            data: {
              messages: [
                { role: 'system', content: 'You are a helpful AI assistant explaining the features of this application.' },
                { role: 'user', content: prompt }
              ],
              config: {
                temperature: 0.7,
                topP: 0.9,
                topK: 40,
                maxTokens: 512
              },
              jobId: 'intro_gen'
            }
          });
        } else if (type === 'token' && data?.jobId === 'intro_gen') {
          console.log('[App] Received token:', data.token, 'charCodes:', [...data.token].map(c => c.charCodeAt(0)));
          fullText += data.token;
          if (onChunk) {
            onChunk(data.token);
          }
        } else if (type === 'complete' && data?.jobId === 'intro_gen') {
          console.log(`[App] Intro generation complete, fullText:`, fullText);
          if (!isResolved) {
            isResolved = true;
            introWorker.removeEventListener('message', handleMessage);
            introWorker.terminate();
            if (introWorkerRef.current === introWorker) introWorkerRef.current = null;
            resolve(fullText);
          }
        } else if (type === 'error') {
          console.error(`[App] Intro worker error:`, data.error);
          if (!isResolved) {
            isResolved = true;
            introWorker.removeEventListener('message', handleMessage);
            introWorker.terminate();
            if (introWorkerRef.current === introWorker) introWorkerRef.current = null;
            reject(new Error(data.error));
          }
        }
      };

      const handleError = (error) => {
        console.error(`[App] Intro worker error event:`, error);
        if (!isResolved) {
          isResolved = true;
          introWorker.removeEventListener('message', handleMessage);
          introWorker.removeEventListener('error', handleError);
          introWorker.removeEventListener('error', handleError);
          introWorker.terminate();
          if (introWorkerRef.current === introWorker) introWorkerRef.current = null;
          reject(error);
        }
      };

      introWorker.addEventListener('message', handleMessage);
      introWorker.addEventListener('error', handleError);

      // Initialize the worker with the model
      getModelConfig().then(modelConfig => {
        console.log(`[App] Sending init message to intro worker with model:`, modelConfig);
        introWorker.postMessage({
          type: 'init',
          data: { modelConfig }
        });
      });
    });
  };



  const handleOnboardingComplete = () => {
    console.log('[App] Onboarding complete, showing main UI');
    // Terminate intro worker if it's still running (e.g. skipped)
    if (introWorkerRef.current) {
      console.log('[App] Aborting intro generation (Onboarding Skipped/Completed)');
      introWorkerRef.current.terminate();
      introWorkerRef.current = null;
    }
    setShowOnboarding(false);
  };

  // Loading state
  if (showOnboarding === null) {
    console.log('[App] Onboarding state: loading');
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  console.log('[App] Onboarding state:', showOnboarding ? 'showing' : 'completed');

  // Onboarding flow
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onDownloadModel={handleModelDownload}
        generateIntro={handleIntroGeneration}
      />
    );
  }

  return (
    <div className="app-main-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <div
        className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        <div
          className={`mobile-sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <Sidebar
          sessions={engine.sessions}
          currentSessionId={engine.currentSessionId}
          onSwitch={engine.switchSession}
          onDelete={engine.removeSession}
          onUpdateTitle={engine.updateSessionTitle}
          onTogglePin={engine.updateSessionPin}
          isTitleGenerating={engine.isTitleGenerating}
          isGenerating={engine.isGenerating}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenSessionSettings={() => { }} // Placeholder, will be handled separately
          onOpenLicense={() => setIsLicenseOpen(true)}
          onNewSession={engine.createNewSession}
        />

        <ChatInterface
          engine={engine}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenGlobalSettings={() => setIsSettingsOpen(true)}
          onNewSession={engine.createNewSession}
          isSidebarOpen={isSidebarOpen}
          onRedownload={handleRedownload}
          showInstall={!!deferredPrompt}
          onInstall={handleInstallClick}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={engine.config}
          onSave={async (newConfig, isDefault) => {
            engine.setConfig(newConfig);
            if (isDefault) {
              await engine.saveAsDefault(newConfig);
              alert(t('settings.defaultsSaved') || 'Settings saved as new default for future chats.');
            }
          }}
          title={t('settings.globalSettings')}
          hasWebGPU={engine.hasWebGPU}
          modelConfig={engine.modelConfig}
          onSaveModelConfig={engine.updateModelConfig}
          isGenerating={engine.isGenerating || engine.isTitleGenerating}
          onRedownload={handleRedownload}
          downloadedModels={engine.downloadedModels}
          onListModels={engine.listModels}
          onDeleteModel={engine.deleteModel}
          onAddCustomModel={async (model) => {
            // If it's a file, we need to cache it first
            if (model.type === 'file') {
              const response = new Response(model.file);
              // Cache it using Cache API
              const cache = await caches.open('wllama');
              // Create a fake URL for the cache
              const cacheUrl = `https://custom-model/${model.name}`;
              await cache.put(cacheUrl, response);

              // Add to history
              const { addCustomModel } = await import('./services/history');
              await addCustomModel({
                name: model.name,
                url: cacheUrl,
                size: model.size,
                type: 'file',
                filename: model.name
              });

            } else {
              // URL type
              // Trigger download first!
              const downloadUrl = model.url;
              setDownloadProgress({ loaded: 0, total: 100, percentage: 0, modelName: model.name });

              try {
                await handleModelDownload(model.name, downloadUrl, (progress) => {
                  setDownloadProgress(prev => ({ ...progress, modelName: model.name }));
                });

                const { addCustomModel } = await import('./services/history');
                await addCustomModel({
                  name: model.name,
                  url: model.url,
                  type: 'url'
                });

                // Select the new model as active
                await engine.updateModelConfig({
                  model_name: model.name,
                  model_url: model.url
                });

                // Wait a bit for storage
                await new Promise(r => setTimeout(r, 500));

              } catch (e) {
                console.error("Download failed during add", e);
                alert("Failed to download model: " + e.message);
                // Do not add to history if failed
                throw e;
              } finally {
                setDownloadProgress(null);
              }
            }
            alert('Custom model added! You can now select it in model performance settings.');
            window.location.reload();
          }}
          onRemoveCustomModel={async (id) => {
            const { removeCustomModel } = await import('./services/history');
            await removeCustomModel(id);
            window.location.reload();
          }}
          lmStudioConfig={engine.lmStudioConfig}
          onSaveLMStudioConfig={async (config) => {
            const { setLMStudioConfig } = await import('./services/history');
            await setLMStudioConfig(config);
            // We also need to update engine state if we want immediate effect without reload, 
            // but engine reads from history on each chat? No, it reads on chat start?
            // Actually engine.chat reads getLMStudioConfig() every time.
            // But we might want to force a re-render or state update if needed.
          }}
        />

        <LicenseModal
          isOpen={isLicenseOpen}
          onClose={() => setIsLicenseOpen(false)}
        />
        <DownloadOverlay />
      </div>
      <AdBanner />
    </div>
  );
}

export default App;


