// Polyfill for document in worker if needed
if (typeof document === 'undefined') {
    self.document = {
        baseURI: self.location.href
    };
}

// Polyfill for crypto.subtle.digest (SHA-256) for non-secure contexts (e.g. mobile IP access)
(function () {
    try {
        let cryptoObj = self.crypto;
        if (!cryptoObj) {
            try {
                Object.defineProperty(self, 'crypto', {
                    value: { subtle: {} },
                    writable: true,
                    configurable: true
                });
                cryptoObj = self.crypto;
            } catch (e) {
                console.warn("Could not define self.crypto", e);
            }
        }

        if (cryptoObj) {
            if (!cryptoObj.subtle) {
                try {
                    Object.defineProperty(cryptoObj, 'subtle', {
                        value: {},
                        writable: true,
                        configurable: true
                    });
                } catch (e) {
                    cryptoObj.subtle = {};
                }
            }

            if (cryptoObj.subtle && !cryptoObj.subtle.digest) {
                cryptoObj.subtle.digest = async function (algorithm, data) {
                    if (algorithm === 'SHA-256' || algorithm.name === 'SHA-256') {
                        const msgBuffer = new Uint8Array(data);
                        const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
                        const k = [
                            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
                        ];
                        const len = msgBuffer.length * 8;
                        const preProcessed = new Uint8Array(((msgBuffer.length + 8) >>> 6 !== 0 ? ((msgBuffer.length + 8) >>> 6) + 1 : 1) * 64);
                        preProcessed.set(msgBuffer);
                        preProcessed[msgBuffer.length] = 0x80;

                        const view = new DataView(preProcessed.buffer);
                        view.setUint32(preProcessed.length - 8, Math.floor(len / 4294967296), false);
                        view.setUint32(preProcessed.length - 4, len % 4294967296, false);

                        for (let i = 0; i < preProcessed.length; i += 64) {
                            const w = new Uint32Array(64);
                            for (let j = 0; j < 16; j++) {
                                w[j] = view.getUint32(i + j * 4, false);
                            }
                            for (let j = 16; j < 64; j++) {
                                const s0 = (w[j - 15] >>> 7 | w[j - 15] << 25) ^ (w[j - 15] >>> 18 | w[j - 15] << 14) ^ (w[j - 15] >>> 3);
                                const s1 = (w[j - 2] >>> 17 | w[j - 2] << 15) ^ (w[j - 2] >>> 19 | w[j - 2] << 13) ^ (w[j - 2] >>> 10);
                                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
                            }

                            let [a, b, c, d, e, f, g, hh] = h;
                            for (let j = 0; j < 64; j++) {
                                const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
                                const ch = (e & f) ^ (~e & g);
                                const temp1 = (hh + S1 + ch + k[j] + w[j]) | 0;
                                const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
                                const maj = (a & b) ^ (a & c) ^ (b & c);
                                const temp2 = (S0 + maj) | 0;

                                hh = g; g = f; f = e; e = (d + temp1) | 0;
                                d = c; c = b; b = a; a = (temp1 + temp2) | 0;
                            }

                            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0;
                            h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
                            h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0;
                            h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
                        }

                        const buffer = new ArrayBuffer(32);
                        const outView = new DataView(buffer);
                        for (let i = 0; i < 8; i++) {
                            outView.setUint32(i * 4, h[i], false);
                        }
                        return buffer;
                    }
                    throw new Error("Algorithm not supported by polyfill");
                };
            }
        }
    } catch (err) {
        console.error("Polyfill injection failed:", err);
    }
})();

import { Wllama } from '@wllama/wllama';

let wllama = null;
let currentAbortController = null;
let titleAbortController = null;
let downloadAbortController = null;
let isBusy = false;

// Wllama v3 single WASM asset path
const CONFIG = {
    wllama: {
        default: '/wllama/wllama.wasm',
    },
};

function getWllamaInstance() {
    if (!wllama) {
        wllama = new Wllama(CONFIG.wllama);
    }
    return wllama;
}

