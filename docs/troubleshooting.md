# トラブルシューティングガイド

最終更新日: 2025年7月2日

## よくある問題と解決方法

### 1. MQTT接続エラー

#### 症状
```
Error: connect ECONNREFUSED 127.0.0.1:1883
```

#### 原因と対処

**原因1: MQTTブローカーが起動していない**
```bash
# Dockerコンテナの状態確認
docker-compose ps

# Mosquittoの起動
docker-compose up -d mosquitto

# ログ確認
docker-compose logs mosquitto
```

**原因2: ファイアウォール/ポート問題**
```bash
# ポートが開いているか確認
netstat -an | grep 1883
# または
lsof -i :1883

# ファイアウォール設定確認（Ubuntu/Debian）
sudo ufw status
```

**原因3: 環境変数の設定ミス**
```bash
# .envファイルの確認
cat .env | grep MQTT_BROKER_URL

# 正しい形式
MQTT_BROKER_URL=mqtt://localhost:1883  # 開発環境
MQTT_BROKER_URL=mqtt://mosquitto:1883  # Docker環境
```

### 2. 人数カウントが正しくない

#### 症状
- 実際の人数と報告される人数が異なる
- カウントが頻繁に変動する

#### 診断手順

1. **各カメラの状態を確認**
```bash
# MQTTメッセージをモニタリング
docker exec -it mqtt-broker mosquitto_sub -t "sensor/+/state" -v
```

2. **統計情報の確認**
```typescript
// コントローラーに統計取得APIを実装している場合
const stats = controller.getStatistics();
console.log(stats.peopleCounter);
```

#### 対処方法

**原因1: カメラの検出精度が低い**
- Raspberry Pi側の検出閾値を調整
- カメラの位置や角度を最適化

**原因2: ネットワーク遅延**
```bash
# .envで古いデータの閾値を調整（デフォルト30秒）
STALE_DATA_THRESHOLD=60000  # 60秒に延長
```

**原因3: 多数決の閾値設定**
```bash
# カメラ台数に応じて調整
MAJORITY_VOTE_THRESHOLD=2  # 2台の場合
MAJORITY_VOTE_THRESHOLD=3  # 3-4台の場合
```

### 3. アクションが実行されない

#### 症状
- イベントは受信しているが、動画や音声が再生されない

#### デバッグ手順

1. **ログレベルを上げる**
```bash
# .env
LOG_LEVEL=debug
```

2. **イベント処理の確認**
```typescript
// ログで以下を確認
"Processing event: SITTING_CONFIRMED from camera: camera1"
"Generated 1 actions for event: SITTING_CONFIRMED"
```

3. **アクション実行の確認**
```typescript
// 期待されるログ
"Executing video play action: welcome_video"
"Video play command sent successfully: welcome_video"
```

#### 対処方法

**原因1: 外部APIが応答しない**
```bash
# APIエンドポイントの疎通確認
curl -X POST http://localhost:8080/play \
  -H "Content-Type: application/json" \
  -d '{"videoId": "test"}'
```

**原因2: イベントルールが設定されていない**
```typescript
// event-processor.service.tsを確認
// デフォルトルールが初期化されているか
```

### 4. メモリ使用量が増加し続ける

#### 症状
- 長時間運用でメモリ使用量が増加
- 最終的にOOMエラー

#### 診断

```bash
# Dockerコンテナのリソース使用状況
docker stats integration-controller

# Node.jsのヒープダンプ取得
kill -USR2 <PID>
```

#### 対処方法

**原因1: 履歴データの蓄積**
```typescript
// 履歴サイズの制限を確認
private maxHistorySize = 100;  // 適切な値に調整
```

**原因2: イベントリスナーのリーク**
```typescript
// 適切にリスナーを削除
componentWillUnmount() {
  this.mqttService.removeAllListeners();
}
```

### 5. Docker関連の問題

#### コンテナが起動しない

```bash
# ログ確認
docker-compose logs integration-controller

# イメージの再ビルド
docker-compose build --no-cache integration-controller

# ボリュームのクリーンアップ
docker-compose down -v
```

#### ネットワーク接続の問題

```bash
# ネットワークの確認
docker network ls
docker network inspect future_platform_future-platform

# コンテナ間の疎通確認
docker exec -it integration-controller ping mosquitto
```

## ログの見方

### ログレベルの意味

| レベル | 説明 | 例 |
|-------|------|-----|
| error | システムエラー、要対応 | MQTT接続失敗 |
| warn | 異常だが継続可能 | 古いデータの削除 |
| info | 重要なイベント | イベント受信、アクション実行 |
| debug | デバッグ情報 | 詳細な処理フロー |

### 重要なログパターン

```bash
# 正常な起動
"Starting integration controller..."
"Connected to MQTT broker"
"Subscribed to topics: sensor/+/state, sensor/+/event"
"Integration controller started successfully"

# イベント処理
"Received event: PERSON_ENTERED from camera: camera1"
"Processing event: PERSON_ENTERED from camera: camera1"
"Generated 1 actions for event: PERSON_ENTERED"

# エラーパターン
"MQTT connection error:"
"Failed to execute action"
"Max reconnection attempts reached"
```

## パフォーマンスチューニング

### CPU使用率が高い

1. **ログレベルの調整**
```bash
LOG_LEVEL=info  # debugからinfoに変更
```

2. **処理間隔の調整**
```typescript
// 統計情報の更新頻度を下げる
setInterval(() => {
  const stats = controller.getStatistics();
}, 300000); // 5分ごとに変更
```

### ネットワーク帯域の最適化

1. **MQTTのQoS設定**
```typescript
// 重要度に応じてQoSを調整
client.publish(topic, payload, { qos: 0 }); // ベストエフォート
client.publish(topic, payload, { qos: 1 }); // 少なくとも1回
```

2. **メッセージサイズの削減**
- 不要なフィールドを削除
- 更新頻度の見直し

## 緊急時の対処

### システムの強制リセット

```bash
# 全サービスの停止
docker-compose down

# データのクリア（注意：録画データも削除される）
docker volume prune

# 再起動
docker-compose up -d
```

### 特定のカメラを無効化

```typescript
// 一時的にカメラを無視する設定
const IGNORED_CAMERAS = ['camera3'];

if (IGNORED_CAMERAS.includes(message.camera_id)) {
  return; // 処理をスキップ
}
```

## サポート情報

### ログの収集

問題報告時は以下の情報を含めてください：

```bash
# システム情報
docker version
docker-compose version
node --version

# ログの収集
docker-compose logs --tail=1000 > system_logs.txt

# 環境変数（機密情報は除く）
grep -v PASSWORD .env > env_info.txt
```

### デバッグモード

開発環境でのみ使用：

```bash
# Node.jsのデバッグポート有効化
NODE_OPTIONS="--inspect=0.0.0.0:9229" npm run dev
```