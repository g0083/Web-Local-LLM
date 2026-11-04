import React, { useEffect, useState } from 'react';

const AdBanner = () => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isVisible) {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error('[AdSense] Error pushing ad:', e);
            }
        }
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div className="ad-section-container" style={{
            width: '100%',
            background: 'var(--color-bg-2)',
            borderTop: '1px solid var(--color-glass-border)',
            position: 'relative',
            flexShrink: 0,
            height: 'auto',
            maxHeight: '120px' // Limit the maximum height
        }}>
            <button
                onClick={() => setIsVisible(false)}
                style={{
                    position: 'absolute',
                    right: '10px',
                    top: '5px',
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    padding: 0
                }}
                title="閉じる"
            >
                ✕
            </button>
            <div className="ad-container" style={{
                width: '100%',
                textAlign: 'center',
                padding: '5px 0',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
            }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Advertisement</span>
                {/* WebBottomBanner */}
                <ins className="adsbygoogle"
                    style={{ display: 'inline-block', width: '100%', height: '90px' }} // Fixed height for horizontal banner
                    data-ad-client="ca-pub-9543327719024469"
                    data-ad-slot="7150053933"
                    data-ad-format="horizontal"
                    data-full-width-responsive="false"></ins>
            </div>
        </div>
    );
};

export default AdBanner;
