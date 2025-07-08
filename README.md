# Future Platform - 統合管理システム

複数カメラからの人物行動解析データを統合し、イベント駆動でアクションを実行するNode.js/TypeScriptプラットフォーム

## 📋 目次

- [概要](#概要)
- [要件定義](#要件定義)
- [Quick Start](#quick-start)
- [セットアップ](#セットアップ)
- [アーキテクチャ](#アーキテクチャ)
- [設定](#設定)
- [開発](#開発)
- [ドキュメント](#ドキュメント)

## 概要

本システムは、空間内に設置された複数のカメラ映像をリアルタイムで解析し、人物の行動（入退室、人数、姿勢など）に基づいたイベントを検知します。検知したイベントに応じて動画再生や音声案内などのアクションを自動実行し、同時にカメラ映像を永続的に蓄積します。

### 主な特徴

- ✅ リアルタイムイベント処理（MQTT通信）
- ✅ 多数決方式による高精度な人数カウント
- ✅ 拡張可能なイベントルールとアクション
- ✅ Docker対応による簡単なデプロイ
- ✅ 映像の自動録画と永続化（MinIO）

## 要件定義

### システム要件

- **センサーノード**: Raspberry Pi 4台 + カメラ
- **解析エンジン**: YOLOv8（人物検出）、MediaPipe（姿勢推定）
- **通信プロトコル**: MQTT（状態・イベント）、UDP/RTP（映像ストリーム）
- **データ形式**: JSON（メッセージ）、MP4（録画映像）

### 検知イベント

| イベント名 | 説明 | デフォルトアクション |
|-----------|------|-------------------|
| `PERSON_ENTERED` | 人が空間に入室 | 音声案内「いらっしゃいませ」 |
| `SITTING_CONFIRMED` | 着席を確認（2秒間） | ウェルカム動画再生 |
| `PERSON_STOOD_UP` | 着席者が立ち上がり | - |
| `ALL_PEOPLE_LEFT` | 全員が退室 | アイドル動画をループ再生 |

### メッセージフォーマット

詳細は[docs/message-format.md](docs/message-format.md)を参照

## Quick Start

### 前提条件

- Docker & Docker Compose
- Node.js 20+ (開発時のみ)
- Git

### 最速セットアップ（3分）

```bash
# 1. リポジトリのクローン
git clone https://github.com/yourorg/future_platform.git
cd future_platform

# 2. 環境変数の設定
cp .env.example .env

# 3. Dockerコンテナの起動
docker-compose up -d

# 4. ログの確認
docker-compose logs -f integration-controller
```

これで統合管理システムが起動します！

### 動作確認

```bash
# MQTTでテストメッセージを送信
docker exec -it mqtt-broker mosquitto_pub -t "sensor/camera1/event" -m '{
  "type": "event",
  "camera_id": "camera1",
  "timestamp": 1234567890,
  "event": {
    "name": "PERSON_ENTERED"
  }
}'
```

## セットアップ

### 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# 開発サーバーの起動（ホットリロード付き）
npm run dev
```

### 本番環境のセットアップ

#### 1. 環境変数の設定

`.env`ファイルを編集して環境に合わせて設定：

```env
# MQTT設定
MQTT_BROKER_URL=mqtt://your-broker:1883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password

# アクションシステムのAPI
VIDEO_PLAYER_API_URL=http://video-player:8080
AUDIO_PLAYER_API_URL=http://audio-player:8081

# 人数カウント設定
MAJORITY_VOTE_THRESHOLD=3
```

#### 2. Dockerイメージのビルド

```bash
docker-compose build
```

#### 3. サービスの起動

```bash
docker-compose up -d
```

### Raspberry Piのセットアップ

センサーノード側の設定については[docs/raspberry-pi-setup.md](docs/raspberry-pi-setup.md)を参照

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     センシング空間                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ RPi #1  │  │ RPi #2  │  │ RPi #3  │  │ RPi #4  │     │
│  │ +Camera │  │ +Camera │  │ +Camera │  │ +Camera │     │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │            │            │            │             │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        ├────────────┴────────────┴────────────┤ MQTT/JSON
        │                                       │ UDP/RTP
        ▼                                       ▼
┌─────────────────┐                    ┌──────────────────┐
│  MQTT Broker    │                    │ 映像蓄積サーバー  │
│  (Mosquitto)    │                    │ (GStreamer+MinIO)│
└────────┬────────┘                    └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              統合管理システム (本リポジトリ)               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Event Process│  │People Counter│  │Action Execute│  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 出力システム     │
                    │ (動画/音声再生) │
                    └─────────────────┘
```

詳細な設計については[docs/architecture.md](docs/architecture.md)を参照

## ディレクトリ構造について

このプロジェクトは以下の構造で構成されています：

- **`src/`**: Node.js/TypeScriptによる統合管理システム（本リポジトリのメイン）
- **`server-environment/`**: Docker Composeによるサーバー環境設定（PR #1で追加予定）
- **`docs/`**: プロジェクトドキュメント
- **`config/`, `docker/`**: 外部サービス設定

**重要**: `server-environment/`内の`minio-data/`、`mosquitto/data/`等は自動生成されるため、**Gitにコミットしないでください**。これらのディレクトリは`.gitignore`で除外されています。

**ディレクトリ構造でお困りの場合は**:
- 完全なガイド: **[docs/directory-structure.md](docs/directory-structure.md)**
- 具体的な作業手順: **[docs/setup-guide.md](docs/setup-guide.md)**

## 設定

### イベントルールのカスタマイズ

`src/services/event-processor.service.ts`でルールを追加：

```typescript
// カスタムルールの例
this.addEventRule({
  eventName: 'PERSON_ENTERED',
  condition: (event) => event.camera_id === 'camera1',
  actions: [{
    type: 'VIDEO_PLAY',
    payload: { videoId: 'special_welcome' },
    priority: 'HIGH'
  }]
});
```

### API設定

外部システムとの連携設定は[docs/api-integration.md](docs/api-integration.md)を参照

## 開発

### コマンド一覧

```bash
npm run dev          # 開発サーバー起動
npm run build        # TypeScriptビルド
npm run lint         # ESLintチェック
npm test            # テスト実行
npm run test:watch  # テスト（ウォッチモード）
npm run test:coverage # カバレッジレポート生成
```

### プロジェクト構造

```
future_platform/
├── src/                      # 統合管理システム（Node.js/TypeScript）
│   ├── config/              # 設定管理
│   ├── controllers/         # メインコントローラー
│   ├── interfaces/          # TypeScript型定義
│   ├── services/            # ビジネスロジック
│   │   ├── mqtt.service.ts           # MQTT通信
│   │   ├── event-processor.service.ts # イベント処理
│   │   ├── action-executor.service.ts # アクション実行
│   │   └── people-counter.service.ts  # 人数カウント
│   └── utils/               # ユーティリティ
├── docs/                     # プロジェクトドキュメント
├── config/                   # 外部サービス設定（Mosquitto等）
├── docker/                   # Docker関連ファイル
└── server-environment/       # サーバー環境設定（PR #1で追加予定）
    ├── docker-compose.yml   # サーバー用Docker Compose
    ├── mosquitto/           # MQTT設定
    ├── recorder/            # 映像録画サービス
    └── minio-data/          # MinIOデータ（自動生成・Git除外）
```

**詳細なディレクトリ構造については[docs/directory-structure.md](docs/directory-structure.md)を参照してください。**

## ドキュメント

詳細なドキュメントは[docs/](docs/)ディレクトリを参照してください：

- [ドキュメントの読み方](docs/README.md)
- [ディレクトリ構造ガイド](docs/directory-structure.md) **← ディレクトリ構造と管理方法**
- [セットアップガイド](docs/setup-guide.md) **← 具体的な作業手順**
- [アーキテクチャ詳細](docs/architecture.md)
- [メッセージフォーマット](docs/message-format.md)
- [実装の設計判断](docs/design-decisions.md)
- [トラブルシューティング](docs/troubleshooting.md)

## ライセンス

ISC License

## コントリビューション

Pull Requestを歓迎します。大きな変更の場合は、まずIssueを作成して変更内容を議論してください。