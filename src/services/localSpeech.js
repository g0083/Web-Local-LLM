
import { pipeline, env } from '@xenova/transformers';

// Skip local check to download from Hugging Face Hub (default behavior for browser)
env.allowLocalModels = false;
env.useBrowserCache = true;
// env.remoteHost = 'https://huggingface.co/';
// env.remotePathTemplate = '{model}/resolve/{revision}/{file}';

console.log('LocalSpeechService: env.allowLocalModels set to', env.allowLocalModels);

class LocalSpeechService {
    constructor() {
        this.sttPipeline = null;
        this.ttsPipeline = null;
        this.isSttLoading = false;
        this.isTtsLoading = false;
        this.audioContext = null;
    }

    // Initialize Audio Context (needed for microphone stream processing)
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }
        return this.audioContext;
    }

    async initSTT(progressCallback) {
        if (this.sttPipeline) return this.sttPipeline;
        if (this.isSttLoading) return null; // Prevent double load

        // We disable browser cache to prevent loading previously cached 'index.html' files
        env.useBrowserCache = false;
        env.allowLocalModels = false;
        // Point local path to something that won't resolve to index.html if possible, or just rely on allowLocalModels
        env.localModelPath = '/__invalid_model_path_to_force_remote__/';

        // Configure environment
        env.allowLocalModels = false;
        env.useBrowserCache = false;
        // Force remote by setting invalid local path, just in case
        env.localModelPath = '/__invalid_model_path_to_force_remote__/';

        // Suppress verbose ONNX warnings (reverted to 'error' to fix crash)
        env.backends.onnx.logLevel = 'error';

        this.isSttLoading = true;
        try {
            console.log('Loading Whisper model...');
            // 'Xenova/whisper-tiny' is ~40MB quantized
            this.sttPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
                progress_callback: progressCallback
            });
            console.log('Whisper model loaded.');
            return this.sttPipeline;
        } catch (error) {
            console.error('Failed to load STT:', error);
            throw error;
        } finally {
            this.isSttLoading = false;
        }
    }

    // Transcribe audio using the loaded pipeline
    // audio: Float32Array or AudioBuffer
    async transcribe(audio, language = 'japanese') {
        if (!this.sttPipeline) throw new Error('STT not initialized');

        // whisper-tiny works best with 16kHz mono
        // The pipeline handles resampling internally usually, but best to provide float32 array

        try {
            const output = await this.sttPipeline(audio, {
                language: language,
                task: 'transcribe',
                chunk_length_s: 30,
                stride_length_s: 5
            });
            // output is { text: "..." } or array of chunks
            return output.text || '';
        } catch (e) {
            console.error('Transcription failed:', e);
            throw e;
        }
    }

    async initTTS(progressCallback) {
        if (this.ttsPipeline) return this.ttsPipeline;
        if (this.isTtsLoading) return null;

        this.isTtsLoading = true;
        try {
            console.log('Loading TTS model (MMS-JPN)...');
            // 'Xenova/mms-tts-jpn' for Japanese
            this.ttsPipeline = await pipeline('text-to-speech', 'Xenova/mms-tts-jpn', {
                progress_callback: progressCallback
            });
            console.log('TTS model loaded.');
            return this.ttsPipeline;
        } catch (error) {
            console.error('Failed to load TTS:', error);
            throw error;
        } finally {
            this.isTtsLoading = false;
        }
    }

    async speak(text) {
        if (!this.ttsPipeline) throw new Error('TTS not initialized');

        try {
            const out = await this.ttsPipeline(text);
            // out = { audio: Float32Array, sampling_rate: number }

            // Play audio
            this.playAudio(out.audio, out.sampling_rate);
            return out; // return for debug if needed
        } catch (e) {
            console.error('TTS failed:', e);
            throw e;
        }
    }

    playAudio(audioData, sampleRate) {
        if (this.currentSource) {
            this.currentSource.stop();
        }
        const ctx = this.getAudioContext();
        const buffer = ctx.createBuffer(1, audioData.length, sampleRate);
        buffer.copyToChannel(audioData, 0);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
        this.currentSource = source;

        source.onended = () => {
            if (this.currentSource === source) {
                this.currentSource = null;
            }
        };
    }

    stopAudio() {
        if (this.currentSource) {
            this.currentSource.stop();
            this.currentSource = null;
        }
    }
}

// Singleton export
export const localSpeech = new LocalSpeechService();
