import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

const META_KEY = 'sessions_meta_v1';
const SESSION_PREFIX = 'session_';
// Legacy key for migration
const LEGACY_KEY = 'chat_messages_v1';
// Global model config key
const MODEL_CONFIG_KEY = 'global_model_config_v1';
// Onboarding state keys
const ONBOARDING_COMPLETE_KEY = 'onboarding_complete_v1';
const USER_LANGUAGE_KEY = 'user_language_v1';
const SELECTED_MODELS_KEY = 'selected_models_v1';

// Initial Model Configuration (Global)
export const MODEL_URLS = {
    lfm2_thinking: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-GGUF/resolve/main/LFM2.5-1.2B-Thinking-Q4_K_M.gguf?download=true',
    lfm2_instruct: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/main/LFM2.5-1.2B-Instruct-Q4_K_M.gguf?download=true',
    qwen25_15b: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true',
    // Backwards compatibility for previously downloaded models / aliases
    thinking: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Thinking-GGUF/resolve/main/LFM2.5-1.2B-Thinking-Q4_K_M.gguf?download=true',
    instruct: 'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/main/LFM2.5-1.2B-Instruct-Q4_K_M.gguf?download=true'
};

// Language storage keys
const LANGUAGE_KEY = 'user_language';

// Get user's saved language
export const getUserLanguage = async () => {
    try {
        const lang = await localforage.getItem(LANGUAGE_KEY);
        return lang || 'en';
    } catch (error) {
        console.error('Failed to load language:', error);
        return 'en';
    }
};

// Save user's language preference
export const setUserLanguage = async (language) => {
    try {
        await localforage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
        console.error('Failed to save language:', error);
    }
};

// -- User Default Configuration --
const USER_CONFIG_KEY = 'user_config_v1';

export const getUserConfig = async () => {
    try {
        const config = await localforage.getItem(USER_CONFIG_KEY);
        return config || null;
    } catch (error) {
        console.warn('Failed to load user config:', error);
        return null;
    }
};

export const setUserConfig = async (config) => {
    try {
        await localforage.setItem(USER_CONFIG_KEY, config);
        return config;
    } catch (error) {
        console.error('Failed to save user config:', error);
        throw error;
    }
};

// Default model configuration
const DEFAULT_MODEL_CONFIG = {
    n_ctx: 4096,
    n_batch: 512,
    n_gpu_layers: -1, // -1: offload all layers to WebGPU when available
    cache_type_k: 'q8_0',
    cache_type_v: 'q8_0',
    flash_attn: true,
    n_threads: typeof navigator !== 'undefined' ? Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8)) : 4,
    model_url: MODEL_URLS.lfm2_thinking,
    model_name: 'lfm2_thinking'
};

localforage.config({
    name: 'WebLocalLLM',
    storeName: 'chat_history'
});

// -- Helper: Get full session key
const sessionKey = (id) => `${SESSION_PREFIX}${id}`;

// -- Migration Logic
const migrateLegacyData = async () => {
    const legacyMessages = await localforage.getItem(LEGACY_KEY);
    if (legacyMessages && legacyMessages.length > 0) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const sessionData = {
            id,
            messages: legacyMessages,
            config: null // Default config
        };
        const meta = {
            id,
            title: 'Legacy Session',
            createdAt: now,
            updatedAt: now,
            isPinned: false
        };

        await localforage.setItem(sessionKey(id), sessionData);
        await localforage.setItem(META_KEY, [meta]);
        await localforage.removeItem(LEGACY_KEY);
        console.log('Migrated legacy chat history to new session format.');
        return [meta];
    }
    return null;
};

// -- Read Operations

export const getSessions = async () => {
    let metaList = await localforage.getItem(META_KEY);

    if (!metaList) {
        metaList = await migrateLegacyData();
    }

    if (!metaList) return [];

    return metaList.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
};

export const loadSession = async (id) => {
    try {
        const session = await localforage.getItem(sessionKey(id));
        return session || { id, messages: [], config: null };
    } catch (err) {
        console.error(`Failed to load session ${id}:`, err);
        return null;
    }
};

// -- Write Operations

export const createSession = async (title = 'New Chat', initialConfig = null) => {
    const id = uuidv4();
    const now = new Date().toISOString();

    const sessionData = {
        id,
        messages: [],
        config: initialConfig
    };
    await localforage.setItem(sessionKey(id), sessionData);

    const meta = {
        id,
        title,
        createdAt: now,
        updatedAt: now,
        isPinned: false
    };

    const currentMeta = (await localforage.getItem(META_KEY)) || [];
    await localforage.setItem(META_KEY, [meta, ...currentMeta]);

    return id;
};

