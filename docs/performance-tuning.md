# パフォーマンスチューニングガイド

最終更新日: 2025年7月2日

## 概要

このドキュメントでは、Future Platformのパフォーマンスを最適化するための設定とテクニックを説明します。

## パフォーマンス指標

### 目標値

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| イベント処理レイテンシ | < 100ms | イベント受信から実行まで |
| メッセージスループット | > 1000 msg/s | MQTTメッセージ処理数 |
| CPU使用率 | < 50% | 平常時の使用率 |
| メモリ使用量 | < 1GB | Node.jsプロセス |
| 起動時間 | < 10s | コンテナ起動から接続まで |

## Node.js最適化

### 1. メモリ設定

```bash
# docker-compose.yml
services:
  integration-controller:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048 --optimize-for-size
```

### 2. クラスター化

複数CPUコアを活用する場合：

```typescript
// cluster.ts
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // ワーカープロセスでアプリケーション起動
  import('./index');
}
```

### 3. V8オプション

```bash
# 最適化オプション
NODE_OPTIONS="
  --max-old-space-size=2048
  --optimize-for-size
  --gc-interval=100
  --expose-gc
"
```

## MQTT最適化

### 1. 接続プール

```typescript
class MqttConnectionPool {
  private connections: MqttClient[] = [];
  private currentIndex = 0;
  
  constructor(size: number, options: IClientOptions) {
    for (let i = 0; i < size; i++) {
      this.connections.push(mqtt.connect(options));
    }
  }
  
  getConnection(): MqttClient {
    const client = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return client;
  }
}
```

### 2. メッセージバッチング

```typescript
class MessageBatcher {
  private buffer: SensorMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private batchSize: number,
    private flushInterval: number,
    private onFlush: (messages: SensorMessage[]) => void
  ) {}
  
  add(message: SensorMessage): void {
    this.buffer.push(message);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  private flush(): void {
    if (this.buffer.length === 0) return;
    
    this.onFlush([...this.buffer]);
    this.buffer = [];
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

### 3. QoS設定の最適化

```typescript
// 重要度に応じたQoS設定
const qosSettings = {
  state: 0,    // ベストエフォート（頻繁な更新）
  event: 1,    // 少なくとも1回配信
  critical: 2, // 確実に1回だけ配信
};
```

## データ処理の最適化

### 1. 状態履歴の効率的な管理

```typescript
class CircularBuffer<T> {
  private buffer: T[];
  private writeIndex = 0;
  private isFull = false;
  
  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }
  
  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    
    if (this.writeIndex === 0) {
      this.isFull = true;
    }
  }
  
  getAll(): T[] {
    if (!this.isFull) {
      return this.buffer.slice(0, this.writeIndex);
    }
    
    return [
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex)
    ];
  }
}
```

### 2. メモリ効率的なイベント処理

```typescript
// オブジェクトプールでGCを削減
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10
  ) {
    this.factory = factory;
    this.reset = reset;
    
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }
  
  acquire(): T {
    return this.pool.pop() || this.factory();
  }
  
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

## Docker最適化

### 1. マルチステージビルドの最適化

```dockerfile
# ビルドステージ
FROM node:20-alpine AS builder
WORKDIR /app

# 依存関係のキャッシュ活用
COPY package*.json ./
RUN npm ci --only=production

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# プロダクションステージ
FROM node:20-alpine
WORKDIR /app

# distrolessイメージの使用も検討
# FROM gcr.io/distroless/nodejs20-debian11

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 非rootユーザーで実行
USER node

CMD ["node", "dist/index.js"]
```

### 2. リソース制限

```yaml
# docker-compose.yml
services:
  integration-controller:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

## システムレベルの最適化

### 1. カーネルパラメータ

```bash
# /etc/sysctl.conf
# ネットワーク最適化
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300

# ファイルディスクリプタ
fs.file-max = 1000000
```

### 2. ulimit設定

```bash
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
```

## 監視とプロファイリング

### 1. パフォーマンス監視

```typescript
// performance-monitor.ts
import { performance } from 'perf_hooks';

class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    return result;
  }
  
  getStats(name: string): {
    avg: number;
    min: number;
    max: number;
    p95: number;
  } {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }
}
```

### 2. メモリプロファイリング

```typescript
// ヒープスナップショット
import v8 from 'v8';
import fs from 'fs';

function takeHeapSnapshot(): void {
  const filename = `heap-${Date.now()}.heapsnapshot`;
  const stream = fs.createWriteStream(filename);
  v8.writeHeapSnapshot(stream);
  logger.info(`Heap snapshot written to ${filename}`);
}

// 定期的なスナップショット
setInterval(takeHeapSnapshot, 3600000); // 1時間ごと
```

### 3. APMツールの統合

```typescript
// OpenTelemetryの例
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'integration-controller',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
});

provider.register();
```

## ボトルネック診断

### 1. 処理時間の計測

```typescript
class TimingMiddleware {
  async measure(next: () => Promise<void>): Promise<void> {
    const segments: { name: string; duration: number }[] = [];
    
    const measureSegment = async (name: string, fn: () => Promise<void>) => {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      segments.push({
        name,
        duration: Number(end - start) / 1_000_000, // ms
      });
    };
    
    await measureSegment('mqtt_receive', async () => {
      // MQTT受信処理
    });
    
    await measureSegment('validation', async () => {
      // バリデーション処理
    });
    
    await measureSegment('processing', async () => {
      // メイン処理
    });
    
    // 遅い処理を警告
    const total = segments.reduce((sum, s) => sum + s.duration, 0);
    if (total > 100) {
      logger.warn('Slow processing detected:', { segments, total });
    }
  }
}
```

### 2. リソース使用状況

```typescript
import os from 'os';

class ResourceMonitor {
  private interval: NodeJS.Timer;
  
  start(): void {
    this.interval = setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      logger.info('Resource usage:', {
        memory: {
          rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        },
        cpu: {
          user: Math.round(cpuUsage.user / 1000),
          system: Math.round(cpuUsage.system / 1000),
        },
        system: {
          loadAvg: os.loadavg(),
          freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
        },
      });
    }, 60000); // 1分ごと
  }
  
  stop(): void {
    clearInterval(this.interval);
  }
}
```

## チェックリスト

### デプロイ前の確認事項

- [ ] 本番用の環境変数が設定されている
- [ ] ログレベルが適切（info以上）
- [ ] リソース制限が設定されている
- [ ] ヘルスチェックが有効
- [ ] 監視が設定されている
- [ ] バックアップ方針が決まっている

### パフォーマンステスト

- [ ] 負荷テスト（1000 msg/s）を実施
- [ ] 長時間稼働テスト（24時間）を実施
- [ ] メモリリークがないことを確認
- [ ] CPU使用率が許容範囲内
- [ ] レスポンスタイムが目標値以内