async function initialize(modelConfig = {}) {
    console.log('[Worker] Starting initialization with config:', modelConfig);
    postMessage({ type: 'debug', message: 'Worker starting initialization' });

    if (wllama) {
        console.log('[Worker] Existing wllama instance found, exiting...');
        postMessage({ type: 'debug', message: 'Exiting existing wllama instance' });
        try {
            await wllama.exit();
        } catch (e) {
            console.log('[Worker] Error exiting wllama:', e);
        }
        wllama = null;
    }

    wllama = new Wllama(CONFIG.wllama);

    const modelUrl = modelConfig.model_url;
    if (!modelUrl) {
        console.error('[Worker] No model_url provided');
        postMessage({ type: 'error', message: 'No model URL provided' });
        return;
    }

    console.log('[Worker] Loading model from URL:', modelUrl);
    postMessage({ type: 'status', message: 'Loading model...' });

    // Check WebGPU capability
    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    console.log('[Worker] WebGPU detected:', hasWebGPU);

    const nThreads = modelConfig.n_threads || (typeof navigator !== 'undefined' ? Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8)) : 4);
    const nCtx = modelConfig.n_ctx || 4096;
    let nGpuLayers = modelConfig.n_gpu_layers ?? 99;
    if (nGpuLayers < 0) nGpuLayers = 99; // Ensure WebGPU layer offloading
    const cacheType = (modelConfig.cache_type_k === 'q8_0' || !modelConfig.cache_type_k) ? 'f16' : modelConfig.cache_type_k;

    try {
        await wllama.loadModelFromUrl(modelUrl, {
            n_ctx: nCtx,
            n_batch: modelConfig.n_batch || 256,
            n_gpu_layers: nGpuLayers,
            cache_type_k: cacheType,
            cache_type_v: cacheType,
            flash_attn: modelConfig.flash_attn ?? true,
            n_threads: nThreads,
            useCache: true,
            progressCallback: ({ loaded, total }) => {
                const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
                postMessage({
                    type: 'progress',
                    loaded,
                    total,
                    percentage
                });
            }
        });

        // Validate model metadata & architecture support
        const meta = wllama.getModelMetadata();
        const arch = meta?.meta?.['general.architecture'] || meta?.hparams?.['general.architecture'];
        console.log('[Worker] Model loaded into Wllama. Detected architecture:', arch);

        const SUPPORTED_ARCHS = [
            'llama', 'falcon', 'gpt2', 'gptj', 'gptneox', 'mpt', 'baichuan',
            'starcoder', 'refact', 'bert', 'nomic-bert', 'jina-bert-v2', 'bloom',
            'stablelm', 'qwen', 'qwen2', 'qwen2moe', 'phi2', 'phi3', 'plamo',
            'gemma', 'gemma2', 'starcoder2', 'command-r', 'dbrx', 'olmo',
            'openelm', 'arctic', 'deepseek2', 'chatglm', 'bitnet', 't5',
            't5encoder', 'jamba', 'nemotron', 'chameleon', 'lfm', 'lfm2'
        ];

        if (arch && !SUPPORTED_ARCHS.includes(arch)) {
            throw new Error(`Model architecture '${arch}' is not supported by current Wllama WebAssembly build. Please use a model with a supported architecture (e.g. LFM2.5, Qwen2.5, LLaMA).`);
        }

        try {
            wllama.getLoadedContextInfo();
        } catch (ctxErr) {
            throw new Error(`Failed to initialize WebAssembly context: ${ctxErr.message}`);
        }

        console.log('[Worker] Model loaded successfully');
        postMessage({ type: 'debug', message: 'Model loaded successfully' });
        postMessage({
            type: 'ready',
            data: {
                hasWebGPU,
                isMultithread: wllama.isMultithread(),
                threads: wllama.getNumThreads()
            }
        });
    } catch (error) {
        console.error('[Worker] Error loading model:', error);
        postMessage({
            type: 'error',
            message: error.message || 'Failed to load model',
            debug: error.stack
        });
    }
}

