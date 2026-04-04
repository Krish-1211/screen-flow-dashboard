import type { PlaylistItem, Media, Playlist, Schedule, PlayerContext } from '@/types';

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
    // Initial content evaluation
    this.checkSchedule();
  }

  public updateContext(context: PlayerContext) {
    if (!context) return;
    
    console.log("CONTEXT SYNC RECEIVED:", context);

    this.currentContext = context;
    this.schedules = (context.schedules || []).map(s => ({
      ...s,
      playlistId: String(s.playlistId || s.playlist_id)
    }));
    
    const rawDefault = context.screen?.defaultPlaylistId || context.screen?.playlist_id;
    this.defaultPlaylistId = rawDefault ? String(rawDefault) : null;
    
    const newPlaylistMap = new Map<string, Playlist>();
    (context.playlists || []).forEach(pl => newPlaylistMap.set(String(pl.id), pl));
    this.playlists = newPlaylistMap;

    console.log("ENGINE UPDATED:", {
      schedules: this.schedules,
      playlists: Array.from(this.playlists.keys()),
      defaultPlaylistId: this.defaultPlaylistId
    });

    this.checkSchedule();
  }

  private checkSchedule() {
    console.log("[SCHEDULE] checkSchedule fired, calling applyPlaylist");
    if (this.scheduleCheckTimer) clearTimeout(this.scheduleCheckTimer);
    
    console.log("===== SCHEDULE DEBUG =====");
    console.log("Current Time:", new Date());

    if (!this.currentContext) {
      this.scheduleNextCheck(5000);
      return;
    }

    const activePl = this.evaluateActivePlaylist();
    if (activePl) {
      this.applyPlaylistToEngine(activePl);
    } else {
      console.error("NO PLAYLIST SELECTED -> FALLBACK TRIGGERED");
    }

    this.scheduleNextCheck();
  }

  private scheduleNextCheck(defaultDelay = 3000) {
    if (this.scheduleCheckTimer) clearTimeout(this.scheduleCheckTimer);

    const nextChange = this.getNextScheduleChange();
    let delay = defaultDelay;

    if (nextChange) {
      const msUntilChange = nextChange.getTime() - Date.now();
      delay = Math.min(Math.max(2000, msUntilChange + 500), 30000);
    } else {
      delay = 30000;
    }

    this.scheduleCheckTimer = setTimeout(() => this.checkSchedule(), delay);
  }

  private getNextScheduleChange(): Date | null {
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let nextBoundaryMinutes: number | null = null;

    (this.schedules || []).forEach(s => {
      const daysArray = (s.days || []).map(Number);
      if (!daysArray.includes(currentDay)) return;

      const startMin = this.toMinutes(s.startTime);
      const endMin = this.toMinutes(s.endTime);

      if (startMin > currentMinutes) {
        if (nextBoundaryMinutes === null || startMin < nextBoundaryMinutes) nextBoundaryMinutes = startMin;
      }
      if (endMin > currentMinutes) {
        if (nextBoundaryMinutes === null || endMin < nextBoundaryMinutes) nextBoundaryMinutes = endMin;
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
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }));
  }

  private toMinutes(timeString: string | undefined): number {
    if (!timeString) return 0;
    const parts = String(timeString).split(':').map(Number);
    const h = isNaN(parts[0]) ? 0 : parts[0];
    const m = isNaN(parts[1]) ? 0 : parts[1];
    return h * 60 + m;
  }

  private evaluateActivePlaylist(): Playlist | null {
    console.log("===== EVALUATING PLAYLIST =====");

    // 1. Declare ALL variables at top to eliminate TDZ
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let activePl: Playlist | null = null;
    let targetId: string | null = null;
    let fallbackPl: Playlist | null = null;

    // 2. Identify active schedules
    const activeSchedules = (this.schedules || []).filter(s => {
      const days = (s.days || []).map(Number);
      const isDayMatch = days.includes(currentDay);
      const start = this.toMinutes(s.startTime);
      const end = this.toMinutes(s.endTime);
      
      let isTimeMatch = false;
      if (end < start) {
        isTimeMatch = currentMinutes >= start || currentMinutes < end;
      } else {
        isTimeMatch = currentMinutes >= start && currentMinutes < end;
      }

      console.log(`[player] Engine Eval Sched ${s.id}: dayMatch=${isDayMatch}(${days} vs ${currentDay}), timeMatch=${isTimeMatch}(${start}-${end} vs ${currentMinutes})`);
      return isDayMatch && isTimeMatch;
    });

    // Strategy 1: Active Schedule
    if (activeSchedules.length > 0) {
      targetId = String(activeSchedules[0].playlistId);
      activePl = this.playlists.get(targetId) || null;
      if (activePl) {
        console.log("[player] Priority 1: Using scheduled playlist:", activePl.id);
        return activePl;
      }
    }

    // Strategy 2: Screen Default
    if (this.defaultPlaylistId) {
      activePl = this.playlists.get(String(this.defaultPlaylistId)) || null;
      if (activePl) {
        console.log("[player] Priority 2: Using screen assigned playlist:", activePl.id);
        return activePl;
      }
    }

    // Strategy 3: Persistence (If we have content, keep playing it instead of flashing clock)
    if (this._playlistId && this._playlistId !== 'fallback-safe' && this.playlists.has(this._playlistId)) {
      const currentPl = this.playlists.get(this._playlistId);
      if (currentPl) {
        console.log("[player] Priority 3: Persistence - Staying on current playlist:", currentPl.id);
        return currentPl;
      }
    }

    // Strategy 4: Fallback to first available playlist (if any playlists exist in library)
    if (this.playlists.size > 0) {
      const firstId = Array.from(this.playlists.keys())[0];
      const firstPl = this.playlists.get(firstId);
      if (firstPl) {
        console.log("[player] Priority 4: Fallback - Picking first available playlist:", firstPl.id);
        return firstPl;
      }
    }

    console.warn("[player] No playlists assigned or found in library -> system gap");
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
          url: '/black-screen.png'
        }
      }]
    };
  }

  private applyPlaylistToEngine(pl: Playlist) {
    const currentId = this._playlistId;
    const newId = String(pl.id);
    const rawItems = [...(pl.items || [])];

    // 🔥 AUTOMATIC BLACK FRAME INJECTION FOR SINGLE-VIDEO LOOPS
    // This allows the player to naturally cycle (Video -> Black Frame -> Video)
    if (
        rawItems.length === 1 && 
        rawItems[0].media?.type === 'video' &&
        !rawItems.some(i => i.id === `auto-loop-gap-${pl.id}`)
    ) {
      rawItems.push({
        id: `auto-loop-gap-${pl.id}`,
        mediaId: 'auto-loop-gap',
        is_system: true,
        order: 1,
        duration: 0.5,
        media: {
          id: 'auto-loop-gap-media',
          name: 'loop-gap',
          type: 'image',
          url: '/black-screen.png'
        }
      });
    }
    const newItems = rawItems;

    if (currentId === newId) {
      if (JSON.stringify(newItems) !== JSON.stringify(this.playlist)) {
        this.nextPlaylist = newItems;
      }
      return;
    }

    let shouldForce = false;
    if (this.loopRunning && this.playlist.length > 0) {
      const currentItem = this.playlist[this.currentIndex];
      const elapsedMs = Date.now() - this.currentItemStartedAt;
      const totalDurationMs = Math.max(1, currentItem?.duration || 10) * 1000;
      const remainingMs = totalDurationMs - elapsedMs;

      if (remainingMs > 15000 || currentItem?.media?.type === 'video') {
        shouldForce = true;
      }
    }

    if (shouldForce) {
      this.playlist = newItems;
      this._playlistId = newId;
      this.nextPlaylist = null;
      this.currentIndex = 0;
      this.wakeLoop();
    } else if (this.loopRunning && this.playlist.length > 0) {
      this.nextPlaylist = newItems;
      this._playlistId = newId;
    } else {
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
    this.shouldRun = true;
    this.clearPendingWait();
    void this.runLoop();
  }

  private async runLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    const token = ++this.loopToken;

    while (this.shouldRun && token === this.loopToken) {
      if (this.playlist.length === 0) {
        await this.waitForAdvance(2000);
        continue;
      }

      const item = this.playlist[this.currentIndex];
      this.currentItemStartedAt = Date.now();
      this.onRender(item);

      if (item?.media?.type === 'video') {
        await this.waitForAdvance();
      } else if (item?.media?.type === 'system_gap') {
        await this.waitForAdvance((item.duration || 0.3) * 1000);
      } else {
        await this.waitForAdvance(Math.max(1, item?.duration || 10) * 1000);
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
    console.log("[player] Engine STOPPING - clearing all timers and abandoning active loop");
    this.shouldRun = false;
    this.loopToken += 1;
    
    // Clear playback timers
    this.clearPendingWait();
    
    // Also clear the background schedule survey while stopped
    if (this.scheduleCheckTimer) {
      clearTimeout(this.scheduleCheckTimer);
      this.scheduleCheckTimer = null;
    }
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
    this.pendingAdvanceResolver = null;
  }
}
