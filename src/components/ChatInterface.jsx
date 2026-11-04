import React, { useState, useEffect, useRef } from 'react';
import Message from './Message';
import SettingsModal from './SettingsModal';
import { t } from '../utils/i18n';
import LiveOverlay from './LiveOverlay';
import useWebSpeech from '../hooks/useWebSpeech';
import useLocalSpeech from '../hooks/useLocalSpeech';

export default function ChatInterface({
    engine,
    onToggleSidebar,
    onOpenGlobalSettings,
    onNewSession,
    isSidebarOpen,
    onRedownload,
    showInstall,
    onInstall
}) {
    const { isReady, isGenerating, isTitleGenerating, messages, currentResponse, currentStats, chat, stop, edit, regenerate, setMessages, error, currentSessionId, sessions, updateSessionTitle, updateSessionPin, removeSession } = engine;
    const [input, setInput] = useState('');
    const [isSessionSettingsOpen, setIsSessionSettingsOpen] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(null);

    // Live Mode State
    const [isLiveMode, setIsLiveMode] = useState(false);

    // We use a ref to access the *current* active speech interface inside callbacks
    // without worrying about closure staleness or circular dependencies during render.
    // However, for simple functions like check active, we can just use the config.

    // Callback to handle final result from either provider
    const handleFinalResult = (finalText) => {
        if (isLiveMode && finalText) {
            chat(finalText);

            // Clear transcript logic
            // We need to clear the specific hook's transcript.
            // Since we can't easily access the 'activeSpeech' variable here before it's defined (if we rely on standard scoping),
            // and we can't move this below definition because hooks need it...
            // We'll rely on the fact effectively 'activeSpeech' is derived from config.

            // Actually, we can just call querySelector logic? No.
            // We will hack it: the hooks return 'resetTranscript'.
            // The hooks are defined below.
            // We can wrap this logic in a useEffect? 
            // Or easier: useWebSpeech/useLocalSpeech don't need 'handleFinalResult' to clear transcript?
            // They accumulate.

            // Let's defer clearing to a separate effect or use a Ref for the reset function.
        }
    };

    // Initialize both hooks (Rules of Hooks: must call unconditionally)
    // We pass handleFinalResult. 
    // IMPORTANT: To clear transcript, we will handle it via the 'activeSpeech' object AFTER it is defined 
    // by using a useEffect that watches 'transcript' or 'handleFinalResult'? 
    // No, that's messy.

    // Simplest: Define hooks.
    const webSpeech = useWebSpeech({ ...engine.config, onFinalResult: handleFinalResult });
    const localSpeechHook = useLocalSpeech({ ...engine.config, onFinalResult: handleFinalResult });

    // Select active interface
    const activeSpeech = engine.config.useLocalSpeech ? localSpeechHook : webSpeech;

    // Destructure from active interface
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        speak,
        stopSpeaking,
        isSpeaking,
        error: speechError,
        isSupported: isSpeechSupported,
        downloadProgress // specific to local
    } = activeSpeech;

    // NOW we can fix the resetTranscript issue.
    // When 'handleFinalResult' fires, we want to call 'resetTranscript'.
    // But 'handleFinalResult' is passed TO the hooks.
    // The hooks probably call 'onFinalResult' and THEN might expect us to clear?
    // In useWebSpeech, it doesn't clear automatically? The original code had explicit 'resetTranscript()'.

    // Solution: We can't easily modify 'handleFinalResult' to call 'resetTranscript' because of scope.
    // BUT we can use a Ref that points to the current 'resetTranscript' function!
    const resetTranscriptRef = useRef(resetTranscript);
    useEffect(() => {
        resetTranscriptRef.current = resetTranscript;
    }, [resetTranscript]);

    // Redefine callback using Ref? 
    // No, we passed the const function 'handleFinalResult' to hooks. 
    // If we change it, hooks might re-init (depending on their dependency array).
    // Let's look at how we can clear it.
    // Why not just use `useEffect`?
    // If `transcript` changes to a final phrase? No, transcript accumulates.

    // Let's use a Mutable Ref for the callback itself?
    // Or simpler: The hooks shouldn't require us to pass a callback just to send text.
    // WE can watch 'transcript' changes? 
    // But 'transcript' accumulates.

    // Let's stick to the callback but use the Ref inside it.
    // We can't change the function identity passed to hooks easily without re-triggering effects.
    // So we use a stable function that calls a ref.

    const handleFinalResultStable = useRef((text) => {
        if (isLiveMode && text) {
            engine.chat(text);
            if (resetTranscriptRef.current) resetTranscriptRef.current();
        }
    });

    // We need to update the ref if 'isLiveMode' changes? 
    // The ref 'current' is the function.
    // The function needs access to current 'isLiveMode' and 'engine.chat'.
    // 'engine' is prop, stable-ish. 'isLiveMode' is state.

    // Actually, simply:
    // Pass a stable function to hooks.
    // That function calls a method on a Ref that we update.

    const onFinalResultRef = useRef(null);
    onFinalResultRef.current = (text) => {
        if (isLiveMode && text) {
            chat(text);
            if (resetTranscriptRef.current) resetTranscriptRef.current();
        }
    };

    const stableOnFinalResult = useRef((text) => {
        if (onFinalResultRef.current) onFinalResultRef.current(text);
    }).current;

    /** END HOOK FIX **/


    const [showSpeechWarning, setShowSpeechWarning] = useState(false);
    const silenceTimer = useRef(null);

    const currentSession = sessions.find(s => s.id === currentSessionId);

    // Initial Warning for Web Speech API
    useEffect(() => {
        const hasSeenWarning = localStorage.getItem('web_speech_warning_seen');
        if (!hasSeenWarning && isSpeechSupported) {
            // We'll handle this in handleMicClick
        }
    }, [isSpeechSupported]);

    // Live Mode / Speech Logic
    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    // Reset active speaker when global speaking state ends
    useEffect(() => {
        if (!isSpeaking) {
            setActiveSpeakerIndex(null);
        }
    }, [isSpeaking]);

    // Silence Detection for Live Mode
    useEffect(() => {
        if (isLiveMode && isListening && transcript) {
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
            silenceTimer.current = setTimeout(() => {
                // Silence detected (1.5s) -> Send message
                handleSendMessage();
            }, 1500);
        }
        return () => {
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
        };
    }, [transcript, isLiveMode, isListening]);

    // Real-time Speech Logic
    const spokenLengthRef = useRef(0);
    const lastGeneratedRef = useRef('');

    useEffect(() => {
        // Reset when generation starts
        if (isGenerating && !lastGeneratedRef.current) {
            spokenLengthRef.current = 0;
            lastGeneratedRef.current = 'STARTED';
        }
        if (!isGenerating) {
            lastGeneratedRef.current = '';
            spokenLengthRef.current = 0;
        }

        // Process streaming text
        if (isGenerating && engine.config.realTimeSpeech && isLiveMode && currentResponse) {
            const newText = currentResponse.slice(spokenLengthRef.current);
            // Look for sentence delimiters (punctuation or newlines)
            const delimiters = /[。、．，？！\n.?!]/;
            const match = newText.search(delimiters);

            if (match !== -1) {
                // Speak up to the delimiter (inclusive)
                const chunk = newText.slice(0, match + 1);
                if (chunk.trim()) {
                    speak(chunk, false); // false = do not interrupt queue
                }
                spokenLengthRef.current += match + 1;
            }
        }
    }, [currentResponse, isGenerating, engine.config.realTimeSpeech, speak, isLiveMode]);


    // Live Mode Loop: Speak response when generation finishes
    const prevIsGenerating = useRef(isGenerating);
    useEffect(() => {
        if (isLiveMode && prevIsGenerating.current && !isGenerating) {
            // Generation just finished.
            if (engine.config.realTimeSpeech) {
                // Flush remaining buffer
                const remainder = currentResponse.slice(spokenLengthRef.current);
                if (remainder.trim()) {
                    speak(remainder, false);
                }
            } else {
                // Original behavior: Speak the last message (assistant)
                const lastMsg = messages[messages.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    setActiveSpeakerIndex(messages.length - 1);
                    speak(lastMsg.content);
                }
            }
        }
        prevIsGenerating.current = isGenerating;
    }, [isGenerating, isLiveMode, messages, speak, currentResponse, engine.config.realTimeSpeech]);

    // Live Mode Loop: Listen again after speaking finishes
    const prevIsSpeaking = useRef(isSpeaking);
    useEffect(() => {
        if (isLiveMode && prevIsSpeaking.current && !isSpeaking) {
            // Finished speaking -> Start listening again
            startListening();
        }
        prevIsSpeaking.current = isSpeaking;
    }, [isSpeaking, isLiveMode, startListening]);

    const handleMicClick = () => {
        if (!isSpeechSupported) {
            alert("Web Speech API / Local Speech is not supported.");
            return;
        }
        if (isListening) {
            stopListening();
        } else {
            resetTranscript();
            startListening();
        }
    };

    const toggleLiveMode = () => {
        if (!isLiveMode) {
            // Start Live Mode
            if (!isSpeechSupported) {
                alert("Speech functionality is not available.");
                return;
            }
            setIsLiveMode(true);
            resetTranscript();
            startListening();
        } else {
            setIsLiveMode(false);
            stopListening();
            stopSpeaking();
        }
    };

    // Auto-close header menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setIsHeaderMenuOpen(false);
        if (isHeaderMenuOpen) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isHeaderMenuOpen]);

    const handleRenameStart = () => {
        setIsRenaming(true);
        setEditTitle(currentSession?.title || '');
        setIsHeaderMenuOpen(false);
    };

    const handleRenameSave = () => {
        if (editTitle.trim() && currentSessionId) {
            updateSessionTitle(currentSessionId, editTitle.trim());
        }
        setIsRenaming(false);
    };

    // Auto-scroll logic
    const listRef = useRef(null);
    const isAtBottomRef = useRef(true);

    const handleScroll = () => {
        if (!listRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        // Check if we are near the bottom (within 100px)
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        isAtBottomRef.current = isAtBottom;
    };

    // Auto-scroll - use RAF to ensure content is rendered before scrolling
    useEffect(() => {
        if (bottomRef.current && isAtBottomRef.current) {
            requestAnimationFrame(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
            });
        }
    }, [messages, currentResponse, interimTranscript]);

    const handleSendMessage = () => {
        if (input.trim() && !engine.isGenerating) {
            isAtBottomRef.current = true; // Force scroll
            chat(input.trim());
            setInput('');
            resetTranscript();
            stopListening();
        }
    };

    const handleSpeakMessage = (index, content) => {
        if (activeSpeakerIndex === index) {
            stopSpeaking();
            setActiveSpeakerIndex(null);
        } else {
            setActiveSpeakerIndex(index);
            speak(content);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleEdit = (index, newText) => {
        edit(index, newText);
    };

    const handleRegenerate = (index) => {
        regenerate(index);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || isGenerating || !isReady) return;

        chat(input.trim(), messages);
        setInput('');
    };

    const handleClear = () => {
        if (confirm('Clear messages in this session?')) {
            setMessages([]);
        }
    };

    return (
        <div className="glass glass-panel chat-area">
            {currentSession && (
                <div className="chat-header glass">
                    <div className="header-left">
                        <button
                            className="icon-btn"
                            onClick={onToggleSidebar}
                            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <span className="app-title-text">{t('chat.appTitle')}</span>
                        {showInstall && (
                            <button className="pwa-install-btn mobile" onClick={onInstall}>
                                📥 {t('ui.installApp')}
                            </button>
                        )}
                    </div>

                    <div className="header-center">
                        <div
                            className="session-title-container"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isRenaming) setIsHeaderMenuOpen(!isHeaderMenuOpen);
                            }}
                        >
                            {isRenaming ? (
                                <input
                                    autoFocus
                                    className="title-input"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={handleRenameSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="session-title-text">
                                    {isLiveMode && <span className="live-indicator">● LIVE</span>}
                                    {currentSession.isPinned && '📌 '}
                                    {isTitleGenerating && (currentSession.title === t('chat.newSession') || currentSession.title.startsWith(t('chat.newSession'))) ? (
                                        <span className="title-generating">{t('chat.generatingTitle')}</span>
                                    ) : (
                                        currentSession.title
                                    )}
                                    <span className="dropdown-arrow">▼</span>
                                </span>
                            )}

                            {isHeaderMenuOpen && !isRenaming && (
                                <div className="header-dropdown glass">
                                    <div onClick={(e) => {
                                        e.stopPropagation();
                                        setIsHeaderMenuOpen(false);
                                        updateSessionPin(currentSessionId, !currentSession.isPinned);
                                    }}>
                                        {currentSession.isPinned ? t('ui.unpinSession') : t('ui.pinSession')}
                                    </div>
                                    <div onClick={(e) => {
                                        e.stopPropagation();
                                        handleRenameStart();
                                    }}>
                                        {t('ui.renameSession')}
                                    </div>
                                    <div onClick={(e) => {
                                        e.stopPropagation();
                                        setIsHeaderMenuOpen(false);
                                        setIsSessionSettingsOpen(true);
                                    }}>
                                        {t('ui.sessionSettings')}
                                    </div>
                                    <div className="delete" onClick={(e) => {
                                        e.stopPropagation();
                                        setIsHeaderMenuOpen(false);
                                        removeSession(currentSessionId);
                                    }}>
                                        {t('ui.deleteSession')}
                                    </div>
                                </div>
                            )}

                            {showInstall && (
                                <button className="pwa-install-btn pc" onClick={onInstall}>
                                    📥 {t('ui.installApp')}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={onOpenGlobalSettings}
                            className="hw-header-indicator"
                            title={engine.hasWebGPU ? 'WebGPU Hardware Accelerated (Click to open settings)' : 'CPU WASM Mode (Click to open settings)'}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                background: engine.hasWebGPU ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                                border: engine.hasWebGPU ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(234, 179, 8, 0.4)',
                                color: engine.hasWebGPU ? '#4ade80' : '#facc15',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>{engine.hasWebGPU ? '⚡ GPU' : '⚙️ CPU'}</span>
                            <span style={{ opacity: 0.7 }}>•</span>
                            <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {engine.lmStudioConfig?.enabled ? 'LM Studio' : (engine.modelConfig?.model_name || 'Model')}
                            </span>
                        </button>
                        <button onClick={onOpenGlobalSettings} className="icon-btn" title={t('chat.globalSettings')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                        <button onClick={onNewSession} className="icon-btn" title={t('chat.newSession')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Live Mode Overlay */}
            {isLiveMode && (
                <LiveOverlay
                    isSpeaking={isSpeaking}
                    isListening={isListening}
                    onClose={toggleLiveMode}
                />
            )}

            <div className={`messages-list ${isLiveMode ? 'live-mode' : ''}`} ref={listRef} onScroll={handleScroll}>
                {messages.length === 0 && (
                    <div className="message assistant">
                        <div className="message-content">
                            {error ? (
                                <div style={{ color: '#ef4444' }}>
                                    <strong>{t('chat.modelError')}</strong><br />
                                    {error.toString()}
                                    <br /><br />
                                    {t('chat.redownloadPrompt')}
                                    <br />
                                    <button
                                        onClick={onRedownload}
                                        className="action-btn-danger"
                                        style={{ marginTop: '1rem' }}
                                    >
                                        ⚠️ {t('settings.redownloadModel')}
                                    </button>
                                </div>
                            ) : isReady ? (
                                t('chat.initialGreeting')
                            ) : (
                                t('chat.loadingModel')
                            )}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <Message
                        key={i}
                        role={msg.role}
                        content={msg.content}
                        timestamp={msg.timestamp}
                        stats={msg.stats}
                        onEdit={(newText) => handleEdit(i, newText)}
                        onRegenerate={() => handleRegenerate(i)}
                        onSpeak={isSpeechSupported ? () => handleSpeakMessage(i, msg.content) : null}
                        isSpeaking={isSpeechSupported && activeSpeakerIndex === i}
                    />
                ))}

                {isGenerating && (
                    <Message
                        role="assistant"
                        content={currentResponse || "Generating..."}
                    />
                )}

                {interimTranscript && (
                    <div className="message user opacity-70">
                        {interimTranscript}
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <div className="input-area">
                {downloadProgress && (
                    <div className="info-banner" style={{ fontSize: '0.8rem', padding: '4px 8px', marginBottom: '8px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '4px', color: '#93c5fd' }}>
                        Downloading Model ({downloadProgress.type}): {Math.round(downloadProgress.progress || 0)}%
                        {downloadProgress.status === 'done' ? ' ✅' : ''}
                    </div>
                )}
                {speechError && (
                    <div className="warning-banner" style={{ fontSize: '0.8rem', padding: '4px 8px', marginBottom: '8px' }}>
                        {speechError}
                    </div>
                )}
                <div className="input-container">
                    <textarea
                        ref={inputRef}
                        value={isListening ? (transcript || interimTranscript) : input}
                        onChange={isListening ? () => { } : (e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isListening ? "Listening..." : t('chat.placeholder')}
                        rows={1}
                        disabled={engine.isGenerating || isListening}
                    />

                    {/* Mic Button */}
                    <button
                        onClick={handleMicClick}
                        className={`mic-btn ${isListening ? 'listening' : ''}`}
                        title={isListening ? "Stop Listening" : "Start Voice Input"}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>

                    <button
                        onClick={engine.isGenerating ? stop : handleSendMessage}
                        disabled={!engine.isGenerating && !input.trim() && !transcript}
                        className={`send-btn ${engine.isGenerating ? 'stop-btn' : ''}`}
                        title={engine.isGenerating ? t('chat.stop') : t('chat.send')}
                    >
                        {engine.isGenerating ? '⏹' : '➤'}
                    </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <button onClick={handleClear} className="text-action-btn" style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('chat.clearMessages')}</button>

                    <button
                        onClick={toggleLiveMode}
                        style={{
                            backgroundColor: isLiveMode ? '#059669' : '#10b981', // Emerald 600 : Emerald 500
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '6px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: isLiveMode ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        {isLiveMode && <span className="live-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'white', display: 'inline-block' }}></span>}
                        {t('chat.interactiveMode')}
                    </button>
                </div>
            </div>

            <SettingsModal
                isOpen={isSessionSettingsOpen}
                onClose={() => setIsSessionSettingsOpen(false)}
                config={engine.config}
                onSave={engine.setConfig}
                title="Session Settings"
                isGenerating={isGenerating || isTitleGenerating}
            />
        </div>
    );
}
