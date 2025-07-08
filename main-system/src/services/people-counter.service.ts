import { EventEmitter } from 'events';
import { StateMessage } from '../interfaces/event.interface';
import { config } from '../config';
import logger from '../utils/logger';

interface CameraCount {
  cameraId: string;
  count: number;
  timestamp: number;
}

export class PeopleCounterService extends EventEmitter {
  private cameraCounts: Map<string, CameraCount> = new Map();
  private currentOfficialCount = 0;
  private countHistory: Array<{ timestamp: number; count: number }> = [];
  private maxHistorySize = 1000;
  private staleDataThreshold = 30000; // 30 seconds

  constructor() {
    super();
  }

  updateCameraCount(state: StateMessage): void {
    const { camera_id, timestamp, data } = state;
    
    // Update camera count
    this.cameraCounts.set(camera_id, {
      cameraId: camera_id,
      count: data.person_count,
      timestamp,
    });

    logger.debug(`Updated count for camera ${camera_id}: ${data.person_count}`);

    // Calculate new official count
    const newCount = this.calculateOfficialCount();
    
    // Check if count has changed
    if (newCount !== this.currentOfficialCount) {
      const previousCount = this.currentOfficialCount;
      this.currentOfficialCount = newCount;

      // Add to history
      this.addToHistory(timestamp, newCount);

      // Emit count change event
      this.emit('count_changed', {
        previousCount,
        currentCount: newCount,
        timestamp,
        cameraCounts: this.getCameraCounts(),
      });

      logger.info(`Official people count changed: ${previousCount} -> ${newCount}`);
    }
  }

  private calculateOfficialCount(): number {
    // Remove stale data
    this.removeStaleData();

    const activeCounts = Array.from(this.cameraCounts.values())
      .map(cc => cc.count);

    if (activeCounts.length === 0) {
      return 0;
    }

    // If we have fewer cameras than the threshold, use the maximum
    if (activeCounts.length < config.MAJORITY_VOTE_THRESHOLD) {
      return Math.max(...activeCounts);
    }

    // Use majority voting
    return this.getMajorityCount(activeCounts);
  }

  private getMajorityCount(counts: number[]): number {
    // Count occurrences of each value
    const countOccurrences = new Map<number, number>();
    
    for (const count of counts) {
      const occurrences = countOccurrences.get(count) || 0;
      countOccurrences.set(count, occurrences + 1);
    }

    // Find the count with most occurrences (majority)
    let majorityCount = 0;
    let maxOccurrences = 0;

    for (const [count, occurrences] of countOccurrences) {
      if (occurrences > maxOccurrences) {
        maxOccurrences = occurrences;
        majorityCount = count;
      } else if (occurrences === maxOccurrences && count > majorityCount) {
        // In case of tie, choose the higher count (conservative approach)
        majorityCount = count;
      }
    }

    // If no clear majority (all different), use median
    if (maxOccurrences === 1) {
      const sorted = [...counts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      majorityCount = sorted[mid];
    }

    logger.debug(`Majority voting result: ${majorityCount} (from counts: ${counts.join(', ')})`);
    return majorityCount;
  }

  private removeStaleData(): void {
    const now = Date.now();
    const staleThreshold = now - this.staleDataThreshold;

    for (const [cameraId, cameraCount] of this.cameraCounts) {
      if (cameraCount.timestamp < staleThreshold) {
        this.cameraCounts.delete(cameraId);
        logger.warn(`Removed stale data from camera: ${cameraId}`);
      }
    }
  }

  private addToHistory(timestamp: number, count: number): void {
    this.countHistory.push({ timestamp, count });

    // Maintain history size
    if (this.countHistory.length > this.maxHistorySize) {
      this.countHistory.shift();
    }
  }

  getCurrentCount(): number {
    return this.currentOfficialCount;
  }

  getCameraCounts(): CameraCount[] {
    this.removeStaleData();
    return Array.from(this.cameraCounts.values());
  }

  getCountHistory(limit?: number): Array<{ timestamp: number; count: number }> {
    if (limit) {
      return this.countHistory.slice(-limit);
    }
    return [...this.countHistory];
  }

  resetCounter(): void {
    this.cameraCounts.clear();
    this.currentOfficialCount = 0;
    this.countHistory = [];
    logger.info('People counter reset');
    
    this.emit('counter_reset');
  }

  getStatistics(): {
    currentCount: number;
    activeCameras: number;
    averageCountLast5Min: number;
    maxCountLast5Min: number;
  } {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const recentHistory = this.countHistory.filter(h => h.timestamp > fiveMinutesAgo);
    
    const averageCount = recentHistory.length > 0
      ? recentHistory.reduce((sum, h) => sum + h.count, 0) / recentHistory.length
      : 0;
    
    const maxCount = recentHistory.length > 0
      ? Math.max(...recentHistory.map(h => h.count))
      : 0;

    return {
      currentCount: this.currentOfficialCount,
      activeCameras: this.cameraCounts.size,
      averageCountLast5Min: Math.round(averageCount * 10) / 10,
      maxCountLast5Min: maxCount,
    };
  }
}