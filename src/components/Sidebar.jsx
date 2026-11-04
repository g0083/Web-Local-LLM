
import React, { useState } from 'react';
import { t } from '../utils/i18n';

export default function Sidebar({
    sessions,
    currentSessionId,
    onSwitch,
    onDelete,
    onUpdateTitle,
    onTogglePin,
    onOpenSessionSettings,
    isTitleGenerating,
    isGenerating,
    isOpen,
    onClose,
    onOpenLicense,
    onNewSession
}) {
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null);
        if (menuOpenId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [menuOpenId]);

    // Combine generation states for disabling actions
    const isBusy = isGenerating || isTitleGenerating;

    const handleMenuClick = (id, e) => {
        if (isBusy) return;
        e.stopPropagation();
        setMenuOpenId(menuOpenId === id ? null : id);
    };

    const handleRenameStart = (id, currentTitle) => {
        if (isBusy) return;
        setEditingId(id);
        setEditTitle(currentTitle);
        setMenuOpenId(null);
    };

    const handleRenameSave = (id) => {
        if (editTitle.trim()) {
            onUpdateTitle(id, editTitle.trim());
        }
        setEditingId(null);
    };

    const handleSwitch = (id) => {
        if (!isBusy) {
            onSwitch(id);
            // Close sidebar on mobile
            if (window.innerWidth < 768) {
                onClose();
            }
        }
    };

    const handleSettingsClick = (id) => {
        if (isBusy) return;
        if (id !== currentSessionId) {
            onSwitch(id);
        }
        if (onOpenSessionSettings) {
            onOpenSessionSettings();
        }
        setMenuOpenId(null);
    };

    return (
        <div className={`glass glass-panel sidebar ${isOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-header" style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid var(--color-glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Hamburger button to match Chat Header position */}
                    <button
                        onClick={onClose}
                        className="icon-btn"
                        title="Close Sidebar"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    <span className="app-title-text">{t('chat.appTitle')}</span>
                </div>
            </div>

            <div style={{ padding: '10px 16px' }}>
                <button
                    onClick={() => { if (!isBusy) onNewSession(); }}
                    className="action-btn"
                    style={{ width: '100%', justifyContent: 'center', background: 'var(--color-accent)', color: '#000', fontWeight: 'bold' }}
                    disabled={isBusy}
                >
                    + {t('chat.newSession')}
                </button>
            </div>

            <div className={`session-list ${isBusy ? 'disabled' : ''}`} style={{ marginTop: '0' }}>
                {sessions.map(session => (
                    <div
                        key={session.id}
                        className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                        onClick={() => handleSwitch(session.id)}
                        style={{ cursor: isBusy ? 'not-allowed' : 'pointer', opacity: isBusy && currentSessionId !== session.id ? 0.5 : 1 }}
                    >
                        {editingId === session.id ? (
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => handleRenameSave(session.id)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRenameSave(session.id)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="session-title">
                                {session.isPinned && <span className="pin-icon">📌</span>}
                                {isTitleGenerating && currentSessionId === session.id && (session.title === t('chat.newSession') || session.title.startsWith(t('chat.newSession'))) ? (
                                    <span className="title-generating">{t('chat.generatingTitle')}</span>
                                ) : (
                                    session.title
                                )}
                            </span>
                        )}

                        <div className="session-menu-trigger" onClick={(e) => handleMenuClick(session.id, e)}>
                            ⋮
                        </div>

                        {menuOpenId === session.id && (
                            <div className="session-menu glass">
                                <div onClick={(e) => { e.stopPropagation(); onTogglePin(session.id, !session.isPinned); setMenuOpenId(null); }}>
                                    {session.isPinned ? t('ui.unpinSession') : t('ui.pinSession')}
                                </div>
                                <div onClick={(e) => { e.stopPropagation(); handleRenameStart(session.id, session.title); }}>
                                    {t('ui.renameSession')}
                                </div>
                                <div onClick={(e) => { e.stopPropagation(); handleSettingsClick(session.id); }}>
                                    {t('ui.sessionSettings')}
                                </div>
                                <div className="delete" onClick={(e) => { e.stopPropagation(); onDelete(session.id); setMenuOpenId(null); }}>
                                    {t('ui.deleteSession')}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer License Button */}
            <div className="sidebar-footer">
                <button
                    className="license-btn"
                    onClick={onOpenLicense}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '4px 8px'
                    }}
                    onMouseEnter={(e) => e.target.style.color = 'var(--color-accent)'}
                    onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.5)'}
                >
                    📜 {t('sidebar.licenses')}
                </button>
            </div>
        </div >
    );
}
