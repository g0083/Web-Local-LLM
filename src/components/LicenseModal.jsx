import React from 'react';

export default function LicenseModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="glass glass-panel modal-content" style={{ maxWidth: '700px', maxHeight: '85vh' }}>
                <div className="modal-header">
                    <h3>License Information</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="modal-body">
                    {/* Creator Attribution */}
                    <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        marginBottom: '20px',
                        background: 'rgba(52, 211, 153, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(52, 211, 153, 0.3)'
                    }}>
                        <h2 style={{ margin: '0 0 8px', color: 'var(--color-accent)', fontSize: '1.3rem' }}>
                            Created by O-ya Tech
                        </h2>
                        <a
                            href="https://g0083.github.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.95rem' }}
                        >
                            🔗 https://g0083.github.io
                        </a>
                    </div>

                    {/* LLM Models */}
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ color: 'var(--color-accent)', marginBottom: '12px' }}>🤖 AI Models</h4>

                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <h5 style={{ margin: '0 0 8px' }}>LFM3-1.7B (Default)</h5>
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                Tri-hybrid model by <strong>Liquid AI</strong> (Integrated Thinking & Chat)
                            </p>
                            <a
                                href="https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.85rem', color: 'var(--color-accent)' }}
                            >
                                View on Hugging Face →
                            </a>
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>License: Apache 2.0 / Liquid Community License</p>
                        </div>

                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <h5 style={{ margin: '0 0 8px' }}>LFM2.5-1.2B (Legacy)</h5>
                            <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                Model by <strong>Liquid AI</strong>
                            </p>
                            <a
                                href="https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.85rem', color: 'var(--color-accent)' }}
                            >
                                View on Hugging Face →
                            </a>
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>License: Apache 2.0</p>
                        </div>
                    </div>

                    {/* Core Dependencies */}
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ color: 'var(--color-accent)', marginBottom: '12px' }}>📦 Core Libraries</h4>

                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>React</strong> (v19.2.0) - MIT License
                            </div>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>@wllama/wllama</strong> (v2.3.7) - MIT License
                                <br />
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    WebAssembly-based LLM inference engine
                                </span>
                            </div>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>localforage</strong> (v1.10.0) - Apache 2.0 License
                            </div>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>react-markdown</strong> (v10.1.0) - MIT License
                            </div>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>react-syntax-highlighter</strong> (v16.1.0) - MIT License
                            </div>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>KaTeX</strong> (v0.16.27) - MIT License
                            </div>
                        </div>
                    </div>

                    {/* Build Tools */}
                    <div>
                        <h4 style={{ color: 'var(--color-accent)', marginBottom: '12px' }}>🛠️ Build Tools</h4>
                        <div style={{ display: 'grid', gap: '8px', fontSize: '0.9rem' }}>
                            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                <strong>Vite</strong> (v7.2.4) - MIT License
                            </div>
                        </div>
                    </div>

                    <div style={{
                        marginTop: '24px',
                        padding: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: 'var(--color-text-muted)'
                    }}>
                        <p style={{ margin: 0 }}>
                            This application is built with open-source software. All licenses are provided by their respective owners.
                            For full license texts, please visit the project repositories.
                        </p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="save-btn">Close</button>
                </div>
            </div>
        </div>
    );
}
