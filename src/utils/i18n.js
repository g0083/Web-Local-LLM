// Internationalization utility for English and Japanese

let currentLanguage = 'en';

const translations = {
    en: {
        // Common
        common: {
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            close: 'Close',
            confirm: 'Confirm',
            settings: 'Settings'
        },

        // Sidebar
        sidebar: {
            newChat: 'New Chat',
            history: 'Chat History',
            pinnedChats: 'Pinned',
            recentChats: 'Recent',
            licenses: 'Licenses & Attribution',
            rename: 'Rename',
            pin: 'Pin',
            unpin: 'Unpin',
            sessionSettings: 'Session Settings'
        },

        // Chat Interface
        chat: {
            appTitle: 'Web Local LLM',
            placeholder: 'Type your message...',
            send: 'Send',
            generating: 'Generating...',
            stop: 'Stop',
            copy: 'Copy',
            copied: 'Copied!',
            regenerate: 'Regenerate',
            globalSettings: 'Global Settings',
            newSession: 'New Chat',
            sessionTitle: 'Chat',
            untitled: 'Untitled Chat',
            deleteConfirm: 'Are you sure you want to delete this chat?',
            generatingTitle: 'Generating title...',
            clearMessages: 'Clear Messages',
            initialGreeting: "Hello! I am your local AI assistant. I'm ready to chat.",
            loadingModel: "Loading model locally into memory... Please wait (this may take a few seconds)...",
            defaultSystemPrompt: "You are a helpful AI assistant.",
            modelError: "Model failed to load.",
            redownloadPrompt: "Please try redownloading the model.",
            speak: "Speak",
            interactiveMode: "Interactive Mode"
        },

        // Settings Modal
        settings: {
            title: 'Settings',
            globalSettings: 'Global Settings',
            sessionSettings: 'Session Settings',
            language: 'Language',
            recognitionLanguage: 'Speech Recognition Language',
            languageDesc: 'Select interface language',
            modelSelection: 'Model Selection',
            modelSelectionDesc: 'Choose the AI model to use',
            temperature: 'Temperature',
            temperatureDesc: 'Controls randomness in responses (0.0 = focused, 1.0 = creative)',
            topP: 'Top P',
            topK: 'Top K',
            maxTokens: 'Max Tokens',
            redownloadModel: 'Redownload Model',
            redownloadDesc: 'Force re-download of the model (useful if model is corrupted)',
            threads: 'CPU Threads',
            threadsDesc: 'Number of threads to use (higher = faster but uses more CPU)',
            resetData: 'Factory Reset',
            resetDataDesc: 'Clear all chat history and settings (keeps downloaded model)',
            modelManagement: 'Model Management',
            topPDesc: 'Nucleus sampling threshold',
            topK: 'Top K',
            topKDesc: 'Limits vocabulary to top K tokens',
            maxTokens: 'Max Tokens',
            maxTokensDesc: 'Maximum length of generated response',
            systemPrompt: 'System Prompt',
            systemPromptDesc: 'Instructions that guide the AI\'s behavior',
            systemPromptPlaceholder: 'You are a helpful AI assistant...',
            thinkingModel: 'Thinking Model',
            instructModel: 'Instruct Model',
            saveAsDefault: 'Save as new Default for future chats',
            defaultsSaved: 'Settings saved as new default for future chats.'
        },

        // Onboarding (existing)
        languageSelection: {
            title: 'Welcome to Web Local LLM',
            subtitle: 'Please select your language',
            english: 'English',
            japanese: '日本語',
            continue: 'Continue'
        },
        modelDownload: {
            title: 'Select AI Models',
            subtitle: 'Choose your default local model. Download runs locally and persists in your browser.',
            lfm3Model: 'LFM3 1.7B (Recommended)',
            lfm3Size: '(~1.1GB)',
            lfm3Desc: 'Liquid AI LFM3-1.7B – State-of-the-art hybrid model combining deep thinking traces (<think>) and everyday chat',
            lfm3FastModel: 'LFM3 1.7B QAD (Fast)',
            lfm3FastSize: '(~0.98GB)',
            lfm3FastDesc: 'Distilled 4-bit model optimized for speed and lower memory usage',
            thinkingModel: 'Thinking Model',
            thinkingSize: '(~0.7GB)',
            thinkingDesc: 'LiquidAI LFM2.5-1.2B-Thinking – Legacy reasoning model',
            instructModel: 'Instruct Model',
            instructSize: '(~0.7GB)',
            instructDesc: 'LiquidAI LFM2.5-1.2B-Instruct – Legacy assistant model',
            downloading: 'Downloading...',
            download: 'Download',
            downloaded: 'Downloaded',
            redownload: 'Re-download',
            customModelNote: '💡 You can add custom models (.gguf) or connect to LM Studio later in Settings.',
            continue: 'Continue',
            selectAtLeastOne: 'Please download at least one model to continue',
            downloadError: 'Failed to download model. Please try again.'
        },
        featureIntro: {
            title: 'App Introduction',
            subtitle: 'Discover the features',
            generating: 'Generating introduction...',
            skip: 'Skip Introduction',
            getStarted: 'Get Started'
        },
        features: [
            'Runs entirely in your browser with complete privacy',
            'Choose from multiple AI models',
            'Works offline after initial download',
            'Supports Markdown, code syntax highlighting, and math equations',
            'Automatic chat history and session management'
        ],
        ui: {
            pinSession: 'Pin Session',
            unpinSession: 'Unpin Session',
            renameSession: 'Rename',
            deleteSession: 'Delete Session',
            sessionSettings: 'Session Settings',
            installApp: 'Install App',
            localSpeechDisabled: 'Local Speech (WASM) - Offline (Temporarily Disabled)',
            featureUnavailable: 'Feature currently unavailable.'
        }
    },
    ja: {
        // Common
        common: {
            cancel: 'キャンセル',
            save: '保存',
            delete: '削除',
            edit: '編集',
            close: '閉じる',
            confirm: '確認',
            settings: '設定'
        },

        // Sidebar
        sidebar: {
            newChat: '新しいチャット',
            history: 'チャット履歴',
            pinnedChats: 'ピン留め',
            recentChats: '最近',
            licenses: 'ライセンスと帰属',
            rename: '名前を変更',
            pin: 'ピン留め',
            unpin: 'ピン留め解除',
            sessionSettings: 'セッション設定'
        },

        // Chat Interface
        chat: {
            appTitle: 'Web Local LLM',
            placeholder: 'メッセージを入力...',
            send: '送信',
            generating: '生成中...',
            stop: '停止',
            copy: 'コピー',
            copied: 'コピーしました！',
            regenerate: '再生成',
            globalSettings: 'グローバル設定',
            newSession: '新しいチャット',
            sessionTitle: 'チャット',
            untitled: '無題のチャット',
            deleteConfirm: 'このチャットを削除してもよろしいですか？',
            generatingTitle: 'タイトル生成中...',
            clearMessages: 'メッセージをクリア',
            initialGreeting: 'こんにちは！ローカルAIアシスタントです。チャットの準備ができました。',
            loadingModel: 'モデルをメモリに読み込んでいます... お待ちください（数秒かかる場合があります）...',
            defaultSystemPrompt: 'あなたは役に立つAIアシスタントです。',
            modelError: 'モデルの読み込みに失敗しました。',
            redownloadPrompt: "モデルを再ダウンロードしてください。",
            speak: "読み上げ",
            interactiveMode: "対話モード"
        },

        // Settings Modal
        settings: {
            title: '設定',
            globalSettings: 'グローバル設定',
            sessionSettings: 'セッション設定',
            language: '言語',
            recognitionLanguage: '音声認識言語',
            languageDesc: 'インターフェース言語を選択',
            modelSelection: 'モデル選択',
            modelSelectionDesc: '使用するAIモデルを選択',
            temperature: '温度 (Temperature)',
            temperatureDesc: '応答のランダム性を制御 (0.0 = 集中的、1.0 = 創造的)',
            topP: 'Top P',
            topK: 'Top K',
            maxTokens: '最大トークン数',
            redownloadModel: 'モデルを再ダウンロード',
            redownloadDesc: 'モデルを強制的に再ダウンロードします（モデルが破損している場合に有効）',
            threads: 'CPUスレッド数',
            threadsDesc: '使用するスレッド数（多いほど高速ですが、CPU負荷が高くなります）',
            resetData: 'アプリ初期化（データ削除）',
            resetDataDesc: 'チャット履歴と設定を全て削除します（モデルは保持されます）',
            modelManagement: 'モデル管理',
            topPDesc: 'ニュークリアスサンプリング閾値',
            topK: 'Top K',
            topKDesc: '語彙をトップKトークンに制限',
            maxTokens: '最大トークン数',
            maxTokensDesc: '生成される応答の最大長',
            systemPrompt: 'システムプロンプト',
            systemPromptDesc: 'AIの動作を導く指示',
            systemPromptPlaceholder: 'あなたは役立つAIアシスタントです...',
            thinkingModel: 'Thinkingモデル',
            instructModel: 'Instructモデル',
            voiceSettings: '音声設定',
            voiceName: '声の種類',
            formattedPitch: '声の高さ: {value}',
            formattedRate: '読み上げ速度: {value}',
            formattedVolume: '音量: {value}',
            realTimeSpeech: 'リアルタイム読み上げ',
            saveAsDefault: '今後のチャットのデフォルトとして保存',
            defaultsSaved: '設定をデフォルトとして保存しました。'
        },

        // Onboarding (existing)
        languageSelection: {
            title: 'Web Local LLMへようこそ',
            subtitle: '言語を選択してください',
            english: 'English',
            japanese: '日本語',
            continue: '続ける'
        },
        modelDownload: {
            title: 'AIモデルを選択',
            subtitle: '使用するローカルモデルを選択してください。一度ダウンロードすればオフラインでも動作します。',
            lfm3Model: 'LFM3 1.7B (推奨)',
            lfm3Size: '(約1.1GB)',
            lfm3Desc: 'Liquid AI LFM3-1.7B – 思考プロセス(<think>)と自然な会話を両立した最新世代ハイブリッドモデル',
            lfm3FastModel: 'LFM3 1.7B QAD (高速・軽量)',
            lfm3FastSize: '(約0.98GB)',
            lfm3FastDesc: '蒸留技術により精度を維持しつつ高速・低メモリ動作を実現した4ビットモデル',
            thinkingModel: 'Thinkingモデル',
            thinkingSize: '(約0.7GB)',
            thinkingDesc: 'LiquidAI LFM2.5-1.2B-Thinking – 旧推論特化モデル',
            instructModel: 'Instructモデル',
            instructDesc: 'LiquidAI LFM2.5-1.2B-Instruct – 旧対話アシスタントモデル',
            instructSize: '(約0.7GB)',
            downloading: 'ダウンロード中...',
            download: 'ダウンロード',
            downloaded: 'ダウンロード済み',
            redownload: '再ダウンロード',
            customModelNote: '💡 Settingsからカスタムモデル(.gguf)の追加やLM Studioとの連携が可能です。',
            continue: '続ける',
            selectAtLeastOne: '少なくとも1つのモデルをダウンロードしてください',
            downloadError: 'モデルのダウンロードに失敗しました。もう一度お試しください。'
        },
        // Onboarding - Feature Intro
        featureIntro: {
            title: '機能の紹介',
            subtitle: 'アプリの特徴をご紹介します',
            generating: '紹介文を生成中...',
            getStarted: '始める',
            skip: '紹介をスキップ'
        },
        // Feature bullet points for LLM to explain
        features: [
            'すべての処理はブラウザ内でローカルに実行 - 外部サーバーにデータを送信しません',
            'ThinkingモデルとInstructモデルから用途に応じて選択可能',
            'コンテキストサイズ、バッチサイズ、KVキャッシュ設定などのモデルパラメータをカスタマイズ',
            'チャット履歴は自動的にブラウザに保存されます',
            '複数のチャットセッションを作成し、カスタムタイトルで整理',
            'コード構文ハイライトや数式を含むMarkdownレンダリング',
            '初回モデルダウンロード後はオフラインで動作'
        ],
        // UI Elements
        ui: {
            newChat: '新しいチャット',
            settings: '設定',
            rename: '名前変更',
            delete: '削除',
            pin: 'ピン留め',
            unpin: 'ピン解除',
            sessionSettings: 'セッション設定',
            licenses: 'ライセンスと帰属',
            typePlaceholder: 'メッセージを入力...',
            pinSession: 'セッションをピン留め',
            unpinSession: 'ピン留め解除',
            renameSession: '名前を変更',
            deleteSession: 'セッションを削除',
            sessionSettings: 'セッション設定',
            installApp: 'アプリをインストール',
            localSpeechDisabled: 'ローカル音声入力 (WASM) - オフライン (現在無効)',
            featureUnavailable: 'この機能は現在利用できません。'
        }
    }
};

export const setLanguage = (lang) => {
    if (translations[lang]) {
        currentLanguage = lang;
    }
};

export const getLanguage = () => currentLanguage;

// Get translation by key path (e.g., 'languageSelection.title')
export const t = (keyPath) => {
    const keys = keyPath.split('.');
    let result = translations[currentLanguage];

    for (const key of keys) {
        if (result && typeof result === 'object') {
            result = result[key];
        } else {
            return keyPath; // Return key if translation not found
        }
    }

    return result || keyPath;
};

// Get all translations for a section
export const getSection = (section) => {
    return translations[currentLanguage][section] || {};
};

// Export the full translations object for direct access
export { translations };
