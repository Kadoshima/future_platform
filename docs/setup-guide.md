# セットアップガイド - ディレクトリ構造の準備

最終更新日: 2025年7月8日

## この文書について

このガイドは、Issue #2「どういうディレクトリ構造になるんですか？どうしたらよいのですか？」への回答として、プロジェクトのディレクトリ構造の準備と管理方法を具体的に説明します。

## 🚀 クイックスタート: 今すぐやるべきこと

### 1. 現在の状況確認

```bash
# 現在のディレクトリ構造を確認
tree -I 'node_modules|.git' -a

# または ls -la で確認
ls -la
```

### 2. .gitignore の適用確認

```bash
# .gitignore が正しく設定されているか確認
git status

# もしMinIOファイルが追跡されている場合は除外
git rm --cached server-environment/minio-data/.minio.sys/format.json
git rm --cached -r server-environment/minio-data/.minio.sys/
```

### 3. 自動生成ディレクトリの確認

以下のディレクトリは**自動生成**されるため、手動で作成する必要はありません：

```bash
# これらは Docker 起動時に自動作成されます（手動作成不要）
server-environment/minio-data/
server-environment/mosquitto/data/
server-environment/mosquitto/log/
server-environment/videos/
```

## 📁 ディレクトリ構造の準備手順

### ステップ1: 基本構造の確認

現在のプロジェクトには以下の構造があります：

```bash
future_platform/
├── src/                  # ✅ 存在する（統合管理システム）
├── docs/                 # ✅ 存在する（ドキュメント）  
├── config/               # ✅ 存在する（設定ファイル）
├── docker/               # ✅ 存在する（Docker設定）
└── server-environment/   # ⚠️  PR #1 で追加予定
```

### ステップ2: PR #1 マージ後の対応

PR #1がマージされた場合、以下のディレクトリが追加されます：

```bash
server-environment/
├── docker-compose.yml    # サーバー用 Docker Compose
├── .gitignore           # サーバー環境固有の除外設定
├── mosquitto/           # MQTT設定
│   └── config/
├── recorder/            # 録画サービス
│   ├── Dockerfile
│   └── recorder.sh
├── minio-data/          # 🚫 自動生成（Gitにコミット禁止）
├── mosquitto/
│   ├── data/            # 🚫 自動生成（Gitにコミット禁止）
│   └── log/             # 🚫 自動生成（Gitにコミット禁止）
└── videos/              # 🚫 自動生成（Gitにコミット禁止）
```

### ステップ3: 自動生成ファイルの除外確認

```bash
# .gitignore の設定を確認
cat .gitignore | grep -A 10 "Server environment"

# 以下が含まれていることを確認
# server-environment/minio-data/
# server-environment/mosquitto/data/
# server-environment/mosquitto/log/
# **/.minio.sys/
```

## 🔧 実際の作業手順

### 開発環境の場合

```bash
# 1. 依存関係インストール
npm install

# 2. TypeScript ビルド
npm run build

# 3. 開発サーバー起動
npm run dev
```

### サーバー環境の場合（PR #1 マージ後）

```bash
# 1. サーバー環境ディレクトリに移動
cd server-environment/

# 2. Docker Compose でサービス起動
docker compose up --build

# 3. MinIO 管理画面確認（http://localhost:9002）
# 4. MQTT ブローカー確認（ポート 1883）
```

## ⚠️ よくある間違いと対処法

### 問題1: MinIO システムファイルをコミットしてしまった

```bash
# 解決方法
git rm --cached server-environment/minio-data/.minio.sys/format.json
git rm --cached -r server-environment/minio-data/.minio.sys/
git commit -m "Remove MinIO system files from version control"
```

### 問題2: データディレクトリが手動で作成されている

```bash
# 不要なディレクトリを削除
rm -rf server-environment/minio-data/
rm -rf server-environment/mosquitto/data/
rm -rf server-environment/mosquitto/log/

# Docker起動時に自動作成されます
docker compose up
```

### 問題3: ディレクトリ構造が不明

```bash
# 構造を可視化
tree -I 'node_modules|.git|dist|coverage' -a

# 詳細なドキュメントを参照
cat docs/directory-structure.md
```

## 📋 チェックリスト

作業前に以下を確認してください：

- [ ] `.gitignore` が最新版に更新されている
- [ ] `server-environment/minio-data/` 等の自動生成ディレクトリがGit追跡から除外されている
- [ ] `docs/directory-structure.md` を読んで全体構造を理解している
- [ ] Docker Desktop がインストールされている（サーバー環境用）
- [ ] Node.js 20+ がインストールされている（開発用）

## 🆘 困った時は

1. **まず確認**: [docs/directory-structure.md](directory-structure.md) を読む
2. **構造確認**: `tree` コマンドで現在の構造を可視化
3. **Git状態確認**: `git status` で追跡されるファイルを確認
4. **Issue作成**: それでも不明な場合は GitHub Issue を作成

## まとめ

ディレクトリ構造について覚えておくべき要点：

1. **統合管理システム** (`src/`) と **サーバー環境** (`server-environment/`) は分離されている
2. **自動生成ディレクトリ** はGitにコミットしない（.gitignore で除外済み）
3. **PR #1がマージされるまで** は `server-environment/` は存在しない
4. **不明な点があれば** まず `docs/directory-structure.md` を参照

このガイドに従って作業すれば、ディレクトリ構造の管理で困ることはありません。