# API連携ガイド

最終更新日: 2025年7月2日

## 概要

統合管理システムは、動画再生システムや音声案内システムなどの外部APIと連携してアクションを実行します。このドキュメントでは、既存のAPIとの連携方法と、新しいAPIを追加する方法を説明します。

## 既存のAPI連携

### 1. 動画再生システム

#### エンドポイント

```
POST {VIDEO_PLAYER_API_URL}/play
```

#### リクエスト形式

```json
{
  "videoId": "welcome_video",
  "loop": false,
  "volume": 0.8
}
```

#### レスポンス形式

```json
{
  "success": true,
  "playbackId": "pb_12345",
  "duration": 120
}
```

#### 実装例

```typescript
private async executeVideoPlay(payload: VideoPlayAction): Promise<void> {
  const response = await fetch(`${config.VIDEO_PLAYER_API_URL}/play`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoId: payload.videoId,
      loop: payload.loop || false,
      volume: payload.volume || 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Video play failed: ${response.statusText}`);
  }

  const result = await response.json();
  logger.info(`Video playback started: ${result.playbackId}`);
}
```

### 2. 音声案内システム

#### エンドポイント

```
POST {AUDIO_PLAYER_API_URL}/play
```

#### リクエスト形式

```json
{
  "audioId": "welcome_audio",
  "text": "いらっしゃいませ",
  "volume": 0.7,
  "language": "ja-JP"
}
```

#### 音声合成の使用

audioIdの代わりにtextを指定すると、テキスト読み上げが実行されます。

```typescript
// 事前録音された音声
{ "audioId": "welcome_001" }

// テキスト読み上げ
{ "text": "本日は晴天なり", "language": "ja-JP" }
```

## 新しいAPIの追加

### 1. アクションタイプの定義

`src/interfaces/action.interface.ts`に新しいアクションタイプを追加：

```typescript
export interface LightControlAction {
  lightId: string;
  brightness: number;  // 0-100
  color?: string;      // Hex color code
}

// ActionRequestのtypeに追加
export interface ActionRequest {
  type: 'VIDEO_PLAY' | 'AUDIO_PLAY' | 'LIGHT_CONTROL' | 'CUSTOM';
  payload: Record<string, any>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}
```

### 2. 実行ロジックの実装

`src/services/action-executor.service.ts`に処理を追加：

```typescript
private async processQueue(): Promise<void> {
  // ... existing code ...
  
  switch (action.type) {
    case 'VIDEO_PLAY':
      await this.executeVideoPlay(action.payload as VideoPlayAction);
      break;
    case 'AUDIO_PLAY':
      await this.executeAudioPlay(action.payload as AudioPlayAction);
      break;
    case 'LIGHT_CONTROL':  // 新規追加
      await this.executeLightControl(action.payload as LightControlAction);
      break;
    case 'CUSTOM':
      await this.executeCustomAction(action.payload);
      break;
  }
}

