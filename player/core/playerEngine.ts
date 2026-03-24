import type { PlaylistItem, Playlist } from '@/types';

export class PlayerEngine {
  private playlist: PlaylistItem[] = [];
  private nextPlaylist: PlaylistItem[] | null = null;
  private currentIndex = 0;
  private shouldRun = false;
  private loopRunning = false;
  private loopToken = 0;
  private pendingAdvanceResolver: (() => void) | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private onRender: (item: PlaylistItem) => void;

  constructor(onRender: (item: PlaylistItem) => void) {
    this.onRender = onRender;
  }

  public replacePlaylist(pl: Playlist) {
    const newItems = [...(pl.items || [])];
    
    if (JSON.stringify(newItems) === JSON.stringify(this.playlist)) {
      return;
    }

    console.info('[player] playlist update received, buffering for next transition');
    this.nextPlaylist = newItems;
    
    // If nothing is playing, start immediately
    if (this.playlist.length === 0) {
      this.playlist = this.nextPlaylist;
      this.nextPlaylist = null;
      this.currentIndex = 0;
      if (!this.loopRunning) {
        this.startPlayback();
      }
    }
  }

  public startPlayback() {
    if (this.loopRunning) {
      this.stopPlaybackLoop();
    }
    console.info('[player] playback start');
    this.shouldRun = true;
    this.clearPendingWait(); // Ensure we don't carry over old waits
    void this.runLoop();
  }

  private async runLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    const token = ++this.loopToken;

    while (this.shouldRun && token === this.loopToken) {
      if (this.playlist.length === 0) {
        await this.waitForAdvance(2000); // Wait 2s before checking again
        continue;
      }

      const item = this.playlist[this.currentIndex];
      this.onRender(item);

      if (item?.media?.type === 'video') {
        await this.waitForAdvance();
      } else if (item?.media?.type === 'system_gap') {
        const durationMs = (item.duration || 0.3) * 1000;
        await this.waitForAdvance(durationMs);
      } else {
        const durationMs = Math.max(1, item?.duration || 10) * 1000;
        await this.waitForAdvance(durationMs);
      }

      if (!this.shouldRun || token !== this.loopToken) break;
      if (this.nextPlaylist) {
        this.playlist = this.nextPlaylist;
        this.nextPlaylist = null;
        this.currentIndex = 0;
      } else if (this.playlist.length > 0) {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
      }
    }

    this.loopRunning = false;
  }

  public next() {
    this.wakeLoop();
  }

  public onMediaEnded() {
    this.wakeLoop();
  }

  public restart() {
    this.currentIndex = 0;
    this.startPlayback();
  }

  public stopPlaybackLoop() {
    console.info('[player] playback stop');
    this.shouldRun = false;
    this.loopToken += 1;
    this.clearPendingWait();
    this.wakeLoop();
  }

  public getStatus() {
    return {
      shouldRun: this.shouldRun,
      loopRunning: this.loopRunning,
      playlistLength: this.playlist.length,
      currentIndex: this.currentIndex,
    };
  }

  private waitForAdvance(timeoutMs?: number): Promise<void> {
    this.clearPendingWait();
    return new Promise<void>((resolve) => {
      this.pendingAdvanceResolver = resolve;
      if (typeof timeoutMs === 'number') {
        this.pendingTimeout = setTimeout(() => {
          this.pendingTimeout = null;
          this.pendingAdvanceResolver = null;
          resolve();
        }, timeoutMs);
      }
    });
  }

  private wakeLoop() {
    if (this.pendingAdvanceResolver) {
      const resolve = this.pendingAdvanceResolver;
      this.pendingAdvanceResolver = null;
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
      resolve();
    }
  }

  private clearPendingWait() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }
}
