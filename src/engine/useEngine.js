
import { useState, useEffect, useRef } from 'react';
import {
    createSession,
    loadSession as loadSessionData,
    updateSession,
    getSessions,
    deleteSession as deleteSessionData,
    getModelConfig,
    setModelConfig as saveModelConfig,
    getUserConfig,
    setUserConfig,
    getCustomModels,
    removeCustomModel,
    getLMStudioConfig
} from '../services/history';
import { t } from '../utils/i18n';

export function useEngine(skipInit = false) {
    const [isReady, setIsReady] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTitleGenerating, setIsTitleGenerating] = useState(false);
    const [hasWebGPU, setHasWebGPU] = useState(false);

    // Session State
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessions, setSessions] = useState([]);

    const [messages, setMessages] = useState([]);
    const [currentResponse, setCurrentResponse] = useState('');
    const [currentStats, setCurrentStats] = useState(null);
    const [error, setError] = useState(null);
    const [downloadedModels, setDownloadedModels] = useState([]);
    const [lmStudioConfig, setLmStudioConfigState] = useState({ enabled: false, baseUrl: 'http://localhost:1234/v1', modelId: '' });

    // Default Config Definition (Hardcoded fallback)
    const fallbackConfig = {
        systemPrompt: t('chat.defaultSystemPrompt'),
        temperature: 0.1, // Optimal default for LFM3
        topP: 0.95,
        topK: 50,
        maxTokens: 2048,
        // Voice Settings
        voicePitch: 1.0,
        voiceRate: 1.0,
        voiceVolume: 1.0,
        voiceName: '',
        realTimeSpeech: true
    };

    // State to hold the user's persistent defaults
    const [defaultConfig, setDefaultConfig] = useState(fallbackConfig);
    // Inference Configuration State (session-specific)
    const [config, setConfig] = useState(fallbackConfig);

    // Model Loading Configuration State (global, requires reload)
    const [modelConfig, setModelConfigState] = useState(null);

    // Refs for stable access
    const currentSessionIdRef = useRef(currentSessionId);
    const titleGenPendingRef = useRef(false); // Track if title gen was aborted and needs retry

    useEffect(() => {
        currentSessionIdRef.current = currentSessionId;
    }, [currentSessionId]);

    const workerRef = useRef(null);
    const abortControllerRef = useRef(null); // For LM Studio fetch abort

    // Load User Defaults on Mount
    useEffect(() => {
        const loadDefaults = async () => {
            const savedConfig = await getUserConfig();
            if (savedConfig) {
                console.log('[useEngine] Loaded user defaults:', savedConfig);
                setDefaultConfig(prev => ({ ...prev, ...savedConfig }));
                // Also update current config if we haven't loaded a session yet (or it's the initial empty one)
                if (!currentSessionId) {
                    setConfig(prev => ({ ...prev, ...savedConfig }));
                }
            }
        };

        loadDefaults();

        // Load LM Studio Config
        getLMStudioConfig().then(config => {
            setLmStudioConfigState(config);
        });
    }, []);

    // Initialize the worker
    useEffect(() => {
        // Skip initialization if requested (during onboarding)
        if (skipInit) {
            console.log('[useEngine] Skipping worker initialization (onboarding active)');
            return;
        }

        console.log('[useEngine] Initializing worker');
        workerRef.current = new Worker(
            new URL('./wllama.worker.js', import.meta.url),
            { type: 'module' }
        );

        const handleMessage = (e) => {
            const { type, data } = e.data;

            // Handle Title Generation Job
            if (data && data.jobId === 'title_gen') {
                if (type === 'complete') {
                    // Extract title from response
                    let title = data.text.trim();
                    title = title.replace(/^["']|["']$/g, '');
                    // Use ref for current ID
                    if (currentSessionIdRef.current) {
                        updateSession(currentSessionIdRef.current, { title }).then(() => {
                            window.dispatchEvent(new CustomEvent('session-updated'));
                        });
                    }
                    setIsTitleGenerating(false);
                } else if (type === 'error') {
                    console.warn('Title generation failed:', data.error);
                    setIsTitleGenerating(false);
                } else if (type === 'aborted') {
                    // Title generation was aborted, mark pending for retry
                    titleGenPendingRef.current = true;
                    setIsTitleGenerating(false);
                } else if (type === 'token') {
                    // Ignore tokens during title generation - just keep isTitleGenerating true
                    // No action needed, just prevent falling through to regular token handler
                }
                return;
            }

            if (type === 'ready') {
                setIsReady(true);
                if (data?.hasWebGPU) {
                    setHasWebGPU(true);
                }
                console.log('Engine ready', data);
            } else if (type === 'token') {
                setCurrentResponse((prev) => prev + data.token);
            } else if (type === 'complete') {
                const fullResponse = data.text;
                const stats = data.stats;
                setMessages((prev) => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: fullResponse,
                        timestamp: new Date().toISOString(),
                        stats
                    }
                ]);
                setCurrentStats(stats);
                setCurrentResponse('');
                setIsGenerating(false);

                // Check if title generation was aborted and needs retry
                if (titleGenPendingRef.current) {
                    titleGenPendingRef.current = false;
                    // Delay slightly to let state settle
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('retry-title-gen'));
                    }, 100);
                }
            } else if (type === 'error') {
                console.error('Worker error:', data?.error || 'Unknown error');
                setError(data?.error || 'Unknown error occurred in worker');
                setIsGenerating(false);
            } else if (type === 'models_list') {
                // Worker sends { type, models } directly, not nested in data
                const opfsModels = e.data.models;
                console.log('[useEngine] OPFS models received:', opfsModels);
                getCustomModels().then(customModels => {
                    console.log('[useEngine] Custom models loaded:', customModels);
                    const merged = [...opfsModels, ...customModels];
                    console.log('[useEngine] Merged models list:', merged);
                    setDownloadedModels(merged);
                });
            } else if (type === 'model_deleted') {
                // Should be handled by models_list update, but good to know
                console.log('Model deleted:', e.data.filename);
            }
        };



        const handleWorkerMessage = (e) => {
            handleMessage(e);
        };

        workerRef.current.onmessage = handleWorkerMessage;
        workerRef.current.onerror = (err) => {
            console.error('Worker failed to load:', err);
            setError('Worker failed to initialize. Check console for details.');
        };

        // Load model config then init worker with it
        // Load model config then init worker with it
        getModelConfig().then(async (loadedModelConfig) => {
            // Check if we are using a custom model that is a file
            const customModels = await getCustomModels();
            const customModel = customModels.find(m => m.name === loadedModelConfig.model_name);

            let effectiveConfig = { ...loadedModelConfig };

            if (customModel) {
                // Ensure URL is set from custom model record if missing or partial
                effectiveConfig.model_url = customModel.url || customModel.originalURL;
                // If it's a local file cached via ServiceWorker/CacheStorage, the URL might be a fake one like https://custom-model/...
                // Wllama needs to know it deals with a URL.
            }

            // If LM Studio is enabled, does the worker need to run? 
            // Yes, user might switch back. But we should be careful not to crash if URL is missing.
            if (!effectiveConfig.model_url) {
                console.warn('[useEngine] No model details found, cannot initialize worker yet.');
                return;
            }

            setModelConfigState(effectiveConfig);
            if (workerRef.current) {
                workerRef.current.postMessage({ type: 'init', data: { modelConfig: effectiveConfig } });
            }
        });

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, [skipInit]);

    // Load Sessions on Mount
    useEffect(() => {
        const initSessions = async () => {
            const list = await getSessions();
            setSessions(list);

            if (list.length > 0) {
                // Load most recent
                await switchSession(list[0].id);
            } else {
                // Create new
                await createNewSession();
            }
        };
        initSessions();
    }, []);

    // Persist current session changes
    useEffect(() => {
        if (currentSessionId) {
            updateSession(currentSessionId, {
                messages,
                config
            }).then(() => refreshSessionList());
        }
    }, [messages, config, currentSessionId]);

    // Auto-Title Logic
    useEffect(() => {
        if (!currentSessionId || messages.length !== 2 || isTitleGenerating) return;

        // Check title directly from IndexedDB to avoid re-triggering from sessions state changes
        loadSessionData(currentSessionId).then(sessionData => {
            if (!sessionData) return;
            const autoTitleCandidates = ['New Chat', t('chat.newSession')];
            if (autoTitleCandidates.some(candidate => sessionData.title === candidate || sessionData.title.startsWith(candidate))) {
                generateTitle(messages);
            }
        });
    }, [messages.length, currentSessionId]);

    useEffect(() => {
        const handler = () => refreshSessionList();
        window.addEventListener('session-updated', handler);
        return () => window.removeEventListener('session-updated', handler);
    }, []);

    // Retry title generation after it was aborted
    useEffect(() => {
        const retryHandler = () => {
            if (currentSessionId && messages.length >= 2) {
                loadSessionData(currentSessionId).then(sessionData => {
                    if (!sessionData) return;
                    const autoTitleCandidates = ['New Chat', t('chat.newSession')];
                    if (autoTitleCandidates.some(candidate => sessionData.title === candidate)) {
                        generateTitle(messages);
                    }
                });
            }
        };
        window.addEventListener('retry-title-gen', retryHandler);
        return () => window.removeEventListener('retry-title-gen', retryHandler);
    }, [currentSessionId, messages]);

    const refreshSessionList = async () => {
        const list = await getSessions();
        setSessions(list);
    };

    const switchSession = async (id) => {
        if (isGenerating || isTitleGenerating) return; // Prevent switching while generating
        const data = await loadSessionData(id);
        if (data) {
            setCurrentSessionId(data.id);
            setMessages(data.messages);
            // Merge loaded config with current defaults to ensure new fields are present
            // AND ensure defaults are used if session config is missing/sparse
            if (data.config) {
                // Strategy: Start with fallback, overlay saved defaults (already in defaultConfig), then overlay session config
                // Wait, defaultConfig state has already merged fallback + user saved.
                setConfig(prev => ({ ...defaultConfig, ...data.config }));
            } else {
                setConfig(defaultConfig);
            }
        }
    };

    const createNewSession = async () => {
        const initialConfig = { ...defaultConfig };
        const id = await createSession(t('chat.newSession'), initialConfig);
        await refreshSessionList();
        await switchSession(id);
    };

    const saveAsDefault = async (newConfig) => {
        try {
            const saved = await setUserConfig(newConfig);
            setDefaultConfig(prev => ({ ...prev, ...saved }));
            console.log('Saved new user defaults:', saved);
            return saved;
        } catch (e) {
            console.error('Failed to save defaults', e);
        }
    };

    const removeSession = async (id) => {
        await deleteSessionData(id);
        const list = await getSessions();
        setSessions(list);

        if (currentSessionId === id) {
            if (list.length > 0) {
                switchSession(list[0].id);
            } else {
                createNewSession();
            }
        }
    };

    const updateSessionTitle = async (id, newTitle) => {
        await updateSession(id, { title: newTitle });
        refreshSessionList();
    };

    const updateSessionPin = async (id, isPinned) => {
        await updateSession(id, { isPinned });
        refreshSessionList();
    };

    const generateTitle = (msgs) => {
        if (!workerRef.current) return;

        // Create specific prompts for title generation
        // user: ... assistant: ...
        const conversation = msgs.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `Generate a short, concise title (3-6 words) for this conversation language should match the conversation language:\n\n${conversation}\n\nTitle:`;

        // We need to run this "side-channel". 
        // Since wllama worker is busy? No, we only call this when messages.length === 2 (completed).
        // So worker is free.

        // Use a separate 'title' message type to worker? 
        // Or just re-use 'chat' but we don't want it to affect main chat state.
        // The worker is stateless regarding "current chat", it just completes prompt.
        // So we can just fire a completion request and handle it separately.

        // However, our `onmessage` handler handles 'complete' by updating `setMessages`.
        // We need a way to distinguish this request.
        // Let's add a `type` or `id` to the chat requestpayload? 
        // Helper: refactor worker to echo back a request ID?

        // Simpler approach for now:
        // We will just use the same `chat` logic but we need to intercept the result.
        // But `onmessage` is global.

        // Let's add a `jobType` to the message payload to worker, and worker echoes it back.
        // Modify worker first? Or assume we can add a flag.

        setIsTitleGenerating(true);
        workerRef.current.postMessage({
            type: 'chat',
            data: {
                messages: [{ role: 'user', content: prompt }],
                config: { maxTokens: 20 }, // Short gen
                jobId: 'title_gen' // Custom tag
            },
        });
    };

    // Re-implementing chat to be robust
    const chat = async (prompt, overrideHistory = null) => {
        // Check for LM Studio first
        const lmStudioConfig = await getLMStudioConfig();
        if (lmStudioConfig.enabled) {
            await chatLMStudio(prompt, lmStudioConfig, overrideHistory);
            return;
        }

        if (!workerRef.current || !isReady) return;

        // If title generation is in progress, abort it first
        if (isTitleGenerating) {
            workerRef.current.postMessage({ type: 'abort_title' });
            // The aborted handler will set titleGenPendingRef.current = true
        }

        setIsGenerating(true);
        setCurrentResponse('');
        setCurrentStats(null);

        // Add user message to history state immediately
        const baseHistory = overrideHistory || messages;
        const newHistory = [...baseHistory, {
            role: 'user',
            content: prompt,
            timestamp: new Date().toISOString()
        }];
        setMessages(newHistory);

        // Send to worker
        workerRef.current.postMessage({
            type: 'chat',
            data: {
                messages: newHistory,
                config: config,
            },
        });
    };

    const chatLMStudio = async (prompt, lmConfig, overrideHistory = null) => {
        console.log('[useEngine] Starting LM Studio chat', lmConfig);
        setIsGenerating(true);
        setCurrentResponse('');
        setError(null);

        const baseHistory = overrideHistory || messages;
        const newHistory = [...baseHistory, {
            role: 'user',
            content: prompt,
            timestamp: new Date().toISOString()
        }];
        setMessages(newHistory);



        try {
            abortControllerRef.current = new AbortController();

            // Prepare messages for OpenAI format
            const apiMessages = newHistory.map(m => ({
                role: m.role,
                content: m.content
            }));

            // Log api messages
            console.log('[useEngine] Sending messages to LM Studio:', apiMessages);

            if (config.systemPrompt) {
                apiMessages.unshift({ role: 'system', content: config.systemPrompt });
            }

            const url = `${lmConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;
            console.log('[useEngine] Fetching from LM Studio:', url);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    model: lmConfig.modelId || 'local-model',
                    stream: true,
                    temperature: config.temperature,
                    top_p: config.topP,
                    max_tokens: config.maxTokens
                }),
                signal: abortControllerRef.current.signal
            });

            console.log('[useEngine] Response headers:', [...response.headers.entries()]);

            if (!response.ok) throw new Error(`LM Studio API Error: ${response.statusText}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                // console.log('[useEngine] LM Studio chunk:', chunk); // Too verbose?
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '');
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices[0]?.delta?.content || '';
                            if (content) {
                                fullText += content;
                                setCurrentResponse(prev => prev + content);
                            }
                        } catch (e) {
                            console.warn('Error parsing SSE json', e);
                        }
                    }
                }
            }
            console.log('[useEngine] LM Studio complete');

            // Completion
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: fullText,
                    timestamp: new Date().toISOString(),
                    stats: { // Fake stats for now
                        tps: 0, // Prevent crash
                        predict_ms: 0,
                        predict_n: 0,
                        ttft: 0
                    }
                }
            ]);
            setCurrentResponse('');
            setIsGenerating(false);

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log('LM Studio request aborted');
            } else {
                console.error('LM Studio Error:', err);
                setError(`LM Studio Error: ${err.message}`);
            }
            setIsGenerating(false);
        }
    };


    const stop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsGenerating(false);
            if (currentResponse) {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: currentResponse,
                    timestamp: new Date().toISOString()
                }]);
                setCurrentResponse('');
            }
            return;
        }

        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'abort' });
            setIsGenerating(false);
            if (currentResponse) {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: currentResponse,
                    timestamp: new Date().toISOString()
                }]);
                setCurrentResponse('');
            }
        }
    };

    const edit = (index, newText) => {
        const history = messages.slice(0, index);
        chat(newText, history);
    };

    const regenerate = (index) => {
        if (index === 0) return;
        const userPrompt = messages[index - 1].content;
        const history = messages.slice(0, index - 1);
        chat(userPrompt, history);
    };

    // Update global model config (requires page reload to take effect)
    const updateModelConfig = async (newConfig) => {
        const updated = await saveModelConfig(newConfig);
        setModelConfigState(updated);
        window.location.reload();

        return updated;
    };

    const updateLMStudioConfig = async (newConfig) => {
        const { setLMStudioConfig } = await import('../services/history');
        const updated = await setLMStudioConfig(newConfig);
        setLmStudioConfigState(updated);
        return updated;
    };

    // List downloaded models from OPFS
    // List downloaded models from OPFS + Custom Models
    const listModels = async () => {
        console.log('[useEngine] listModels called');
        // Trigger worker to list OPFS models. 
        if (workerRef.current) {
            console.log('[useEngine] Requesting models_list from worker');
            workerRef.current.postMessage({ type: 'list_models' });
        } else {
            // If worker not ready, at least show custom models?
            console.log('[useEngine] Worker not ready, fetching only custom models');
            const custom = await getCustomModels();
            console.log('[useEngine] Custom models only:', custom);
            setDownloadedModels(custom);
        }
    };

    // Modified Effect to merge custom models
    useEffect(() => {
        // When downloadedModels updates (from worker), we also fetch custom models and merge?
        // No, `downloadedModels` is strictly what the worker sees (OPFS).
        // UI should combine them.
    }, [downloadedModels]);

    // Delete a specific model file from cache
    // Delete a specific model file from cache
    const deleteModel = async (cacheName, isCustom = false, id = null) => {
        if (isCustom && id) {
            await removeCustomModel(id);
            // We also need to listModels to update state, but usually we reload page after this.
            return;
        }

        if (workerRef.current) {
            return new Promise((resolve) => {
                const handler = (e) => {
                    if (e.data.type === 'model_deleted' && e.data.cacheName === cacheName) {
                        workerRef.current.removeEventListener('message', handler);
                        resolve();
                    }
                };
                workerRef.current.addEventListener('message', handler);
                workerRef.current.postMessage({ type: 'delete_model', data: { cacheName } });

                // Fallback timeout in case worker doesn't respond
                setTimeout(() => {
                    workerRef.current.removeEventListener('message', handler);
                    resolve();
                }, 5000);
            });
        }
    };

    return {
        isReady,
        hasWebGPU,
        isGenerating,
        isTitleGenerating,
        messages,
        currentResponse,
        currentStats,
        chat,
        stop,
        edit,
        regenerate,
        setMessages,
        error,
        currentSessionId,
        sessions,
        switchSession,
        createNewSession,
        updateSessionTitle,
        updateSessionPin,
        removeSession,
        config,
        setConfig,
        modelConfig,
        updateModelConfig,
        downloadedModels,
        listModels,
        deleteModel,
        saveAsDefault,
        lmStudioConfig,
        updateLMStudioConfig
    };
}
