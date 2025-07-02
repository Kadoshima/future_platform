# 設計判断の記録

最終更新日: 2025年7月2日

このドキュメントでは、Future Platformの実装において行った重要な設計判断とその理由を記録します。

## 1. なぜMQTTを選択したか

### 検討した選択肢

1. **MQTT** ✓ 採用
2. HTTP/REST API
3. WebSocket
4. gRPC
5. Apache Kafka

### 判断理由

**MQTT を選択した理由:**

- **軽量性**: Raspberry Piのような制約のあるデバイスに最適
- **Pub/Subパターン**: イベント駆動アーキテクチャに自然にフィット
- **QoS保証**: メッセージ配信の信頼性を3段階で制御可能
- **低帯域幅**: プロトコルオーバーヘッドが最小限
- **成熟度**: IoT分野での実績が豊富

**他の選択肢を却下した理由:**

- HTTP/REST: ポーリングが必要でリアルタイム性に欠ける
- WebSocket: 双方向通信は不要、Pub/Subの実装が必要
- gRPC: Raspberry Piには重すぎる、protobufの管理が煩雑
- Kafka: 小規模システムにはオーバースペック

## 2. TypeScriptの採用

### 判断理由

- **型安全性**: メッセージフォーマットの型定義により実行時エラーを削減
- **開発効率**: IDEの補完機能、リファクタリング支援
- **保守性**: 大規模になっても管理しやすい
- **エコシステム**: npm パッケージの豊富な選択肢

### 実装パターン

```typescript
// インターフェースによる契約の明確化
interface EventMessage {
  type: 'event';
  camera_id: string;
  timestamp: number;
  event: CameraEvent;
}

// ユニオン型による網羅性チェック
type SensorMessage = EventMessage | StateMessage;
```

## 3. 多数決アルゴリズムの設計

### 問題

複数のカメラが異なる人数を報告する場合、どれを信じるか？

### アルゴリズムの詳細

```typescript
// 実装の簡略版
function getMajorityCount(counts: number[]): number {
  // Step 1: 出現回数をカウント
  const countMap = new Map<number, number>();
  for (const count of counts) {
    countMap.set(count, (countMap.get(count) || 0) + 1);
  }

  // Step 2: 最頻値を見つける
  let majorityCount = 0;
  let maxOccurrences = 0;
  for (const [count, occurrences] of countMap) {
    if (occurrences > maxOccurrences) {
      maxOccurrences = occurrences;
      majorityCount = count;
    }
  }

  // Step 3: 同数の場合は保守的に（多い方を）選択
  // これにより、人の見落としを防ぐ
  
  return majorityCount;
}
```

### 設計判断

1. **3台以上で多数決**: 2台では判定不能なため
2. **同数時は多い方**: 安全側に倒す（人の見落としを防ぐ）
3. **中央値の不採用**: 外れ値の影響を受けやすいため

## 4. サービス分割の粒度

### サービス構成

```
services/
├── mqtt.service.ts           # 通信層
├── event-processor.service.ts # ビジネスロジック層
├── action-executor.service.ts # 実行層
└── people-counter.service.ts  # 特化機能層
```

### 判断理由

- **単一責任の原則**: 各サービスは1つの責務のみ
- **テスタビリティ**: 個別にモック化してテスト可能
- **拡張性**: 新機能追加時の影響範囲を限定

## 5. イベント駆動アーキテクチャ

### EventEmitterの活用

```typescript
class MqttService extends EventEmitter {
  // MQTTメッセージを内部イベントに変換
  private handleMessage(topic: string, payload: Buffer): void {
    const message = JSON.parse(payload.toString());
    if (message.type === 'event') {
      this.emit('camera_event', message);
    }
  }
}
```

### 利点

- **疎結合**: サービス間の依存を最小化
- **非同期処理**: ブロッキングを回避
- **拡張容易**: リスナーを追加するだけで新機能追加

## 6. 設定管理

### class-validatorの採用

```typescript
class EnvironmentVariables {
  @IsString()
  MQTT_BROKER_URL: string;

  @IsInt()
  @Min(1)
  MAJORITY_VOTE_THRESHOLD: number;
}
```

### 理由

- **起動時検証**: 設定ミスを早期発見
- **型安全**: 実行時の型エラーを防止
- **ドキュメント性**: 必須項目と型が明確

## 7. エラーハンドリング戦略

### 原則

1. **Fail-Fast**: 設定エラーは起動時に検出
2. **Graceful Degradation**: 一部機能の失敗でも継続動作
3. **自動リトライ**: ネットワークエラーは自動回復を試みる

### 実装例

```typescript
// MQTT再接続ロジック
private reconnectInterval = 5000;
private maxReconnectAttempts = 10;

// アクション実行の優先度付きキュー
if (priority === 'HIGH') {
  this.actionQueue.unshift(action);
}
```

## 8. ログ設計

### Winstonの採用理由

- **構造化ログ**: JSON形式で解析しやすい
- **ログレベル**: 環境別に出力制御
- **トランスポート**: ファイル、コンソール、外部サービスに対応

### ログレベルの使い分け

```typescript
logger.error()  // システムエラー、要対応
logger.warn()   // 異常だが継続可能
logger.info()   // 重要なイベント
logger.debug()  // デバッグ情報
```

## 9. Dockerコンテナ設計

### マルチステージビルド

```dockerfile
# ビルドステージ
FROM node:20-alpine AS builder
# TypeScriptをコンパイル

# 実行ステージ
FROM node:20-alpine
# 最小限の実行環境のみ
```

### 利点

- **イメージサイズ削減**: 開発依存を含まない
- **セキュリティ**: 攻撃対象面を最小化
- **再現性**: どの環境でも同じ動作

## 10. 将来の拡張ポイント

### 考慮した拡張性

1. **カスタムアクション**: `CUSTOM`タイプで任意の処理
2. **フィルター条件**: イベントルールに`condition`関数
3. **プラグイン機構**: EventEmitterによる疎結合
4. **水平スケーリング**: Redisによる状態共有（未実装）

### 意図的に実装しなかった機能

- **データベース**: 現時点では不要（将来はTimeSeries DB検討）
- **認証認可**: MQTTブローカーレベルで実装想定
- **WebUI**: 別プロジェクトとして分離予定