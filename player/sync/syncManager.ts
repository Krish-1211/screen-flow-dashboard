import axios from 'axios';
import { versionManager } from './versionManager';
import { playlistStore } from '../storage/playlistStore';
import type { Playlist } from '@/types';

export type SyncStatus = {
  online: boolean;
  stale: boolean;
  lastSuccessAt: number | null;
};
export class SyncManager {
  private deviceId: string;
  private apiBaseUrl: string;
  private onUpdate: (newPlaylist: Playlist) => void;
  private onStatus: (status: SyncStatus) => void;
  private onSyncActivity: (isSyncing: boolean) => void;
  public lastSyncTime: number = Date.now();
  private isRunning = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    deviceId: string,
    apiBaseUrl: string,
    onUpdate: (pl: Playlist) => void,
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
    const cached = playlistStore.get();
    if (!cached) return null;
    this.onUpdate(cached.playlist);
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
        this.lastSyncTime = Date.now(); // Healthy
        // Requirement 1: 15s polling
        await this.sleep(15000); 
      } catch (e) {
        console.warn('[player] sync failed, retry in 5s...', e);
        // Requirement 3: 5s retry
        await this.sleep(5000);
      }
    }
    this.loopPromise = null;
  }

  private async checkAndSync() {
    this.onSyncActivity(true);
    try {
      const serverPlaylist = await this.fetchPlayerPlaylist();
      this.applyPlaylist(serverPlaylist);
      this.onStatus({ online: true, stale: false, lastSuccessAt: Date.now() });
    } catch (e) {
      const cached = playlistStore.get();
      const stale = this.isStale(cached?.timestamp ?? null);
      this.onStatus({ online: false, stale, lastSuccessAt: cached?.timestamp ?? null });
      throw e; // Bubble to loop for retry
    } finally {
      this.onSyncActivity(false);
    }
  }

  private getLocalTimeParams(): string {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const jsDay = now.getDay();
    const localDay = jsDay === 0 ? 6 : jsDay - 1;
    return `&local_time=${time}&local_day=${localDay}`;
  }

  private async fetchPlayerPlaylist(): Promise<Playlist> {
    const params = this.getLocalTimeParams();
    const response = await axios.get(`${this.apiBaseUrl}/screens/player?device_id=${this.deviceId}${params}`, {
      timeout: 10000 
    });
    return response.data as Playlist;
  }

  private applyPlaylist(playlist: Playlist): void {
    if (!playlist || !Array.isArray(playlist.items)) return;

    const cached = playlistStore.get();
    const cachedItems = cached?.playlist.items;
    
    // Compare Content + ID
    const hasItemsChanged = !cachedItems || JSON.stringify(playlist.items) !== JSON.stringify(cachedItems);
    const hasIdChanged = !cached || String(playlist.id) !== String(cached.playlist.id);

    if (hasItemsChanged || hasIdChanged) {
      playlistStore.save(playlist);
      console.info(`[player] sync: playlist update (Id=${playlist.id}, Changed=${hasItemsChanged})`);
      this.onUpdate(playlist);
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
