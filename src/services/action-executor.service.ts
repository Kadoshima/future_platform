import { EventEmitter } from 'events';
import { ActionRequest, VideoPlayAction, AudioPlayAction } from '../interfaces/action.interface';
import { config } from '../config';
import logger from '../utils/logger';

export class ActionExecutorService extends EventEmitter {
  private actionQueue: ActionRequest[] = [];
  private isProcessing = false;

  constructor() {
    super();
  }

  async executeAction(action: ActionRequest): Promise<void> {
    const priority = action.priority || 'NORMAL';
    
    // Add to queue based on priority
    if (priority === 'HIGH') {
      this.actionQueue.unshift(action);
    } else {
      this.actionQueue.push(action);
    }

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.actionQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const action = this.actionQueue.shift()!;

    try {
      switch (action.type) {
        case 'VIDEO_PLAY':
          await this.executeVideoPlay(action.payload as VideoPlayAction);
          break;
        case 'AUDIO_PLAY':
          await this.executeAudioPlay(action.payload as AudioPlayAction);
          break;
        case 'CUSTOM':
          await this.executeCustomAction(action.payload);
          break;
        default:
          logger.warn(`Unknown action type: ${action.type}`);
      }

      this.emit('action_completed', action);
    } catch (error) {
      logger.error(`Failed to execute action ${action.type}:`, error);
      this.emit('action_failed', { action, error });
    }

    // Continue processing queue
    await this.processQueue();
  }

  private async executeVideoPlay(payload: VideoPlayAction): Promise<void> {
    logger.info(`Executing video play action: ${payload.videoId}`);
    
    try {
      // In a real implementation, this would make an HTTP request to the video player API
      await this.makeApiRequest(config.VIDEO_PLAYER_API_URL, {
        method: 'POST',
        endpoint: '/play',
        data: {
          videoId: payload.videoId,
          loop: payload.loop || false,
          volume: payload.volume || 1.0,
        },
      });

      logger.info(`Video play command sent successfully: ${payload.videoId}`);
    } catch (error) {
      throw new Error(`Video play failed: ${error}`);
    }
  }

  private async executeAudioPlay(payload: AudioPlayAction): Promise<void> {
    logger.info(`Executing audio play action: ${payload.audioId || payload.text}`);
    
    try {
      // In a real implementation, this would make an HTTP request to the audio player API
      await this.makeApiRequest(config.AUDIO_PLAYER_API_URL, {
        method: 'POST',
        endpoint: '/play',
        data: {
          audioId: payload.audioId,
          text: payload.text,
          volume: payload.volume || 1.0,
        },
      });

      logger.info(`Audio play command sent successfully`);
    } catch (error) {
      throw new Error(`Audio play failed: ${error}`);
    }
  }

  private async executeCustomAction(payload: Record<string, any>): Promise<void> {
    logger.info('Executing custom action:', payload);
    
    // Emit custom action event for external handlers
    this.emit('custom_action', payload);
  }

  private async makeApiRequest(baseUrl: string, options: {
    method: string;
    endpoint: string;
    data?: any;
  }): Promise<any> {
    // This is a placeholder for actual HTTP request implementation
    // In production, you would use axios, fetch, or another HTTP client
    logger.debug(`API Request to ${baseUrl}${options.endpoint}:`, options.data);
    
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true });
      }, 100);
    });
  }

  getQueueLength(): number {
    return this.actionQueue.length;
  }

  clearQueue(): void {
    this.actionQueue = [];
    logger.info('Action queue cleared');
  }
}