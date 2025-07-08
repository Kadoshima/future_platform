# ドキュメント目次

Future Platform プロジェクトのドキュメント一覧

## 📖 基本ドキュメント

- **[ディレクトリ構造ガイド](directory-structure.md)** - プロジェクトの構造と管理方法
- **[アーキテクチャ詳細](architecture.md)** - システム全体の設計と構成
- **[メッセージフォーマット](message-format.md)** - MQTT通信の仕様

## 🔧 開発・運用ガイド

- **[API連携ガイド](api-integration.md)** - 外部システムとの連携方法
- **[Raspberry Piセットアップ](raspberry-pi-setup.md)** - センサーノードの設定手順
- **[パフォーマンス調整](performance-tuning.md)** - システム最適化の方法

## 📋 参考資料

- **[設計判断の記録](design-decisions.md)** - 実装時の設計判断
- **[トラブルシューティング](troubleshooting.md)** - よくある問題と解決方法

## 🆘 よくある質問

### ディレクトリ構造について
- **Q: `server-environment/` ディレクトリの目的は？**
  - A: サーバー環境のDocker設定をまとめて管理するディレクトリです。詳細は[ディレクトリ構造ガイド](directory-structure.md)を参照してください。

### ファイル管理について  
- **Q: MinIOの`.minio.sys/`ファイルがコミットされてしまった場合は？**
  - A: これらは自動生成ファイルです。[ディレクトリ構造ガイド](directory-structure.md#よくある質問)の手順でGit追跡から除外してください。

### セットアップについて
- **Q: 開発環境のセットアップ方法は？**
  - A: メインの[README.md](../README.md)のセットアップセクションを参照してください。