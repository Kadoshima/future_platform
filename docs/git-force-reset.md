# Git強制リセット手順

## 概要
特定のコミットに現在のブランチを強制的にリセットし、リモートリポジトリに反映する手順。

## 実行したコマンド

### 1. 現在のコミットにハードリセット
```bash
git reset --hard HEAD
```
- 作業ディレクトリとステージングエリアを現在のコミット状態に完全にリセット
- 未コミットの変更は全て破棄される

### 2. 未追跡ファイルの削除
```bash
git clean -fd
```
- `-f`: 強制実行
- `-d`: ディレクトリも含めて削除
- 未追跡ファイルとディレクトリを全て削除

### 3. リモートに強制プッシュ
```bash
git push origin main --force
```
- `--force`: リモートの履歴を無視して強制的に上書き
- ⚠️ **危険**: 他の開発者の作業が失われる可能性

## 注意事項

### ⚠️ 使用前の確認事項
- 他の開発者が同じブランチで作業していないか確認
- 重要なコミットが失われないか確認
- バックアップを取っておく

### 🔒 より安全な代替手段
```bash
# 強制プッシュの代わりに
git push origin main --force-with-lease
```
- リモートの状態を確認してから強制プッシュ
- 他の人の変更がある場合は失敗する

## 今回の実行結果
- `8c89656` コミットの状態にリセット
- 未追跡ファイル（`src/core/`, `src/models/`, `src/plugins/`）を削除
- リモートは既に最新状態だったため、実際のプッシュは不要だった

## 使用場面
- 開発中のブランチを特定のコミットに戻したい場合
- 実験的な変更を全て破棄したい場合
- リモートブランチを特定の状態に強制的に合わせたい場合