async function runCompletion(messages, config, jobId) {
    if (!wllama || !wllama.isModelLoaded()) {
        throw new Error('Model is not loaded yet');
    }

    let abortController;
    if (jobId === 'title_gen') {
        if (titleAbortController) {
            titleAbortController.abort();
        }
        titleAbortController = new AbortController();
        abortController = titleAbortController;
    } else {
        if (currentAbortController) {
            currentAbortController.abort();
        }
        currentAbortController = new AbortController();
        abortController = currentAbortController;
    }

    // Mutex lock: wait for any previous generation to finish
    while (isBusy) {
        if (abortController.signal.aborted) return;
        await new Promise(r => setTimeout(r, 40));
    }
    isBusy = true;

    try {
        // Construct OpenAI-compatible messages array
        const formattedMessages = [];
        if (config?.systemPrompt && jobId !== 'title_gen') {
            formattedMessages.push({ role: 'system', content: config.systemPrompt });
        }

        for (const msg of messages) {
            formattedMessages.push({
                role: msg.role === 'assistant' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user'),
                content: msg.content
            });
        }

        const maxTokens = config?.maxTokens || (jobId === 'title_gen' ? 24 : 2048);
        const temperature = config?.temperature ?? (jobId === 'title_gen' ? 0.3 : 0.1);
        const topP = config?.topP ?? 0.95;
        const topK = config?.topK ?? 50;

        const startTime = performance.now();
        let firstTokenTime = 0;
        let nTokens = 0;
        let fullResponse = '';

        const hasChatTemplate = !!wllama.getChatTemplate();

        if (hasChatTemplate) {
            // Use modern OAI-compatible createChatCompletion streaming when chat template is available
            const stream = await wllama.createChatCompletion({
                messages: formattedMessages,
                stream: true,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
                top_k: topK,
                abortSignal: abortController.signal,
            });

            let isInReasoning = false;
            for await (const chunk of stream) {
                if (abortController.signal.aborted) break;

                const choice = chunk.choices?.[0];
                const delta = choice?.delta;
                const reasoningText = delta?.reasoning_content;
                const contentText = delta?.content;

                let tokenPiece = '';

                if (reasoningText) {
                    // Suppress reasoning tokens for title_gen so title never gets think content
                    if (jobId !== 'title_gen') {
                        if (!isInReasoning) {
                            isInReasoning = true;
                            tokenPiece += '<think>\n';
                        }
                        tokenPiece += reasoningText;
                    }
                } else if (contentText) {
                    if (isInReasoning && jobId !== 'title_gen') {
                        isInReasoning = false;
                        tokenPiece += '\n</think>\n\n';
                    }
                    tokenPiece += contentText;
                }

                if (tokenPiece) {
                    if (nTokens === 0) {
                        firstTokenTime = performance.now();
                    }
                    nTokens++;
                    fullResponse += tokenPiece;
                    postMessage({ type: 'token', data: { token: tokenPiece, jobId } });
                }
            }

            if (isInReasoning && jobId !== 'title_gen') {
                const closeTag = '\n</think>\n\n';
                fullResponse += closeTag;
                postMessage({ type: 'token', data: { token: closeTag, jobId } });
            }
        } else {
            // Model does not have an embedded jinja chat template (e.g. Liquid LFM2.5).
            // Format prompt manually and use createCompletion to avoid WASM chat_templates assert.
            let promptStr = '';
            if (config?.systemPrompt && jobId !== 'title_gen') {
                promptStr += `<|start_header_id|>system<|end_header_id|>\n\n${config.systemPrompt}<|eot_id|>`;
            }
            for (const msg of formattedMessages) {
                if (msg.role !== 'system') {
                    promptStr += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
                }
            }
            promptStr += `<|start_header_id|>assistant<|end_header_id|>\n\n`;

            await wllama.createCompletion({
                prompt: promptStr,
                n_predict: maxTokens,
                sampling: {
                    temp: temperature,
                    top_p: topP,
                    top_k: topK,
                },
                use_cache: true,
                onNewToken: (token, piece) => {
                    if (abortController.signal.aborted) return;
                    if (nTokens === 0) {
                        firstTokenTime = performance.now();
                    }
                    nTokens++;
                    fullResponse += piece;
                    postMessage({ type: 'token', data: { token: piece, jobId } });
                }
            });
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const ttft = firstTokenTime ? (firstTokenTime - startTime) : 0;
        const tps = duration > 0 ? (nTokens / (duration / 1000)) : 0;

        if (abortController.signal.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        }

        if (jobId === 'title_gen') {
            titleAbortController = null;
        } else {
            currentAbortController = null;
        }

        postMessage({
            type: 'complete',
            data: {
                text: fullResponse,
                jobId,
                stats: {
                    duration,
                    ttft,
                    tps,
                    nTokens
                }
            }
        });
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error('[Worker] Completion Error:', e);
            postMessage({ type: 'error', data: { error: e.message, jobId } });
        } else {
            postMessage({ type: 'aborted', data: { jobId } });
        }
    } finally {
        isBusy = false;
    }
}

