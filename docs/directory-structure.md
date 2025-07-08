# ディレクトリ構造ガイド

最終更新日: 2025年7月8日

## 概要

このドキュメントでは、Future Platform プロジェクトの完全なディレクトリ構造と、各ファイル・フォルダの役割について説明します。

## 全体構造

```
future_platform/
├── README.md                    # プロジェクトの基本情報とセットアップガイド
├── package.json                 # Node.js依存関係とスクリプト定義
├── package-lock.json           # 依存関係のロックファイル
├── tsconfig.json               # TypeScript設定
├── jest.config.js              # テスト設定
├── nodemon.json                # 開発時のホットリロード設定
├── Dockerfile                  # 統合管理システム用Dockerイメージ
├── docker-compose.yml          # 開発環境用Docker Compose設定
├── .env.example               # 環境変数のサンプル
├── .gitignore                 # Git除外ファイル設定
├── .eslintrc.json             # コード品質チェック設定
├──
├── src/                       # 統合管理システム（Node.js/TypeScript）
│   ├── index.ts              # アプリケーションエントリーポイント
│   ├── config/               # 設定管理
│   │   └── index.ts          # 環境変数と設定の管理
│   ├── controllers/          # メインコントローラー
│   │   └── integration.controller.ts  # 統合制御ロジック
│   ├── services/             # ビジネスロジック
│   │   ├── mqtt.service.ts              # MQTT通信サービス
│   │   ├── event-processor.service.ts   # イベント処理サービス
│   │   ├── action-executor.service.ts   # アクション実行サービス
│   │   └── people-counter.service.ts    # 人数カウントサービス
│   ├── interfaces/           # TypeScript型定義
│   │   ├── event.interface.ts           # イベント関連の型
│   │   └── action.interface.ts          # アクション関連の型
│   └── utils/                # ユーティリティ
│       └── logger.ts         # ログ出力設定
├──
├── docs/                      # プロジェクトドキュメント
│   ├── README.md             # ドキュメント目次
│   ├── directory-structure.md # このファイル（ディレクトリ構造ガイド）
│   ├── architecture.md       # システムアーキテクチャ詳細
│   ├── api-integration.md    # API連携ガイド
│   ├── message-format.md     # メッセージフォーマット仕様
│   ├── design-decisions.md   # 設計判断の記録
│   ├── performance-tuning.md # パフォーマンス調整ガイド
│   ├── raspberry-pi-setup.md # Raspberry Piセットアップガイド
│   └── troubleshooting.md    # トラブルシューティング
├──
├── config/                    # 外部サービス設定
│   └── mosquitto/            # MQTT ブローカー設定
│       └── mosquitto.conf    # Mosquitto設定ファイル
├──
├── docker/                    # Docker関連ファイル
│   └── gstreamer/            # 映像処理用Dockerイメージ
│       ├── Dockerfile        # GStreamer用Dockerイメージ定義
│       └── recorder.py       # 録画スクリプト
├──
└── server-environment/        # サーバー環境（PR #1で追加予定）
    ├── docker-compose.yml    # サーバー環境用Docker Compose
    ├── .gitignore           # サーバー環境固有の除外設定
    ├── mosquitto/           # MQTT ブローカー設定
    │   └── config/
    │       └── mosquitto.conf
    ├── recorder/            # 映像録画サービス
    │   ├── Dockerfile      # 録画コンテナ用Dockerイメージ
    │   └── recorder.sh     # 録画制御スクリプト
    ├── minio-data/         # MinIOデータディレクトリ（自動生成・Git除外）
    │   └── .minio.sys/     # MinIOシステムファイル（自動生成・Git除外）
    ├── mosquitto/
    │   ├── data/           # MQTTデータディレクトリ（自動生成・Git除外）
    │   └── log/            # MQTTログディレクトリ（自動生成・Git除外）
    └── videos/             # 一時録画ファイル（自動生成・Git除外）
```

## コンポーネント別詳細説明

### 1. 統合管理システム（`src/`）

**責務**: MQTT経由で受信したイベントを処理し、外部システムにアクションを指示する中央制御システム

**主要ファイル**:
- `index.ts`: アプリケーションのエントリーポイント
- `config/index.ts`: 環境変数の管理と検証
- `controllers/integration.controller.ts`: 各サービスの統合制御
- `services/`: 個別機能のビジネスロジック

