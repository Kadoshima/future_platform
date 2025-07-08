import { EventEmitter } from 'events';
import { EventMessage, StateMessage } from '../interfaces/event.interface';
import { ActionRequest } from '../interfaces/action.interface';
import logger from '../utils/logger';

interface EventRule {
  eventName: string;
  condition?: (event: EventMessage) => boolean;
  actions: ActionRequest[];
}

export class EventProcessorService extends EventEmitter {
  private eventRules: Map<string, EventRule[]> = new Map();
  private stateHistory: Map<string, StateMessage[]> = new Map();
  private maxHistorySize = 100;

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Default rule for SITTING_CONFIRMED event
    this.addEventRule({
      eventName: 'SITTING_CONFIRMED',
      actions: [{
        type: 'VIDEO_PLAY',
        payload: {
          videoId: 'welcome_video',
          loop: false,
          volume: 0.8,
        },
        priority: 'HIGH',
      }],
    });

    // Default rule for ALL_PEOPLE_LEFT event
    this.addEventRule({
      eventName: 'ALL_PEOPLE_LEFT',
      actions: [{
        type: 'VIDEO_PLAY',
        payload: {
          videoId: 'idle_video',
          loop: true,
          volume: 0.5,
        },
        priority: 'NORMAL',
      }],
    });

    // Default rule for PERSON_ENTERED event
    this.addEventRule({
      eventName: 'PERSON_ENTERED',
      actions: [{
        type: 'AUDIO_PLAY',
        payload: {
          text: 'いらっしゃいませ',
          volume: 0.7,
        },
        priority: 'HIGH',
      }],
    });
  }

  addEventRule(rule: EventRule): void {
    const rules = this.eventRules.get(rule.eventName) || [];
    rules.push(rule);
    this.eventRules.set(rule.eventName, rules);
    logger.info(`Added event rule for: ${rule.eventName}`);
  }

  removeEventRule(eventName: string, ruleIndex: number): void {
    const rules = this.eventRules.get(eventName);
    if (rules && rules[ruleIndex]) {
      rules.splice(ruleIndex, 1);
      logger.info(`Removed event rule for: ${eventName}`);
    }
  }

  processEvent(event: EventMessage): ActionRequest[] {
    logger.info(`Processing event: ${event.event.name} from camera: ${event.camera_id}`);
    
    const rules = this.eventRules.get(event.event.name) || [];
    const actionsToExecute: ActionRequest[] = [];

    for (const rule of rules) {
      // Check if rule has a condition and evaluate it
      if (!rule.condition || rule.condition(event)) {
        actionsToExecute.push(...rule.actions);
      }
    }

    // Check if event has a specific command request
    if (event.event.command_request) {
      actionsToExecute.push({
        type: 'CUSTOM',
        payload: {
          command: event.event.command_request,
          source: event.camera_id,
        },
      });
    }

    logger.info(`Generated ${actionsToExecute.length} actions for event: ${event.event.name}`);
    
    // Emit processed event for monitoring
    this.emit('event_processed', {
      event,
      actions: actionsToExecute,
    });

    return actionsToExecute;
  }

  processState(state: StateMessage): void {
    // Store state in history
    const cameraHistory = this.stateHistory.get(state.camera_id) || [];
    cameraHistory.push(state);

    // Maintain history size limit
    if (cameraHistory.length > this.maxHistorySize) {
      cameraHistory.shift();
    }

    this.stateHistory.set(state.camera_id, cameraHistory);

    // Emit state update for other services
    this.emit('state_updated', state);
  }

  getStateHistory(cameraId: string, limit?: number): StateMessage[] {
    const history = this.stateHistory.get(cameraId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return [...history];
  }

  getLatestState(cameraId: string): StateMessage | null {
    const history = this.stateHistory.get(cameraId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  getAllLatestStates(): Map<string, StateMessage> {
    const latestStates = new Map<string, StateMessage>();
    
    for (const [cameraId, history] of this.stateHistory) {
      if (history.length > 0) {
        latestStates.set(cameraId, history[history.length - 1]);
      }
    }

    return latestStates;
  }

  clearStateHistory(cameraId?: string): void {
    if (cameraId) {
      this.stateHistory.delete(cameraId);
      logger.info(`Cleared state history for camera: ${cameraId}`);
    } else {
      this.stateHistory.clear();
      logger.info('Cleared all state history');
    }
  }
}