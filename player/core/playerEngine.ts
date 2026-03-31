import type { PlaylistItem, Playlist, Schedule, PlayerContext } from '@/types';

export class PlayerEngine {
  private playlist: PlaylistItem[] = [];
  private _playlistId: string | null = null;
  private nextPlaylist: PlaylistItem[] | null = null;
  private currentIndex = 0;
  private shouldRun = false;
  private loopRunning = false;
  private loopToken = 0;
  private pendingAdvanceResolver: (() => void) | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private onRender: (item: PlaylistItem) => void;

  private schedules: Schedule[] = [];
  private playlists: Map<string, Playlist> = new Map();
  private defaultPlaylistId: string | null = null;
  private currentContext: PlayerContext | null = null;
  private scheduleCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(onRender: (item: PlaylistItem) => void) {
    this.onRender = onRender;
    this.startScheduleWatcher();
  }

  public updateContext(context: PlayerContext) {
    this.currentContext = context;
    this.schedules = context.schedules;
    this.defaultPlaylistId = context.screen.defaultPlaylistId;
    
    const newPlaylistMap = new Map<string, Playlist>();
    context.playlists.forEach(pl => newPlaylistMap.set(String(pl.id), pl));
    this.playlists = newPlaylistMap;

    this.checkSchedule();
  }

  private startScheduleWatcher() {
    if (this.scheduleCheckInterval) return;
    this.scheduleCheckInterval = setInterval(() => this.checkSchedule(), 5000);
  }

  private checkSchedule() {
    if (!this.currentContext) return;

    const activePl = this.evaluateActivePlaylist();
    if (!activePl) return;

    this.applyPlaylistToEngine(activePl);
  }

  private evaluateActivePlaylist(): Playlist | null {
    const now = new Date();
    // Use the same day mapping as backend (0=Mon... 6=Sun)
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const activeSchedules = this.schedules.filter(s => {
      if (!s.days.includes(currentDay)) return false;

      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);

      const start = sh * 60 + sm;
      const end = eh * 60 + em;

      if (end < start) {
        // Crosses midnight
        return currentMinutes >= start || currentMinutes < end;
      }

      return currentMinutes >= start && currentMinutes < end;
    });

    let targetPlaylistId: string | null = null;

    if (activeSchedules.length > 0) {
      // Overlap handled: Latest start time wins
      activeSchedules.sort((a, b) => b.startTime.localeCompare(a.startTime));
      targetPlaylistId = String(activeSchedules[0].playlistId);
    } else {
      targetPlaylistId = String(this.defaultPlaylistId);
    }

    return this.playlists.get(targetPlaylistId) || null;
  }

  private applyPlaylistToEngine(pl: Playlist) {
    const newItems = [...(pl.items || [])];
    const currentId = this._playlistId;
    const newId = String(pl.id);

    if (currentId !== newId) {
      console.info(`[player] schedule flip detected (${currentId} -> ${newId})`);
      this.playlist = newItems;
      this._playlistId = newId;
      this.nextPlaylist = null;
      this.currentIndex = 0;
      
      this.wakeLoop();
      
      if (!this.loopRunning && this.shouldRun) {
        this.startPlayback();
      }
      return;
    }

    // items change within the SAME playlist
    if (JSON.stringify(newItems) !== JSON.stringify(this.playlist)) {
      console.info('[player] content update detected for current playlist');
      this.nextPlaylist = newItems;
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

  public getPlaylistItems() {
    return this.playlist;
  }

  public get playlistId() {
    return this._playlistId;
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
