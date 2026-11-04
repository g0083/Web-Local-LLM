# Web Local LLM

A privacy-focused AI chat application that runs Large Language Models (LLM) entirely within your web browser using WebGPU and WebAssembly. No data ever leaves your device.

**Live Demo:** [https://web-local-llm.pages.dev/](https://web-local-llm.pages.dev/)

## Features

- **100% Client-Side:** Inference is performed locally in your browser using **WebGPU acceleration** and WebAssembly (WASM).
- **Latest Hybrid Model (LFM3 1.7B):** Default model updated to Liquid AI's tri-hybrid **LFM3-1.7B**, seamlessly combining reasoning traces (`<think>`) and instruction following.
- **Privacy First:** Your conversations and data are never sent to a server.
- **Persistent Storage:** Models are cached in the Origin Private File System (OPFS) for fast subsequent loads and offline usage.
- **Multithreading & WebGPU Support:** High-performance GPU offloading alongside Web Workers and SharedArrayBuffer.
- **Rich UI:** Supports Markdown rendering, LaTeX math formulas (KaTeX), Thinking process blocks, and code syntax highlighting.
- **Offline Capable:** Once models are cached, the application works completely offline without an internet connection.

## Technology Stack

- **Frontend:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **LLM Engine:** [@wllama/wllama](https://github.com/ngxson/wllama) v3 (based on [llama.cpp](https://github.com/ggerganov/llama.cpp)) with WebGPU support
- **Default Model:** [Liquid AI LFM3-1.7B GGUF](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF)
- **Storage:** [localForage](https://localforage.github.io/localForage/) (IndexedDB) for chat history, OPFS for model binaries.
- **Security:** Service Worker implementation for Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP).

## License

This project is licensed under the MIT License.

---

# Web Local LLM (日本語訳)

ブラウザ内で大規模言語モデル（LLM）を完全に動作させる、プライバシー重視のAIチャットアプリケーションです。WebGPU と WebAssembly による高速推論により、データがデバイスの外に出ることは一切ありません。

**ライブデモ:** [https://web-local-llm.pages.dev/](https://web-local-llm.pages.dev/)

## 主な機能

- **100% クライアントサイド:** WebGPU ハードウェアアクセラレーションおよび WebAssembly (WASM) を利用し、ブラウザ内で推論を完結。
- **最新ハイブリッドモデル (LFM3 1.7B):** Liquid AI の最新モデル **LFM3-1.7B** をデフォルト採用。思考プロセス（`<think>`）と高精度な対話指示追従を統合。
- **プライバシー保護:** 会話内容やデータが外部サーバーに送信されることはありません。
- **永続キャッシュ:** モデルは Origin Private File System (OPFS) に保存され、2回目以降は高速に起動。
- **WebGPU & マルチスレッド対応:** WebGPU による GPU オフロードと、Web Workers / SharedArrayBuffer による高パフォーマンス実行。
- **高機能 UI:** Markdown、LaTeX 数式（KaTeX）、思考プロセス折りたたみ表示、コードシンタックスハイライトに対応。
- **オフライン動作:** モデルのキャッシュ後は、インターネット接続なしで利用可能です。

## 使用技術

- **フロントエンド:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **LLM エンジン:** [@wllama/wllama](https://github.com/ngxson/wllama) v3 ([llama.cpp](https://github.com/ggerganov/llama.cpp) ベース、WebGPU 対応)
- **デフォルトモデル:** [Liquid AI LFM3-1.7B GGUF](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF)
- **ストレージ:** チャット履歴には [localForage](https://localforage.github.io/localForage/) (IndexedDB)、モデル本体には OPFS を使用。
- **セキュリティ:** 高速化に必要な `COOP` / `COEP` ヘッダーを制御するためのサービスワーカー実装。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