export const updateSession = async (id, { messages, config, title, isPinned }) => {
    const now = new Date().toISOString();

    if (messages !== undefined || config !== undefined) {
        const session = await loadSession(id);
        if (session) {
            if (messages !== undefined) session.messages = messages;
            if (config !== undefined) session.config = config;
            await localforage.setItem(sessionKey(id), session);
        }
    }

    const currentMeta = (await localforage.getItem(META_KEY)) || [];
    const metaIndex = currentMeta.findIndex(m => m.id === id);

    if (metaIndex !== -1) {
        const m = currentMeta[metaIndex];
        m.updatedAt = now;
        if (title !== undefined) m.title = title;
        if (isPinned !== undefined) m.isPinned = isPinned;
        await localforage.setItem(META_KEY, [...currentMeta]);
    }
};

export const deleteSession = async (id) => {
    await localforage.removeItem(sessionKey(id));
    const currentMeta = (await localforage.getItem(META_KEY)) || [];
    const newMeta = currentMeta.filter(m => m.id !== id);
    await localforage.setItem(META_KEY, newMeta);
};

export const clearAllSessions = async () => {
    await localforage.clear();
};

// -- Global Model Config --

export const getModelConfig = async () => {
    const config = await localforage.getItem(MODEL_CONFIG_KEY);
    // Migrate old defaults or unsupported lfm3 to lfm2_thinking
    if (!config || config.model_name === 'lfm3' || config.model_name === 'lfm3_fast' || (config.model_url && config.model_url.includes('LFM3')) || config.model_name === 'thinking' || config.model_name === 'instruct') {
        const migrated = {
            ...DEFAULT_MODEL_CONFIG,
            ...(config || {}),
            model_name: 'lfm2_thinking',
            model_url: MODEL_URLS.lfm2_thinking,
            n_gpu_layers: -1,
            cache_type_k: 'q8_0',
            cache_type_v: 'q8_0',
            flash_attn: true,
            n_ctx: 4096
        };
        await localforage.setItem(MODEL_CONFIG_KEY, migrated);
        return migrated;
    }
    return { ...DEFAULT_MODEL_CONFIG, ...config };
};

export const setModelConfig = async (config) => {
    const current = await getModelConfig();
    const updated = { ...current, ...config };
    await localforage.setItem(MODEL_CONFIG_KEY, updated);
    return updated;
};

// -- Onboarding State Management --

export const getOnboardingComplete = async () => {
    const isComplete = await localforage.getItem(ONBOARDING_COMPLETE_KEY);
    return isComplete === true;
};

export const setOnboardingComplete = async (isComplete) => {
    await localforage.setItem(ONBOARDING_COMPLETE_KEY, isComplete);
};

export const getSelectedModels = async () => {
    const models = await localforage.getItem(SELECTED_MODELS_KEY);
    return models || [];
};

export const setSelectedModels = async (models) => {
    await localforage.setItem(SELECTED_MODELS_KEY, models);
};

// Custom Models Key
const CUSTOM_MODELS_KEY = 'custom_models_v1';
// LM Studio Config Key
const LM_STUDIO_CONFIG_KEY = 'lm_studio_config_v1';

export const getCustomModels = async () => {
    const models = await localforage.getItem(CUSTOM_MODELS_KEY);
    return models || [];
};

export const addCustomModel = async (model) => {
    const current = await getCustomModels();
    const exists = current.some(m => m.name === model.name || (model.url && m.url === model.url));

    if (exists) {
        console.log('Model already exists, skipping add:', model.name);
        return current;
    }

    const updated = [...current, { ...model, id: uuidv4(), dateAdded: new Date().toISOString() }];
    await localforage.setItem(CUSTOM_MODELS_KEY, updated);
    return updated;
};

export const removeCustomModel = async (id) => {
    const current = await getCustomModels();
    const updated = current.filter(m => m.id !== id);
    await localforage.setItem(CUSTOM_MODELS_KEY, updated);
    return updated;
};

export const getLMStudioConfig = async () => {
    const config = await localforage.getItem(LM_STUDIO_CONFIG_KEY);
    return config || { enabled: false, baseUrl: 'http://localhost:1234/v1', modelId: '' };
};

export const setLMStudioConfig = async (config) => {
    await localforage.setItem(LM_STUDIO_CONFIG_KEY, config);
    return config;
};

export const clearAllData = async () => {
    await localforage.clear();
};
