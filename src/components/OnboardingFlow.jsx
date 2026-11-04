import { useState } from 'react';
import LanguageSelection from './onboarding/LanguageSelection';
import ModelDownload from './onboarding/ModelDownload';
import FeatureIntro from './onboarding/FeatureIntro';
import {
    setUserLanguage,
    setSelectedModels,
    setOnboardingComplete,
    setModelConfig,
    MODEL_URLS
} from '../services/history';
import { setLanguage } from '../utils/i18n';

const OnboardingFlow = ({ onComplete, generateIntro, onDownloadModel }) => {
    const [currentStep, setCurrentStep] = useState('language'); // language, models, intro
    const [selectedLanguage, setSelectedLanguageState] = useState('en');
    const [downloadedModels, setDownloadedModels] = useState([]);

    const handleLanguageSelected = async (language) => {
        setSelectedLanguageState(language);
        await setUserLanguage(language);
        setLanguage(language);
        setCurrentStep('models');
    };

    const handleModelsDownloaded = async (models) => {
        setDownloadedModels(models);
        await setSelectedModels(models);

        // Default to lfm2_thinking if available, otherwise first selected model
        const defaultModel = models.includes('lfm2_thinking') ? 'lfm2_thinking' : models[0] || 'lfm2_thinking';
        console.log(`[OnboardingFlow] Setting default model to: ${defaultModel}`);

        await setModelConfig({
            model_name: defaultModel,
            model_url: MODEL_URLS[defaultModel] || MODEL_URLS.lfm2_thinking
        });

        // Proceed to intro
        setCurrentStep('intro');
    };

    const handleIntroComplete = async () => {
        await setOnboardingComplete(true);
        onComplete();
    };

    const handleSkipIntro = async () => {
        await setOnboardingComplete(true);
        onComplete();
    };

    return (
        <div className="onboarding-flow">
            {currentStep === 'language' && (
                <LanguageSelection onContinue={handleLanguageSelected} />
            )}

            {currentStep === 'models' && (
                <ModelDownload
                    onContinue={handleModelsDownloaded}
                    onDownloadModel={onDownloadModel}
                />
            )}

            {currentStep === 'intro' && (
                <FeatureIntro
                    onComplete={handleIntroComplete}
                    onSkip={handleSkipIntro}
                    generateIntro={generateIntro}
                />
            )}
        </div>
    );
};

export default OnboardingFlow;
