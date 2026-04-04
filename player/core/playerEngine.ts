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
  private scheduleCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private currentItemStartedAt = 0;

  constructor(onRender: (item: PlaylistItem) => void) {
    this.onRender = onRender;
    this.checkSchedule(); // Initial check
  }

  public updateContext(context: PlayerContext) {
    // Phase 4: Context Validation
    if (!context || !context.playlists || context.playlists.length === 0) {
      this.log({ type: 'error', message: 'Invalid or empty context received from backend' });
      // Keep existing context or fallback will handle from state
    }

    this.currentContext = context;
    this.schedules = context.schedules || [];
    this.defaultPlaylistId = context.screen?.defaultPlaylistId;
    
    const newPlaylistMap = new Map<string, Playlist>();
    (context.playlists || []).forEach(pl => newPlaylistMap.set(String(pl.id), pl));
    this.playlists = newPlaylistMap;

    this.checkSchedule();
  }

  private checkSchedule() {
    if (this.scheduleCheckTimer) clearTimeout(this.scheduleCheckTimer);
    
    if (!this.currentContext) {
      this.scheduleNextCheck(5000);
      return;
    }

    const activePl = this.evaluateActivePlaylist();
    if (activePl) {
      this.applyPlaylistToEngine(activePl);
    }

    // Phase 2 & 6: Smart scheduling
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(defaultDelay = 3000) {
    if (this.scheduleCheckTimer) clearTimeout(this.scheduleCheckTimer);

    const nextChange = this.getNextScheduleChange();
    let delay = defaultDelay;

    if (nextChange) {
      const msUntilChange = nextChange.getTime() - Date.now();
      // Phase 2: Dynamic scheduling with 500ms safety buffer
      // Clamp between 2s and 30s for responsiveness/safety balance
      delay = Math.min(Math.max(2000, msUntilChange + 500), 30000);
    } else {
      delay = 30000; // No changes soon, check every 30s
    }

    this.scheduleCheckTimer = setTimeout(() => this.checkSchedule(), delay);
  }

  private getNextScheduleChange(): Date | null {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nextBoundaryMinutes: number | null = null;

    (this.schedules || []).forEach(s => {
      const days = (s.days || []).map(Number);
      if (!days.includes(currentDay)) return;

      const start = this.toMinutes(s.startTime);
      const end = this.toMinutes(s.endTime);

      if (start > currentMinutes) {
        if (nextBoundaryMinutes === null || start < nextBoundaryMinutes) nextBoundaryMinutes = start;
      }
      if (end > currentMinutes) {
        if (nextBoundaryMinutes === null || end < nextBoundaryMinutes) nextBoundaryMinutes = end;
      }
    });

    if (nextBoundaryMinutes !== null) {
      const boundaryDate = new Date();
      boundaryDate.setHours(Math.floor(nextBoundaryMinutes / 60), nextBoundaryMinutes % 60, 0, 0);
      return boundaryDate;
    }

    return null;
  }

  private log(data: any) {
    // Phase 5: Structured Logging
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }));
  }

  private toMinutes(timeString: string | undefined): number {
    if (!timeString) return 0;
    // Phase 2: Handle HH:mm and HH:mm:ss, ignore seconds
    const parts = String(timeString).split(':').map(Number);
    const h = isNaN(parts[0]) ? 0 : parts[0];
    const m = isNaN(parts[1]) ? 0 : parts[1];
    return h * 60 + m;
  }

  private evaluateActivePlaylist(): Playlist | null {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const activeSchedules = (this.schedules || []).filter(s => {
      const days = (s.days || []).map(Number);
      if (!days.includes(currentDay)) return false;

      // Phase 4: Validate playlist existence in schedule
      if (!this.playlists.has(String(s.playlistId))) {
        this.log({ type: 'warning', message: `Schedule ${s.id} references missing playlist ${s.playlistId}` });
        return false;
      }

      const start = this.toMinutes(s.startTime);
      const end = this.toMinutes(s.endTime);

      if (end < start) return currentMinutes >= start || currentMinutes < end;
      return currentMinutes >= start && currentMinutes < end;
    });

    let targetPlaylistId: string | null = null;

    if (activeSchedules.length > 0) {
      activeSchedules.sort((a, b) => this.toMinutes(b.startTime) - this.toMinutes(a.startTime));
      targetPlaylistId = String(activeSchedules[0].playlistId);
    } else {
      targetPlaylistId = this.defaultPlaylistId ? String(this.defaultPlaylistId) : null;
    }

    // Phase 5: Structured Logging
    this.log({
      type: 'schedule_evaluation',
      currentTime: now.toLocaleTimeString(),
      currentMinutes,
      activeSchedules: activeSchedules.map(s => ({ id: s.id, playlistId: s.playlistId })),
      selectedPlaylist: targetPlaylistId,
      nextChange: this.getNextScheduleChange()?.toLocaleTimeString() || 'none today'
    });

    let playlist = targetPlaylistId ? this.playlists.get(targetPlaylistId) : null;

    if (!playlist) {
      if (targetPlaylistId && !['null', 'undefined'].includes(targetPlaylistId)) {
        this.log({ type: 'error', message: `Target playlist ${targetPlaylistId} not found in library` });
      }

      // Fallback chain
      if (targetPlaylistId !== String(this.defaultPlaylistId)) {
        playlist = this.defaultPlaylistId ? this.playlists.get(String(this.defaultPlaylistId)) : null;
        if (playlist) return playlist;
      }

      if (this.playlist.length > 0) return null;

      // Phase 1: Pure UI Fallback (Solid Black Gap)
      this.log({ type: 'fallback', message: 'Using safe system fallback' });
      return {
        id: 'fallback-safe',
        name: 'Safe Fallback',
        items: [{
          id: 'safe-placeholder',
          mediaId: 'safe-placeholder',
          order: 0,
          duration: 10,
          media: {
            id: 'safe-placeholder',
            name: 'Safe Fallback',
            type: 'system_gap',
            url: ''
          }
        }]
      };
    }

    return playlist;
  }

  private applyPlaylistToEngine(pl: Playlist) {
    const currentId = this._playlistId;
    const newId = String(pl.id);
    const newItems = [...(pl.items || [])];

    if (currentId === newId) {
      if (JSON.stringify(newItems) !== JSON.stringify(this.playlist)) {
        this.log({ type: 'playlist_update', message: 'Content update for current playlist' });
        this.nextPlaylist = newItems;
      }
      return;
    }

    const switchLog = { type: 'playlist_switch', from: currentId, to: newId };

    // Phase 3: Force switch threshold logic
    let shouldForce = false;
    if (this.loopRunning && this.playlist.length > 0) {
      const currentItem = this.playlist[this.currentIndex];
      const elapsedMs = Date.now() - this.currentItemStartedAt;
      const totalDurationMs = Math.max(1, currentItem?.duration || 10) * 1000;
      const remainingMs = totalDurationMs - elapsedMs;

      // Force switch if remaining time is > 15s or item has no fixed duration (video)
      if (remainingMs > 15000 || currentItem?.media?.type === 'video') {
        shouldForce = true;
      }
    }

    if (shouldForce) {
      this.log({ ...switchLog, mode: 'immediate', reason: 'threshold_exceeded' });
      this.playlist = newItems;
      this._playlistId = newId;
      this.nextPlaylist = null;
      this.currentIndex = 0;
      this.wakeLoop();
    } else if (this.loopRunning && this.playlist.length > 0) {
      this.log({ ...switchLog, mode: 'smooth', reason: 'waiting_for_media_end' });
      this.nextPlaylist = newItems;
      this._playlistId = newId;
    } else {
      this.log({ ...switchLog, mode: 'immediate', reason: 'stopped_or_empty' });
      this.playlist = newItems;
      this._playlistId = newId;
      this.nextPlaylist = null;
      this.currentIndex = 0;
      this.wakeLoop();
      if (!this.loopRunning && this.shouldRun) this.startPlayback();
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
      this.currentItemStartedAt = Date.now();
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
