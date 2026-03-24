import axios from 'axios';
import { io, Socket } from 'socket.io-client';
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
  private isRunning = false;
  private loopPromise: Promise<void> | null = null;
  private socket: Socket | null = null;
  private ticksSinceFullFetch = 0;

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
    versionManager.set(cached.version);
    this.onUpdate(cached.playlist);
    return cached;
  }

  public async forceFullSync() {
    try {
      console.info('[player] sync full fetch start');
      const playlist = await this.fetchPlayerPlaylist();
      this.applyPlaylist(playlist);
      this.onStatus({ online: true, stale: false, lastSuccessAt: Date.now() });
      console.info('[player] sync full fetch success');
    } catch (e) {
      const cached = playlistStore.get();
      const stale = this.isStale(cached?.timestamp ?? null);
      this.onStatus({ online: false, stale, lastSuccessAt: cached?.timestamp ?? null });
      console.warn('Initial sync failed, continuing offline', e);
    }
  }

  public startSyncLoop() {
    if (this.loopPromise) return;
    this.isRunning = true;

    // Real-time Push via Sockets
    this.socket = io(this.apiBaseUrl);
    this.socket.on('playlist-updated', () => {
      console.info('[player] real-time update received via socket');
      void this.forceFullSync();
    });

    this.loopPromise = this.runLoop();
  }

  public stop() {
    this.isRunning = false;
    this.socket?.disconnect();
    this.socket = null;
  }

  private async runLoop() {
    while (this.isRunning) {
      await this.checkAndSync();
      // Polling fallback (5 minutes as requested)
      await this.sleep(5 * 60 * 1000);
    }
    this.loopPromise = null;
  }

  private async checkAndSync() {
    this.onSyncActivity(true);
    try {
      const serverVersion = await this.fetchVersion();
      const hasEtagVersion = !serverVersion.startsWith('unknown-');
      const shouldFallbackFetch = this.ticksSinceFullFetch >= 1;
      const versionChanged = hasEtagVersion
        ? versionManager.getETag() !== serverVersion
        : !versionManager.isUpToDate(serverVersion);
      const shouldFetch = versionChanged || shouldFallbackFetch;
      if (shouldFetch) {
        const serverPlaylist = await this.fetchPlayerPlaylist();
        this.applyPlaylist(serverPlaylist);
        if (hasEtagVersion) {
          versionManager.setETag(serverVersion);
        }
        this.ticksSinceFullFetch = 0;
      } else {
        this.ticksSinceFullFetch += 1;
      }

      this.onStatus({ online: true, stale: false, lastSuccessAt: Date.now() });
    } catch (e) {
      const cached = playlistStore.get();
      const stale = this.isStale(cached?.timestamp ?? null);
      this.onStatus({ online: false, stale, lastSuccessAt: cached?.timestamp ?? null });
      console.warn('Sync failed, staying on local playlist', e);
    } finally {
      this.onSyncActivity(false);
    }
  }

  private async fetchPlayerPlaylist(): Promise<Playlist> {
    const response = await axios.get(`${this.apiBaseUrl}/screens/player?device_id=${this.deviceId}`);
    return response.data as Playlist;
  }

  private async fetchVersion(): Promise<string> {
    const response = await axios.head(`${this.apiBaseUrl}/screens/player?device_id=${this.deviceId}`);
    const etag = response.headers.etag as string | undefined;
    if (etag) {
      return etag;
    }
    return `unknown-${Date.now()}`;
  }

  private applyPlaylist(playlist: Playlist): void {
    if (!playlist || !Array.isArray(playlist.items)) return;

    const cached = playlistStore.get();
    const hasChanged = !cached || JSON.stringify(playlist) !== JSON.stringify(cached.playlist);

    if (hasChanged) {
      playlistStore.save(playlist);
      versionManager.set(playlist.updatedAt || new Date().toISOString());
      console.info('[player] playlist changed, persisted locally');
      this.onUpdate(playlist);
    } else {
      console.info('[player] playlist unchanged, skipping update');
    }
  }

  private isStale(lastSuccessAt: number | null): boolean {
    if (!lastSuccessAt) return true;
    return Date.now() - lastSuccessAt > 3 * 60 * 60 * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
