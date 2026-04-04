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
    if (!context) return;
    
    console.log("CONTEXT SYNC RECEIVED:", context);

    this.currentContext = context;
    // Ensure all critical data is assigned
    this.schedules = (context.schedules || []).map(s => ({
      ...s,
      playlistId: String(s.playlistId || s.playlist_id)
    }));
    
    // Support both naming conventions from backend
    const rawDefault = context.screen?.defaultPlaylistId || context.screen?.playlist_id;
    this.defaultPlaylistId = rawDefault ? String(rawDefault) : null;
    
    const newPlaylistMap = new Map<string, Playlist>();
    (context.playlists || []).forEach(pl => newPlaylistMap.set(String(pl.id), pl));
    this.playlists = newPlaylistMap;

    // Phase 4: Diagnostic Visibility
    console.log("ENGINE UPDATED:", {
      schedules: this.schedules,
      playlists: Array.from(this.playlists.keys()),
      defaultPlaylistId: this.defaultPlaylistId
    });

    this.checkSchedule();
  }

  private checkSchedule() {
    if (this.scheduleCheckTimer) clearTimeout(this.scheduleCheckTimer);
    
    console.log("===== SCHEDULE DEBUG =====");
    console.log("Current Time:", new Date());
    console.log("Schedules:", this.schedules);
    console.log("Playlists:", Array.from(this.playlists.entries()));
    console.log("Default Playlist ID:", this.defaultPlaylistId);

    if (!this.currentContext) {
      console.warn("No context available yet");
      this.scheduleNextCheck(5000);
      return;
    }

    const activePl = this.evaluateActivePlaylist();
    if (activePl) {
      this.applyPlaylistToEngine(activePl);
    } else {
      console.error("NO PLAYLIST SELECTED -> FALLBACK TRIGGERED");
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
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const activeSchedules = (this.schedules || []).filter(s => {
      const days = (s.days || []).map(Number);
      const start = this.toMinutes(s.startTime);
      const end = this.toMinutes(s.endTime);
      
      const matchesDay = days.includes(currentDay);
      let matchesTime = false;
      if (end < start) {
        matchesTime = currentMinutes >= start || currentMinutes < end;
      } else {
        matchesTime = currentMinutes >= start && currentMinutes < end;
      }

      const isActive = matchesDay && matchesTime;
      
      console.log(`[player] Schedule ${s.id}: matchesDay=${matchesDay}, matchesTime=${matchesTime} -> isActive=${isActive}`);
      return isActive;
    });

    if (!this.playlists || this.playlists.size === 0) {
      console.error("No playlists available in library");
      return null;
    }

    // 🔥 1. TRY SCHEDULE FIRST
    const activeSchedule = activeSchedules.length > 0 ? activeSchedules[0] : null;

    if (activeSchedule) {
      const scheduledPl = this.playlists.get(String(activeSchedule.playlistId));
      if (scheduledPl) {
        console.log("[player] Priority 1: Using scheduled playlist:", scheduledPl.id);
        return scheduledPl;
      }
      console.warn("[player] Scheduled playlist missing in library:", activeSchedule.playlistId);
    }

    // 🔥 2. FALLBACK TO SCREEN ASSIGNED PLAYLIST (DEFAULT)
    if (this.defaultPlaylistId) {
      const defaultPl = this.playlists.get(String(this.defaultPlaylistId));
      if (defaultPl) {
        console.log("[player] Priority 2: Using screen assigned playlist:", defaultPl.id);
        return defaultPl;
      }
      console.warn("[player] Default playlist missing in library:", this.defaultPlaylistId);
    }

    // 🔥 3. LAST RESORT (FIRST AVAILABLE IN LIBRARY)
    if (this.playlists.size > 0) {
      const firstId = Array.from(this.playlists.keys())[0];
      const fallbackPl = this.playlists.get(firstId);
      if (fallbackPl) {
        console.log("[player] Priority 3: Using last-resort fallback playlist:", fallbackPl.id);
        return fallbackPl;
      }
    }

    console.error("[player] No playlist available whatsoever → returning safe fallback");
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

    // Threshold logic for forcing switch
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
