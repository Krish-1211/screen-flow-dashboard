import axios from 'axios';
import { contextStore } from '../storage/playlistStore';
import type { PlayerContext } from '@/types';

export type SyncStatus = {
  online: boolean;
  stale: boolean;
  lastSuccessAt: number | null;
};

export class SyncManager {
  private deviceId: string;
  private apiBaseUrl: string;
  private onUpdate: (context: PlayerContext) => void;
  private onStatus: (status: SyncStatus) => void;
  private onSyncActivity: (isSyncing: boolean) => void;
  public lastSyncTime: number = Date.now();
  private isRunning = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    deviceId: string,
    apiBaseUrl: string,
    onUpdate: (context: PlayerContext) => void,
    onStatus: (status: SyncStatus) => void,
    onSyncActivity: (isSyncing: boolean) => void
  ) {
    this.deviceId = deviceId;
    this.apiBaseUrl = apiBaseUrl;
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.onSyncActivity = onSyncActivity;
  }

  public bootstrapFromLocal() {
    const cached = contextStore.get();
    if (!cached) return null;
    this.onUpdate(cached.context);
    return cached;
  }

  public startSyncLoop() {
    if (this.loopPromise) return;
    this.isRunning = true;
    this.loopPromise = this.runLoop();
  }

  public stop() {
    this.isRunning = false;
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndSync();
        this.lastSyncTime = Date.now();
        await this.sleep(15000); 
      } catch (e) {
        console.warn('[player] sync failed, retry in 5s...', e);
        await this.sleep(5000);
      }
    }
    this.loopPromise = null;
  }

  private async checkAndSync() {
    this.onSyncActivity(true);
    try {
      const context = await this.fetchPlayerContext();
      this.applyContext(context);
      this.onStatus({ online: true, stale: false, lastSuccessAt: Date.now() });
    } catch (e) {
      const cached = contextStore.get();
      const stale = this.isStale(cached?.timestamp ?? null);
      this.onStatus({ online: false, stale, lastSuccessAt: cached?.timestamp ?? null });
      throw e;
    } finally {
      this.onSyncActivity(false);
    }
  }

  private async fetchPlayerContext(): Promise<PlayerContext> {
    const response = await axios.get(`${this.apiBaseUrl}/screens/player?device_id=${this.deviceId}`, {
      timeout: 10000 
    });
    return response.data as PlayerContext;
  }

  private applyContext(context: PlayerContext): void {
    if (!context || !context.screen) return;

    const cached = contextStore.get();
    
    // Compare full context to detect changes
    const hasChanged = !cached || JSON.stringify(context) !== JSON.stringify(cached.context);

    if (hasChanged) {
      contextStore.save(context);
      console.info(`[player] sync: context update for ${context.screen.name}`);
      this.onUpdate(context);
    }
  }

  private isStale(lastSuccessAt: number | null): boolean {
    if (!lastSuccessAt) return true;
    return Date.now() - lastSuccessAt > 60 * 60 * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
