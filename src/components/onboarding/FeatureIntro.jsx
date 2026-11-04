import { useState, useEffect, useRef } from 'react';
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

        // Create a prompt for the LLM to introduce the app
        const prompt = language === 'ja'
            ? `あなたはWeb Local LLMアプリのアシスタントです。このアプリの主な特徴を紹介してください。以下の機能について、親しみやすく簡潔に説明してください:\n\n${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n各機能について1-2文で説明し、全体で200文字程度にまとめてください。`
            : `You are an assistant for the Web Local LLM app. Please introduce the key features of this application. Describe the following features in a friendly and concise way:\n\n${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nKeep each feature description to 1-2 sentences, with the entire introduction around 150 words.`;

        try {
            console.log('[FeatureIntro] Starting intro generation');
            await generateIntro(prompt, (chunk) => {
                console.log('[FeatureIntro] Received chunk:', chunk, 'charCodes:', [...chunk].map(c => c.charCodeAt(0)));
                setIntroText(prev => prev + chunk);
            });
            console.log('[FeatureIntro] Intro generation complete');
            setIsGenerating(false);
            setIsComplete(true);
        } catch (error) {
            console.error('[FeatureIntro] Failed to generate introduction:', error);
            setIsGenerating(false);
            // Show a fallback message
            const fallbackMessage = language === 'ja'
                ? 'Web Local LLMへようこそ！このアプリはブラウザ内で完全にローカルに動作するAIチャットアプリです。データは外部に送信されず、プライバシーが保護されます。複数のモデルから選択でき、オフラインでも動作します。'
                : 'Welcome to Web Local LLM! This app runs entirely locally in your browser, ensuring your privacy. Choose from multiple models, customize settings, and chat offline.';
            setIntroText(fallbackMessage);
            setIsComplete(true);
        }
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-content feature-intro">
                <div className="onboarding-header">
                    <h1 className="onboarding-title">{t('featureIntro.title')}</h1>
                    <p className="onboarding-subtitle">{t('featureIntro.subtitle')}</p>
                </div>

                <div className="intro-message-container">
                    {isGenerating && introText === '' && (
                        <div className="intro-loading">
                            <div className="spinner"></div>
                            <p>{t('featureIntro.generating')}</p>
                            <p className="local-llm-indicator">🤖 {getLanguage() === 'ja' ? 'ローカルLLMで生成中...' : 'Generating with Local LLM...'}</p>
                        </div>
                    )}

                    {isGenerating && introText !== '' && (
                        <div className="local-llm-indicator-small">
                            🤖 {getLanguage() === 'ja' ? 'ローカルLLMで生成中...' : 'Generating with Local LLM...'}
                        </div>
                    )}

                    {introText && (
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
                                {introText}
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
