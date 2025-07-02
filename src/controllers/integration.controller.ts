import { MqttService } from '../services/mqtt.service';
import { EventProcessorService } from '../services/event-processor.service';
import { ActionExecutorService } from '../services/action-executor.service';
import { PeopleCounterService } from '../services/people-counter.service';
import { EventMessage, StateMessage } from '../interfaces/event.interface';
import logger from '../utils/logger';

export class IntegrationController {
  private mqttService: MqttService;
  private eventProcessor: EventProcessorService;
  private actionExecutor: ActionExecutorService;
  private peopleCounter: PeopleCounterService;
  private isRunning = false;

  constructor() {
    this.mqttService = new MqttService();
    this.eventProcessor = new EventProcessorService();
    this.actionExecutor = new ActionExecutorService();
    this.peopleCounter = new PeopleCounterService();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // MQTT event handlers
    this.mqttService.on('camera_event', this.handleCameraEvent.bind(this));
    this.mqttService.on('camera_state', this.handleCameraState.bind(this));
    this.mqttService.on('max_reconnect_exceeded', this.handleMqttReconnectFailed.bind(this));

    // People counter event handlers
    this.peopleCounter.on('count_changed', this.handleCountChanged.bind(this));

    // Event processor handlers
    this.eventProcessor.on('event_processed', this.handleEventProcessed.bind(this));
    this.eventProcessor.on('state_updated', this.handleStateUpdated.bind(this));

    // Action executor handlers
    this.actionExecutor.on('action_completed', this.handleActionCompleted.bind(this));
    this.actionExecutor.on('action_failed', this.handleActionFailed.bind(this));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Integration controller is already running');
      return;
    }

    try {
      logger.info('Starting integration controller...');
      
      // Connect to MQTT broker
      await this.mqttService.connect();
      
      this.isRunning = true;
      logger.info('Integration controller started successfully');
    } catch (error) {
      logger.error('Failed to start integration controller:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Integration controller is not running');
      return;
    }

    logger.info('Stopping integration controller...');
    
    // Disconnect from MQTT
    this.mqttService.disconnect();
    
    // Clear action queue
    this.actionExecutor.clearQueue();
    
    this.isRunning = false;
    logger.info('Integration controller stopped');
  }

  private async handleCameraEvent(event: EventMessage): Promise<void> {
    logger.info(`Received event: ${event.event.name} from camera: ${event.camera_id}`);
    
    try {
      // Process event and get actions to execute
      const actions = this.eventProcessor.processEvent(event);
      
      // Execute each action
      for (const action of actions) {
        await this.actionExecutor.executeAction(action);
      }
    } catch (error) {
      logger.error('Error handling camera event:', error);
    }
  }

  private handleCameraState(state: StateMessage): void {
    logger.debug(`Received state update from camera: ${state.camera_id}`);
    
    try {
      // Update event processor state history
      this.eventProcessor.processState(state);
      
      // Update people counter
      this.peopleCounter.updateCameraCount(state);
    } catch (error) {
      logger.error('Error handling camera state:', error);
    }
  }

  private handleCountChanged(data: {
    previousCount: number;
    currentCount: number;
    timestamp: number;
    cameraCounts: any[];
  }): void {
    logger.info(`People count changed: ${data.previousCount} -> ${data.currentCount}`);
    
    // You can add custom logic here based on count changes
    // For example, trigger specific actions when room becomes empty or occupied
    if (data.previousCount === 0 && data.currentCount > 0) {
      // Room became occupied
      this.actionExecutor.executeAction({
        type: 'CUSTOM',
        payload: {
          event: 'room_occupied',
          count: data.currentCount,
        },
      });
    } else if (data.previousCount > 0 && data.currentCount === 0) {
      // Room became empty
      this.actionExecutor.executeAction({
        type: 'CUSTOM',
        payload: {
          event: 'room_empty',
        },
      });
    }
  }

  private handleMqttReconnectFailed(): void {
    logger.error('MQTT reconnection failed - manual intervention required');
    // Could implement alerting or fallback behavior here
  }

  private handleEventProcessed(data: { event: EventMessage; actions: any[] }): void {
    logger.debug(`Event processed: ${data.event.event.name}, actions: ${data.actions.length}`);
  }

  private handleStateUpdated(state: StateMessage): void {
    logger.debug(`State updated for camera: ${state.camera_id}`);
  }

  private handleActionCompleted(action: any): void {
    logger.info(`Action completed: ${action.type}`);
  }

  private handleActionFailed(data: { action: any; error: any }): void {
    logger.error(`Action failed: ${data.action.type}`, data.error);
  }

  // Public methods for runtime configuration
  addEventRule(rule: any): void {
    this.eventProcessor.addEventRule(rule);
  }

  getStatistics(): any {
    return {
      mqtt: {
        connected: this.mqttService.isConnected(),
      },
      peopleCounter: this.peopleCounter.getStatistics(),
      actionQueue: {
        length: this.actionExecutor.getQueueLength(),
      },
      latestStates: Object.fromEntries(this.eventProcessor.getAllLatestStates()),
    };
  }

  resetPeopleCounter(): void {
    this.peopleCounter.resetCounter();
  }
}