# Web Local LLM

A privacy-focused AI chat application that runs Large Language Models (LLM) entirely within your web browser. No data ever leaves your device.

**Live Demo:** [https://web-local-llm.pages.dev/](https://web-local-llm.pages.dev/)

## Features

- **100% Client-Side:** Inference is performed locally in your browser using WebAssembly (WASM).
- **Privacy First:** Your conversations and data are never sent to a server.
- **Persistent Storage:** Models are cached in the Origin Private File System (OPFS) for fast subsequent loads.
- **Multithreading Support:** High-performance execution using Web Workers and SharedArrayBuffer.
- **Rich UI:** Supports Markdown rendering, LaTeX math formulas (KaTeX), and code syntax highlighting.
- **Offline Capable:** Once models are cached, the application works without an internet connection.

## Technology Stack

- **Frontend:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **LLM Engine:** [@wllama/wllama](https://github.com/mizuno-as/wllama) (based on [llama.cpp](https://github.com/ggerganov/llama.cpp))
- **Storage:** [localForage](https://localforage.github.io/localForage/) (IndexedDB) for chat history, OPFS for model binaries.
- **Security:** Service Worker implementation for Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) to enable high-performance features.

## License

This project is licensed under the MIT License.

---

# Web Local LLM (日本語訳)

ブラウザ内で大規模言語モデル（LLM）を完全に動作させる、プライバシー重視のAIチャットアプリケーションです。データがデバイスの外に出ることはありません。

**ライブデモ:** [https://web-local-llm.pages.dev/](https://web-local-llm.pages.dev/)

## 主な機能

- **100% クライアントサイド:** WebAssembly (WASM) を利用し、ブラウザ内で推論を完結させます。
- **プライバシー保護:** 会話内容やデータが外部サーバーに送信されることはありません。
- **永続キャッシュ:** モデルは Origin Private File System (OPFS) に保存され、2回目以降は高速に起動します。
- **マルチスレッド対応:** Web Workers と SharedArrayBuffer を活用した高速な実行環境。
- **高機能 UI:** Markdown、LaTeX 数式（KaTeX）、コードシンタックスハイライトに対応。
- **オフライン動作:** モデルのキャッシュ後は、インターネット接続なしで利用可能です。

## 使用技術

- **フロントエンド:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **LLM エンジン:** [@wllama/wllama](https://github.com/mizuno-as/wllama) ([llama.cpp](https://github.com/ggerganov/llama.cpp) ベース)
- **ストレージ:** チャット履歴には [localForage](https://localforage.github.io/localForage/) (IndexedDB)、モデル本体には OPFS を使用。
- **セキュリティ:** 高速化に必要な `COOP` / `COEP` ヘッダーを制御するためのサービスワーカー実装。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
