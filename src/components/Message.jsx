import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { t } from '../utils/i18n';

// Markdown renderer with code highlighting
const MarkdownContent = ({ children }) => {
    return (
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
                        <code className={`inline-code ${className || ''}`} {...props}>
                            {children}
                        </code>
                    );
                },
            }}
        >
            {children}
        </ReactMarkdown>
    );
};

const ThinkingBlock = ({ content, isComplete }) => {
    const [isOpen, setIsOpen] = useState(false); // Default collapsed
    const contentRef = React.useRef(null);

    // Auto-scroll to bottom if collapsed (to show last lines)
    React.useEffect(() => {
        if (!isOpen && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [content, isOpen]);

    return (
        <div className={`thinking-block ${isOpen ? 'open' : 'closed'}`}>
            <div className="thinking-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{isOpen ? '▼' : '▶'}</span>
                <span>Thinking Process {isComplete ? '(Complete)' : '...'}</span>
            </div>
            <div
                className="thinking-content"
                ref={contentRef}
            >
                {content ? <MarkdownContent>{content}</MarkdownContent> : <span className="animate-pulse">Analyzing...</span>}
            </div>
        </div>
    );
};

export default function Message({ role, content, timestamp, stats, onEdit, onRegenerate, onSpeak, isSpeaking }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);

    const parsedContent = useMemo(() => {
        if (isEditing) return { thinking: null, text: editContent }; // Don't parse while editing

        if (role !== 'assistant') return { thinking: null, text: content };

        const thinkStart = content.indexOf('<think>');
        if (thinkStart === -1) return { thinking: null, text: content };

        const thinkEnd = content.indexOf('</think>');

        if (thinkEnd !== -1) {
            // Completed thinking block
            const thinkContent = content.slice(thinkStart + 7, thinkEnd);
            const restContent = content.slice(0, thinkStart) + content.slice(thinkEnd + 8);
            return { thinking: thinkContent, text: restContent.trim(), isThinkingComplete: true };
        } else {
            // In-progress thinking block
            const thinkContent = content.slice(thinkStart + 7);
            const preContent = content.slice(0, thinkStart);
            return { thinking: thinkContent, text: preContent.trim(), isThinkingComplete: false };
        }
    }, [content, role, isEditing, editContent]);

    const handleSave = () => {
        if (editContent.trim() !== content) {
            onEdit(editContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(content);
        setIsEditing(false);
    };

    const timeString = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const statsString = stats && stats.tps
        ? `${Math.round(1000 / stats.tps)}ms/t, ${stats.tps.toFixed(2)} t/s, ${Math.round(stats.ttft || 0)}ms TTFT`
        : '';

    return (
        <div className={`message-container ${role}`}>
            <div className={`message ${role}`}>
                {isEditing ? (
                    <div className="edit-container">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                        />
                        <div className="edit-actions">
                            <button onClick={handleSave} className="save-btn">{t('common.save')}</button>
                            <button onClick={handleCancel} className="cancel-btn">{t('common.cancel')}</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {parsedContent.thinking !== null && (
                            <ThinkingBlock
                                content={parsedContent.thinking}
                                isComplete={parsedContent.isThinkingComplete}
                            />
                        )}
                        {parsedContent.text && parsedContent.text.trim() && (
                            <div className="message-content">
                                {role === 'assistant' ? (
                                    <MarkdownContent>{parsedContent.text}</MarkdownContent>
                                ) : (
                                    parsedContent.text
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="message-meta">
                {statsString && <span className="message-stats">{statsString}</span>}
                {timeString && <span className="message-time">{timeString}</span>}
                {!isEditing && role === 'assistant' && onSpeak && (
                    <button onClick={onSpeak} className="speaker-btn" title={isSpeaking ? t('chat.stop') : t('chat.speak')}>
                        {isSpeaking ? '⏹' : '🔊'}
                    </button>
                )}
                {!isEditing && role === 'user' && onEdit && (
                    <button onClick={() => setIsEditing(true)} className="text-action-btn">{t('common.edit')}</button>
                )}
                {!isEditing && role === 'assistant' && onRegenerate && (
                    <button onClick={onRegenerate} className="text-action-btn">{t('chat.regenerate')}</button>
                )}
            </div>
        </div>
    );
}

