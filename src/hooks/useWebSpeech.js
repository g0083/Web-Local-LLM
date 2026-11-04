import { useState, useEffect, useRef, useCallback } from 'react';

export default function useWebSpeech(config = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef(null);
    const synthesisRef = useRef(window.speechSynthesis);
    const configRef = useRef(config);

    // Update config ref when config changes
    useEffect(() => {
        configRef.current = config;
        if (recognitionRef.current && config.recognitionLanguage) {
            recognitionRef.current.lang = config.recognitionLanguage;
        }
    }, [config]);

    useEffect(() => {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition && window.speechSynthesis) {
            setIsSupported(true);
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = config.recognitionLanguage || 'ja-JP';

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setError(null);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current.onresult = (event) => {
                let final = '';
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }
                if (final) {
                    setTranscript(prev => prev + final);
                    // Trigger callback if provided
                    if (configRef.current && configRef.current.onFinalResult) {
                        configRef.current.onFinalResult(final);
                    }
                }
                setInterimTranscript(interim);
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                if (event.error === 'not-allowed') {
                    setError('Microphone access denied.');
                } else if (event.error === 'network') {
                    setError('Network error: Speech API requires internet connection.');
                } else {
                    setError(`Error: ${event.error}`);
                }
                setIsListening(false);
            };
        } else {
            setIsSupported(false);
            setError('Web Speech API is not supported in this browser.');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (synthesisRef.current) {
                synthesisRef.current.cancel();
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported || !recognitionRef.current) return;

        // Reset transcript to prevent previous text from persisting
        setTranscript('');
        setInterimTranscript('');

        // Check internet connection roughly (navigator.onLine is not perfect but good first check)
        if (!navigator.onLine) {
            setError('OFFLINE: Speech Recognition requires an internet connection.');
            return;
        }

        try {
            recognitionRef.current.start();
            setError(null);
        } catch (e) {
            console.error(e);
        }
    }, [isSupported]);

    const stopListening = useCallback(() => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    const speak = useCallback((text, shouldInterrupt = true) => {
        if (!isSupported || !synthesisRef.current) return;

        // Stop listening while speaking to prevent self-hearing
        if (recognitionRef.current) recognitionRef.current.stop();

        // Cancel existing speech only if interrupt requested
        if (shouldInterrupt) {
            synthesisRef.current.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = navigator.language || 'en-US';

        // Apply Voice Settings
        if (config) {
            console.log('[useWebSpeech] Applying config:', config);
            if (config.voiceVolume !== undefined) utterance.volume = config.voiceVolume;
            if (config.voiceRate !== undefined) utterance.rate = config.voiceRate;
            if (config.voicePitch !== undefined) utterance.pitch = config.voicePitch;

            if (config.voiceName) {
                const voices = synthesisRef.current.getVoices();
                const selectedVoice = voices.find(v => v.name === config.voiceName);
                if (selectedVoice) {
                    console.log('[useWebSpeech] Selected voice:', selectedVoice.name);
                    utterance.voice = selectedVoice;
                } else {
                    console.warn('[useWebSpeech] Configured voice not found:', config.voiceName);
                }
            }
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            // Only turn off speaking state if queue is empty
            if (synthesisRef.current && !synthesisRef.current.pending) {
                setIsSpeaking(false);
            }
        };
        utterance.onerror = (e) => {
            console.error('Speech synthesis error', e);
            setIsSpeaking(false); // On error, we probably want to reset
            if (e.error !== 'canceled') {
                // network error isn't usually a thing for synthesis unless using remote voices, but good to know
            }
        };

        synthesisRef.current.speak(utterance);
    }, [isSupported, config]);

    const stopSpeaking = useCallback(() => {
        if (synthesisRef.current) {
            synthesisRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        speak,
        stopSpeaking,
        isSpeaking,
        error,
        isSupported
    };
}