private async executeLightControl(payload: LightControlAction): Promise<void> {
  logger.info(`Controlling light: ${payload.lightId}`);
  
  try {
    const response = await fetch(`${config.LIGHT_CONTROL_API_URL}/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.LIGHT_CONTROL_API_KEY}`,
      },
      body: JSON.stringify({
        deviceId: payload.lightId,
        settings: {
          brightness: payload.brightness,
          color: payload.color,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Light control failed: ${response.statusText}`);
    }

    logger.info(`Light control successful: ${payload.lightId}`);
  } catch (error) {
    throw new Error(`Light control failed: ${error}`);
  }
}
```

### 3. 環境変数の追加

`.env`ファイルに新しいAPI設定を追加：

```env
# Light Control API
LIGHT_CONTROL_API_URL=http://localhost:8082
LIGHT_CONTROL_API_KEY=your-api-key-here
```

`src/config/index.ts`に設定を追加：

```typescript
class EnvironmentVariables {
  // ... existing fields ...
  
  @IsString()
  LIGHT_CONTROL_API_URL: string = process.env.LIGHT_CONTROL_API_URL || 'http://localhost:8082';
  
  @IsString()
  LIGHT_CONTROL_API_KEY: string = process.env.LIGHT_CONTROL_API_KEY || '';
}
```

### 4. イベントルールの設定

新しいアクションを使用するルールを追加：

```typescript
// 人が入室したら照明を明るくする
this.addEventRule({
  eventName: 'PERSON_ENTERED',
  actions: [{
    type: 'LIGHT_CONTROL',
    payload: {
      lightId: 'room_main',
      brightness: 80,
      color: '#FFFFFF',
    },
    priority: 'HIGH',
  }],
});

// 全員が退室したら照明を暗くする
this.addEventRule({
  eventName: 'ALL_PEOPLE_LEFT',
  actions: [{
    type: 'LIGHT_CONTROL',
    payload: {
      lightId: 'room_main',
      brightness: 20,
      color: '#FFA500',  // オレンジ色
    },
    priority: 'NORMAL',
  }],
});
```

## HTTPクライアントの実装

### 推奨: axios の使用

現在の実装では簡易的なfetch APIを想定していますが、本番環境では`axios`の使用を推奨します：

```bash
npm install axios
```

```typescript
import axios from 'axios';

class ApiClient {
  private videoClient = axios.create({
    baseURL: config.VIDEO_PLAYER_API_URL,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  async playVideo(payload: VideoPlayAction): Promise<void> {
    try {
      const response = await this.videoClient.post('/play', payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('API request failed:', error.response?.data);
      }
      throw error;
    }
  }
}
```

### リトライロジック

```typescript
import axiosRetry from 'axios-retry';

axiosRetry(this.videoClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 503;
  },
});
```

## 認証パターン

### 1. APIキー認証

```typescript
headers: {
  'X-API-Key': config.API_KEY,
}
```

### 2. Bearer Token認証

```typescript
headers: {
  'Authorization': `Bearer ${config.ACCESS_TOKEN}`,
}
```

### 3. Basic認証

```typescript
const auth = Buffer.from(`${username}:${password}`).toString('base64');
headers: {
  'Authorization': `Basic ${auth}`,
}
```

## エラーハンドリング

### タイムアウト設定

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeout);
}
```

### エラー分類

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

// 使用例
if (response.status >= 500) {
  throw new ApiError(
    'Server error',
    response.status,
    url,
    true  // リトライ可能
  );
}
```

## モックサーバーの実装

開発・テスト用のモックサーバー例：

```typescript
// mock-server.ts
import express from 'express';

const app = express();
app.use(express.json());

// 動画再生API
app.post('/play', (req, res) => {
  console.log('Video play request:', req.body);
  res.json({
    success: true,
    playbackId: `pb_${Date.now()}`,
    duration: 120,
  });
});

// 音声案内API
app.post('/audio/play', (req, res) => {
  console.log('Audio play request:', req.body);
  res.json({
    success: true,
    playbackId: `audio_${Date.now()}`,
  });
});

app.listen(8080, () => {
  console.log('Mock API server running on port 8080');
});
```

## ベストプラクティス

### 1. サーキットブレーカーパターン

外部APIの障害がシステム全体に波及しないように：

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= 5) {
      this.state = 'OPEN';
    }
  }
}
```

### 2. レート制限

APIの利用制限を守る：

```typescript
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  
  constructor(
    private maxConcurrent: number,
    private minInterval: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    try {
      return await fn();
    } finally {
      setTimeout(() => {
        this.running--;
        this.processQueue();
      }, this.minInterval);
    }
  }

  private async waitForSlot(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next();
      }
    }
  }
}
```

### 3. ヘルスチェック

外部APIの可用性を定期的に確認：

```typescript
class HealthChecker {
  private statuses = new Map<string, boolean>();

  async checkAll(): Promise<void> {
    const checks = [
      this.checkVideoApi(),
      this.checkAudioApi(),
      // 他のAPIチェック
    ];

    await Promise.allSettled(checks);
  }

  private async checkVideoApi(): Promise<void> {
    try {
      const response = await fetch(`${config.VIDEO_PLAYER_API_URL}/health`);
      this.statuses.set('video_api', response.ok);
    } catch {
      this.statuses.set('video_api', false);
    }
  }

  getStatus(api: string): boolean {
    return this.statuses.get(api) || false;
  }
}
```