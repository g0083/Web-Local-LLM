import { useState } from 'react';
import { t, setLanguage } from '../../utils/i18n';

const LanguageSelection = ({ onContinue }) => {
    const [selectedLanguage, setSelectedLanguage] = useState('en');

    const handleLanguageSelect = (lang) => {
        setSelectedLanguage(lang);
        setLanguage(lang);
    };

    const handleContinue = () => {
        onContinue(selectedLanguage);
    };

    return (
        <div className="onboarding-container">
            <div className="onboarding-content">
                <div className="onboarding-header">
                    <h1 className="onboarding-title">{t('languageSelection.title')}</h1>
                    <p className="onboarding-subtitle">{t('languageSelection.subtitle')}</p>
                </div>

                <div className="language-options">
                    <button
                        className={`language-option ${selectedLanguage === 'en' ? 'selected' : ''}`}
                        onClick={() => handleLanguageSelect('en')}
                    >
                        <span className="language-flag">🇺🇸</span>
                        <span className="language-name">{t('languageSelection.english')}</span>
                    </button>

                    <button
                        className={`language-option ${selectedLanguage === 'ja' ? 'selected' : ''}`}
                        onClick={() => handleLanguageSelect('ja')}
                    >
                        <span className="language-flag">🇯🇵</span>
                        <span className="language-name">{t('languageSelection.japanese')}</span>
                    </button>
                </div>

                <button className="onboarding-continue-btn" onClick={handleContinue}>
                    {t('languageSelection.continue')}
                </button>
            </div>
        </div>
    );
};

export default LanguageSelection;
