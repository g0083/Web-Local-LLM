import { useState, useEffect, useRef, useMemo } from 'react';
import { t, getLanguage } from '../../utils/i18n';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const FeatureIntro = ({ onComplete, onSkip, generateIntro }) => {
    const [introText, setIntroText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (!hasStartedRef.current && generateIntro) {
            hasStartedRef.current = true;
            startGeneration();
        }
    }, [generateIntro]);

    const startGeneration = async () => {
        setIsGenerating(true);

        const language = getLanguage();
        const features = t('features');

        // Create a prompt for the LLM to introduce the app directly
        const prompt = language === 'ja'
            ? `あなたはWeb Local LLMアプリのアシスタントです。このアプリの主な特徴を紹介してください。以下の機能について、親しみやすく簡潔に説明してください:\n\n${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n各機能について1-2文で説明し、全体で200文字程度にまとめてください。`
            : `You are an assistant for the Web Local LLM app. Please introduce the key features of this application. Describe the following features in a friendly and concise way:\n\n${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nKeep each feature description to 1-2 sentences, with the entire introduction around 150 words.`;

        try {
            console.log('[FeatureIntro] Starting intro generation');
            await generateIntro(prompt, (chunk) => {
                setIntroText(prev => prev + chunk);
            });
            console.log('[FeatureIntro] Intro generation complete');
            setIsGenerating(false);
            setIntroText(prev => {
                const clean = prev ? prev.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*/gi, '').trim() : '';
                if (!clean) {
                    const fallbackMessage = language === 'ja'
                        ? 'Web Local LLMへようこそ！このアプリはブラウザ内で完全にローカルに動作するAIチャットアプリです。データは外部に送信されず、プライバシーが保護されます。複数のモデルから選択でき、オフラインでも動作します。'
                        : 'Welcome to Web Local LLM! This app runs entirely locally in your browser, ensuring your privacy. Choose from multiple models, customize settings, and chat offline.';
                    return prev ? `${prev}\n\n${fallbackMessage}` : fallbackMessage;
                }
                return prev;
            });
            setIsComplete(true);
        } catch (error) {
            console.error('[FeatureIntro] Failed to generate introduction:', error);
            setIsGenerating(false);
            const fallbackMessage = language === 'ja'
                ? 'Web Local LLMへようこそ！このアプリはブラウザ内で完全にローカルに動作するAIチャットアプリです。データは外部に送信されず、プライバシーが保護されます。複数のモデルから選択でき、オフラインでも動作します。'
                : 'Welcome to Web Local LLM! This app runs entirely locally in your browser, ensuring your privacy. Choose from multiple models, customize settings, and chat offline.';
            setIntroText(fallbackMessage);
            setIsComplete(true);
        }
    };

    const parsedIntro = useMemo(() => {
        if (!introText) return { thinking: null, text: '' };

        const thinkStart = introText.indexOf('<think>');
        if (thinkStart === -1) {
            return { thinking: null, text: introText };
        }

        const thinkEnd = introText.indexOf('</think>');
        if (thinkEnd !== -1) {
            const thinkContent = introText.slice(thinkStart + 7, thinkEnd).trim();
            const restContent = (introText.slice(0, thinkStart) + introText.slice(thinkEnd + 8)).trim();
            return { thinking: thinkContent, text: restContent, isComplete: true };
        } else {
            const thinkContent = introText.slice(thinkStart + 7).trim();
            const preContent = introText.slice(0, thinkStart).trim();
            return { thinking: thinkContent, text: preContent, isComplete: false };
        }
    }, [introText]);

    return (
        <div className="onboarding-container">
            <div className="onboarding-content feature-intro">
                <div className="onboarding-header">
                    <h1 className="onboarding-title">{t('featureIntro.title')}</h1>
                    <p className="onboarding-subtitle">{t('featureIntro.subtitle')}</p>
                </div>

                <div className="intro-message-container">
                    {/* Collapsible Thinking Process if model used thinking */}
                    {parsedIntro.thinking && (
                        <div style={{ marginBottom: '14px', width: '100%' }}>
                            <details style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 500 }}>
                                    🧠 {getLanguage() === 'ja' ? '思考プロセス' : 'Thinking Process'} {parsedIntro.isComplete ? (getLanguage() === 'ja' ? '(完了)' : '(Complete)') : '...'}
                                </summary>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '8px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', lineHeight: '1.4' }}>
                                    {parsedIntro.thinking}
                                </div>
                            </details>
                        </div>
                    )}

                    {/* Loading indicator when waiting or thinking before final text */}
                    {isGenerating && !parsedIntro.text && (
                        <div className="intro-loading">
                            <div className="spinner"></div>
                            <p>{parsedIntro.thinking ? (getLanguage() === 'ja' ? '思考中... もうすぐ紹介文が完成します' : 'Thinking... Almost ready') : t('featureIntro.generating')}</p>
                            <p className="local-llm-indicator">🤖 {getLanguage() === 'ja' ? 'ローカルLLMで生成中...' : 'Generating with Local LLM...'}</p>
                        </div>
                    )}

                    {isGenerating && parsedIntro.text && (
                        <div className="local-llm-indicator-small" style={{ marginBottom: '8px' }}>
                            🤖 {getLanguage() === 'ja' ? 'ローカルLLMで生成中...' : 'Generating with Local LLM...'}
                        </div>
                    )}

                    {/* Main introduction content */}
                    {parsedIntro.text && (
                        <div className="intro-message">
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    code({ node, inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <SyntaxHighlighter
                                                style={oneDark}
                                                language={match[1]}
                                                PreTag="div"
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        );
                                    }
                                }}
                            >
                                {parsedIntro.text}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                <div className="intro-actions">
                    {!isComplete && (
                        <button
                            className="onboarding-skip-btn"
                            onClick={onSkip}
                        >
                            {t('featureIntro.skip')}
                        </button>
                    )}

                    {isComplete && (
                        <button
                            className="onboarding-continue-btn"
                            onClick={onComplete}
                        >
                            {t('featureIntro.getStarted')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeatureIntro;