**開発時のコマンド**:
```bash
npm run dev          # 開発サーバー起動
npm run build        # TypeScriptビルド
npm run lint         # コード品質チェック
npm test            # テスト実行
```

### 2. ドキュメント（`docs/`）

**責務**: プロジェクトの仕様、設計、セットアップ手順などの文書化

**重要なドキュメント**:
- `architecture.md`: システム全体の設計
- `api-integration.md`: 外部API連携方法
- `message-format.md`: MQTT メッセージ仕様
- `raspberry-pi-setup.md`: センサーノード設定手順

### 3. サーバー環境（`server-environment/`）

**責務**: Docker Composeによるサーバーサイドインフラの定義

**注意事項**:
- このディレクトリはPR #1で追加予定
- `minio-data/`, `mosquitto/data/`, `mosquitto/log/`は自動生成されるため、**Gitにコミットしないこと**
- `.minio.sys/`ディレクトリは MinIO が自動生成するシステムファイルのため、**Git除外対象**

**セットアップコマンド**:
```bash
cd server-environment/
docker compose up --build
```

### 4. 外部サービス設定（`config/`, `docker/`）

**責務**: MQTT ブローカーや映像処理サービスの設定

- `config/mosquitto/`: 開発用MQTT設定
- `docker/gstreamer/`: 映像録画・処理用コンテナ

## ファイル管理のベストプラクティス

### ✅ Gitにコミットすべきファイル

- **ソースコード**: `src/`内の全ファイル
- **設定ファイル**: `config/`, `server-environment/*.yml`, `Dockerfile`等
- **ドキュメント**: `docs/`内の全ファイル
- **プロジェクト設定**: `package.json`, `tsconfig.json`等

### ❌ Gitにコミットしてはいけないファイル

- **自動生成ディレクトリ**: `minio-data/`, `mosquitto/data/`, `mosquitto/log/`
- **MinIOシステムファイル**: `.minio.sys/`内の全ファイル
- **一時ファイル**: `videos/`, `*.mp4`, `*.log`
- **開発環境ファイル**: `.env`, `node_modules/`, `dist/`

### 🔧 .gitignore での除外設定

MinIOやDockerが自動生成するファイルは、`.gitignore`で適切に除外されています：

```gitignore
# Server environment data directories
server-environment/minio-data/
server-environment/mosquitto/data/
server-environment/mosquitto/log/

# MinIO system files
**/.minio.sys/
**/minio-data/.minio.sys/
```

## よくある質問

### Q: PR #1で追加された`server-environment/`ディレクトリの目的は？

A: サーバー環境のDocker Composeファイルや関連設定をまとめて管理するためのディレクトリです。開発用の設定（ルートの`docker-compose.yml`）と本番用の設定（`server-environment/`）を分離しています。

### Q: MinIOの`.minio.sys/format.json`がコミットされてしまった場合は？

A: 以下の手順で除外してください：

```bash
# ファイルを追跡対象から除外
git rm --cached server-environment/minio-data/.minio.sys/format.json

# .gitignoreで除外設定を確認
cat .gitignore | grep minio

# 変更をコミット
git commit -m "Remove MinIO system files from tracking"
```

### Q: 開発環境と本番環境の使い分けは？

A: 
- **開発環境**: ルートの`docker-compose.yml`を使用
- **サーバー環境**: `server-environment/docker-compose.yml`を使用

### Q: 新しいサービスを追加したい場合は？

A: 
1. `src/services/`に新しいサービスクラスを作成
2. `src/controllers/integration.controller.ts`で統合
3. 必要に応じて`docs/api-integration.md`にAPI仕様を追加

## まとめ

このディレクトリ構造は、以下の原則に基づいて設計されています：

1. **関心の分離**: 統合管理システム（`src/`）、サーバー環境（`server-environment/`）、ドキュメント（`docs/`）を明確に分離
2. **自動生成ファイルの除外**: Docker やMinIOが生成するファイルはGit管理から除外
3. **環境別設定**: 開発環境と本番環境の設定を分離して管理
4. **拡張性**: 新しいサービスやコンポーネントを容易に追加できる構造

何か不明な点があれば、このドキュメントを参照するか、Issueを作成してください。