# メッセージフォーマット仕様

最終更新日: 2025年7月2日

## 概要

Future Platformでは、全ての通信にJSON形式のメッセージを使用します。メッセージは大きく2種類に分類されます。

## メッセージタイプ

### 1. イベントメッセージ（Event Message）

特定の事象が発生したことを通知するメッセージです。

#### フォーマット

```typescript
{
  "type": "event",
  "camera_id": string,
  "timestamp": number,
  "event": {
    "name": string,
    "command_request"?: string
  }
}
```

#### フィールド説明

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| type | string | ✓ | 固定値 "event" |
| camera_id | string | ✓ | カメラの識別子（例: "camera1"） |
| timestamp | number | ✓ | Unix timestamp (ミリ秒) |
| event.name | string | ✓ | イベント名（後述） |
| event.command_request | string | - | 実行を要求するコマンド |

#### イベント名一覧

| イベント名 | 説明 | 発生条件 |
|-----------|------|----------|
| PERSON_ENTERED | 人物が入室 | 新たな人物を検出 |
| SITTING_CONFIRMED | 着席確認 | 2秒以上着席状態を維持 |
| PERSON_STOOD_UP | 立ち上がり | 着席者が立ち上がった |
| ALL_PEOPLE_LEFT | 全員退室 | 人数が0になった |

#### サンプル

```json
{
  "type": "event",
  "camera_id": "camera1",
  "timestamp": 1719900000000,
  "event": {
    "name": "SITTING_CONFIRMED",
    "command_request": "play_welcome_video"
  }
}
```

### 2. 状態メッセージ（State Message）

現在の状態を定期的に通知するメッセージです。

#### フォーマット

```typescript
{
  "type": "state",
  "camera_id": string,
  "timestamp": number,
  "data": {
    "person_count": number,
    "people": Array<{
      "id": string,
      "posture": string,
      "confidence": number
    }>
  }
}
```

#### フィールド説明

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| type | string | ✓ | 固定値 "state" |
| camera_id | string | ✓ | カメラの識別子 |
| timestamp | number | ✓ | Unix timestamp (ミリ秒) |
| data.person_count | number | ✓ | 検出された人数 |
| data.people | array | ✓ | 人物の詳細情報配列 |
| people[].id | string | ✓ | 人物の一時的ID |
| people[].posture | string | ✓ | 姿勢（後述） |
| people[].confidence | number | ✓ | 検出信頼度（0.0-1.0） |

#### 姿勢タイプ

| 姿勢 | 説明 |
|------|------|
| SITTING | 座っている |
| STANDING | 立っている |
| WALKING | 歩いている |
| UNKNOWN | 判定不能 |

#### サンプル

```json
{
  "type": "state",
  "camera_id": "camera2",
  "timestamp": 1719900001000,
  "data": {
    "person_count": 2,
    "people": [
      {
        "id": "person_001",
        "posture": "SITTING",
        "confidence": 0.95
      },
      {
        "id": "person_002",
        "posture": "STANDING",
        "confidence": 0.87
      }
    ]
  }
}
```

## MQTTトピック構造

### トピック命名規則

```
sensor/{camera_id}/{message_type}
```

- `{camera_id}`: カメラの識別子（camera1, camera2, など）
- `{message_type}`: メッセージタイプ（state, event）

### 例

- `sensor/camera1/state` - camera1からの状態メッセージ
- `sensor/camera3/event` - camera3からのイベントメッセージ

### サブスクリプション

統合管理システムは以下のワイルドカードを使用してサブスクライブ：

- `sensor/+/state` - 全カメラの状態メッセージ
- `sensor/+/event` - 全カメラのイベントメッセージ

## バリデーションルール

### 必須フィールドチェック

1. `type`フィールドは必須で、"event"または"state"のみ許可
2. `camera_id`は空文字列不可
3. `timestamp`は正の数値
4. イベントメッセージの`event.name`は定義済みの値のみ
5. 状態メッセージの`person_count`は0以上の整数

### データ整合性

1. `person_count`と`people`配列の長さは一致すること
2. `confidence`は0.0から1.0の範囲内
3. `timestamp`は現在時刻から大きく乖離していないこと（±5分以内）

## エラーハンドリング

### パースエラー

JSONパースに失敗した場合、メッセージは破棄され、エラーログが記録されます。

```typescript
logger.error('Failed to parse MQTT message:', error);
logger.error('Raw payload:', payload.toString());
```

### バリデーションエラー

バリデーションに失敗したメッセージは処理されず、警告ログが記録されます。

## 拡張性

### カスタムイベント

新しいイベントタイプを追加する場合：

1. `interfaces/event.interface.ts`の`CameraEvent`型を更新
2. `services/event-processor.service.ts`にデフォルトルールを追加

### カスタムフィールド

将来の拡張のため、各メッセージに追加フィールドを含めることができます。既存のフィールドは後方互換性のため維持されます。

## ベストプラクティス

1. **タイムスタンプ**: 常にミリ秒精度のUnixタイムスタンプを使用
2. **ID生成**: カメラIDは一意で永続的、人物IDはセッション内で一意
3. **頻度**: 状態メッセージは1秒に1回程度、イベントは発生時のみ
4. **サイズ**: 1メッセージは10KB以下を推奨