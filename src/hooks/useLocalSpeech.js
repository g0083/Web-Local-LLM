
import { useState, useEffect, useRef, useCallback } from 'react';
import { localSpeech } from '../services/localSpeech';

export default function useLocalSpeech(config = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState(''); // Whisper usually gives final chunks, but maybe streaming later
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isInit, setIsInit] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(null); // { status, name, file, progress, loaded, total }
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(true); // Can verify wasm support

    // Config properties
    const processorRef = useRef(null);
    const streamRef = useRef(null);
    const contextRef = useRef(null);

    // Initialize models if requested
    const initModels = async () => {
        setDownloadProgress({ status: 'initiating', message: 'Starting download...' });

        try {
            // Init STT
            await localSpeech.initSTT((progress) => {
                setDownloadProgress({ type: 'STT', ...progress });
            });
        } catch (e) {
            console.error(e);
            setError('Failed to load local STT model: ' + e.message);
            setDownloadProgress(null);
            return;
        }

        try {
            // Init TTS
            await localSpeech.initTTS((progress) => {
                setDownloadProgress({ type: 'TTS', ...progress });
            });
        } catch (e) {
            console.warn('Failed to load local TTS model (suppressed):', e);
            // Suppress error for TTS as requested by user
        }

        setIsInit(true);
        setDownloadProgress(null);
    };

    // Microphone handling
    // Re-implementing startListening to use BufferRef
    const bufferRef = useRef([]);

    const startRecording = useCallback(async () => {
        if (!isInit) {
            // Auto-init? Or error?
            await initModels();
        }

        try {
            bufferRef.current = []; // Clear previous
            setTranscript('');

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const context = localSpeech.getAudioContext();
            contextRef.current = context;
            await context.resume();

            const source = context.createMediaStreamSource(stream);
            // 4096 samples @ 16kHz = ~0.25s
            const processor = context.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(context.destination);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                bufferRef.current.push(new Float32Array(inputData));
            };

            setIsListening(true);
        } catch (e) {
            setError(' Mic Error: ' + e.message);
        }
    }, [isInit]);

    const stopRecording = useCallback(async () => {
        setIsListening(false); // UI update

        // Stop hardware
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        // Merge buffer
        const chunks = bufferRef.current;
        if (chunks.length === 0) return;

        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        // Request Transcription
        try {
            // Downsample if needed? AudioContext 'sampleRate' option in localSpeech service handles this hopefully, 
            // but navigator.mediaDevices uses system rate (usually 44.1 or 48k).
            // Whisper expects 16k.
            // We must resample.

            // Simple resampling (Decimation? Linear Interpolation?)
            // Or use OfflineAudioContext to submit resample job.
            const systemRate = contextRef.current.sampleRate;
            let finalAudio = merged;

            if (systemRate !== 16000) {
                finalAudio = await resampleTo16k(merged, systemRate);
            }

            const text = await localSpeech.transcribe(finalAudio);
            setTranscript(text);
            if (config.onFinalResult) {
                config.onFinalResult(text);
            }
        } catch (e) {
            setError('Transcription failed: ' + e.message);
        }

    }, [config]);

    const speak = useCallback(async (text) => {
        if (!isInit) await initModels(); // Lazy init for TTS too

        try {
            setIsSpeaking(true);
            await localSpeech.speak(text);
            setIsSpeaking(false);
        } catch (e) {
            console.error(e);
            setIsSpeaking(false);
        }
    }, [isInit]);

    const stopSpeaking = useCallback(() => {
        localSpeech.stopAudio();
        setIsSpeaking(false);
    }, []);

    // Helper: Resample
    async function resampleTo16k(audioData, sampleRate) {
        if (sampleRate === 16000) return audioData;

        const ratio = sampleRate / 16000;
        const newLength = Math.round(audioData.length / ratio);
        const result = new Float32Array(newLength);

        const offlineCtx = new OfflineAudioContext(1, newLength, 16000);
        const buffer = offlineCtx.createBuffer(1, audioData.length, sampleRate);
        buffer.copyToChannel(audioData, 0);

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start();

        const renderedBuffer = await offlineCtx.startRendering();
        return renderedBuffer.getChannelData(0);
    }

    return {
        isListening,
        transcript,
        interimTranscript, // Whisper Tiny Non-streaming doesn't support interim yet easily
        startListening: startRecording, // Alias
        stopListening: stopRecording,
        resetTranscript: () => setTranscript(''),
        speak,
        stopSpeaking,
        isSpeaking,
        error,
        isSupported,
        isInit,
        initModels,
        downloadProgress
    };
}