self.onmessage = async (e) => {
    const { type, data } = e.data;
    const action = e.data.action || type;

    try {
        switch (action) {
            case 'init':
                await initialize(data?.modelConfig);
                break;

            case 'chat':
                await runCompletion(data.messages, data.config, data.jobId);
                break;

            case 'abort':
                if (currentAbortController) {
                    currentAbortController.abort();
                    currentAbortController = null;
                }
                break;

            case 'abort_title':
                if (titleAbortController) {
                    titleAbortController.abort();
                    titleAbortController = null;
                }
                break;

            case 'check_cache': {
                try {
                    const instance = getWllamaInstance();
                    const entries = await instance.cacheManager.list();
                    const cachedUrls = entries.map(e => e.metadata?.originalURL).filter(Boolean);
                    postMessage({ type: 'cache_status', cachedUrls });
                } catch (err) {
                    console.warn('[Worker] Failed to check cache status:', err);
                    postMessage({ type: 'cache_status', cachedUrls: [] });
                }
                break;
            }

            case 'download': {
                const { url } = data || e.data;
                if (!url) throw new Error('Download URL required');

                downloadAbortController = new AbortController();
                const instance = getWllamaInstance();

                let retries = 4;
                let lastErr = null;

                while (retries > 0) {
                    try {
                        await instance.modelManager.downloadModel(
                            { url },
                            {
                                signal: downloadAbortController.signal,
                                progressCallback: ({ loaded, total }) => {
                                    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
                                    postMessage({
                                        type: 'progress',
                                        loaded,
                                        total,
                                        percentage
                                    });
                                }
                            }
                        );
                        lastErr = null;
                        break;
                    } catch (err) {
                        lastErr = err;
                        if (downloadAbortController.signal.aborted) {
                            break;
                        }
                        const isLockError = err.message && (
                            err.message.includes('createSyncAccessHandle') ||
                            err.message.includes('Access Handles cannot be created')
                        );
                        if (isLockError && retries > 1) {
                            console.warn(`[Worker] OPFS lock contention, retrying in 400ms... (${retries - 1} left)`);
                            await new Promise(r => setTimeout(r, 400));
                            retries--;
                        } else {
                            throw err;
                        }
                    }
                }

                if (lastErr) throw lastErr;

                postMessage({ type: 'download_complete', url });
                break;
            }

            case 'download-abort':
                if (downloadAbortController) {
                    downloadAbortController.abort();
                    downloadAbortController = null;
                }
                break;

            case 'list_models': {
                try {
                    const instance = getWllamaInstance();
                    const entries = await instance.cacheManager.list();
                    const models = entries.map(entry => {
                        const originalUrl = entry.metadata?.originalURL || '';
                        let displayName = entry.name;
                        if (originalUrl) {
                            const filename = originalUrl.split('/').pop().replace(/\?.*$/, '');
                            displayName = filename;
                        }
                        return {
                            name: displayName,
                            cacheName: entry.name,
                            size: entry.size || entry.metadata?.originalSize || 0,
                            url: originalUrl,
                        };
                    });
                    postMessage({ type: 'models_list', models });
                } catch (err) {
                    console.warn('[Worker] Failed to list models:', err);
                    postMessage({ type: 'models_list', models: [] });
                }
                break;
            }

            case 'delete_model': {
                const { cacheName } = data || {};
                try {
                    const instance = getWllamaInstance();
                    if (cacheName) {
                        await instance.cacheManager.delete(cacheName);
                    }
                    postMessage({ type: 'model_deleted', cacheName });
                } catch (err) {
                    console.error('[Worker] Failed to delete model:', err);
                }
                break;
            }

            case 'clear_cache': {
                try {
                    const instance = getWllamaInstance();
                    await instance.cacheManager.clear();
                    postMessage({ type: 'cleared' });
                } catch (err) {
                    console.error('[Worker] Failed to clear cache:', err);
                }
                break;
            }

            default:
                console.warn('[Worker] Unknown action:', action);
        }
    } catch (err) {
        console.error('[Worker] Error handling message:', err);
        postMessage({ type: 'error', message: err.message });
    }
};
