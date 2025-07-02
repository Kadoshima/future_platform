import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { EventEmitter } from 'events';
import { config } from '../config';
import logger from '../utils/logger';
import { SensorMessage } from '../interfaces/event.interface';

export class MqttService extends EventEmitter {
  private client: MqttClient | null = null;
  private reconnectInterval = 5000;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    const options: IClientOptions = {
      clientId: config.MQTT_CLIENT_ID,
      username: config.MQTT_USERNAME || undefined,
      password: config.MQTT_PASSWORD || undefined,
      reconnectPeriod: this.reconnectInterval,
      clean: true,
    };

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(config.MQTT_BROKER_URL, options);

      this.client.on('connect', () => {
        logger.info('Connected to MQTT broker');
        this.reconnectAttempts = 0;
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('error', (error) => {
        logger.error('MQTT connection error:', error);
        reject(error);
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        logger.info(`Reconnecting to MQTT broker (attempt ${this.reconnectAttempts})`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max reconnection attempts reached');
          this.disconnect();
          this.emit('max_reconnect_exceeded');
        }
      });

      this.client.on('message', this.handleMessage.bind(this));

      this.client.on('close', () => {
        logger.warn('MQTT connection closed');
      });
    });
  }

  private subscribeToTopics(): void {
    if (!this.client) return;

    const topics = [config.MQTT_STATE_TOPIC, config.MQTT_EVENT_TOPIC];

    this.client.subscribe(topics, (error) => {
      if (error) {
        logger.error('Failed to subscribe to topics:', error);
      } else {
        logger.info(`Subscribed to topics: ${topics.join(', ')}`);
      }
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message: SensorMessage = JSON.parse(payload.toString());
      
      // Extract camera ID from topic (e.g., sensor/camera1/state -> camera1)
      const topicParts = topic.split('/');
      const cameraId = topicParts[1];

      if (message.camera_id !== cameraId) {
        logger.warn(`Camera ID mismatch: topic=${cameraId}, message=${message.camera_id}`);
      }

      // Emit different events based on message type
      if (message.type === 'event') {
        this.emit('camera_event', message);
      } else if (message.type === 'state') {
        this.emit('camera_state', message);
      }

      // Also emit a general message event
      this.emit('message', { topic, message });
    } catch (error) {
      logger.error('Failed to parse MQTT message:', error);
      logger.error('Raw payload:', payload.toString());
    }
  }

  async publish(topic: string, message: any): Promise<void> {
    if (!this.client || !this.client.connected) {
      throw new Error('MQTT client is not connected');
    }

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(message);
      
      this.client!.publish(topic, payload, { qos: 1 }, (error) => {
        if (error) {
          logger.error(`Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          logger.debug(`Published to ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      logger.info('Disconnected from MQTT broker');
    }
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }
}