import React, { useState, useEffect, useRef } from "react";
import { PlayerEngine } from "../core/playerEngine";
import { SyncManager, type SyncStatus } from "../sync/syncManager";
import { PlayerState, PlayerStateMachine } from "../core/stateMachine";
import type { PlaylistItem, Playlist } from "@/types";
import { mediaCache } from "../storage/mediaCache";

interface PlayerProps {
  deviceId: string;
  apiBaseUrl: string;
}

export const PlayerDisplay: React.FC<PlayerProps> = ({ deviceId, apiBaseUrl }) => {
  const [currentItem, setCurrentItem] = useState<PlaylistItem | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE);
  const [resolvedMediaUrl, setResolvedMediaUrl] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isStaleOffline, setIsStaleOffline] = useState(false);
  
  const engineRef = useRef<PlayerEngine | null>(null);
  const syncRef = useRef<SyncManager | null>(null);
  const stateMachineRef = useRef<PlayerStateMachine>(new PlayerStateMachine());
  const playbackErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noContentRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRenderAtRef = useRef<number>(Date.now());
  const currentItemRef = useRef<PlaylistItem | null>(null);

  useEffect(() => {
    currentItemRef.current = currentItem;
    if (currentItem) {
      lastRenderAtRef.current = Date.now();
    }
  }, [currentItem]);

  useEffect(() => {
    // Kiosk mode hardening: disable interactions and enforce immersive display.
    const preventDefault = (event: Event) => event.preventDefault();
    document.body.style.cursor = "none";
    document.body.style.userSelect = "none";
    document.body.style.overflow = "hidden";
    document.addEventListener("contextmenu", preventDefault);
    document.addEventListener("selectstart", preventDefault);
    document.addEventListener("dragstart", preventDefault);

    const requestFullscreenSafe = async () => {
      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (document.fullscreenElement) return true;
      try {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
          return true;
        }
        if (root.webkitRequestFullscreen) {
          root.webkitRequestFullscreen();
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    const scheduleFullscreenRetry = () => {
      if (fullscreenRetryTimeoutRef.current) {
        clearTimeout(fullscreenRetryTimeoutRef.current);
      }
      fullscreenRetryTimeoutRef.current = setTimeout(async () => {
        const ok = await requestFullscreenSafe();
        if (!ok) scheduleFullscreenRetry();
      }, 2500);
    };

    void requestFullscreenSafe().then((ok) => {
      if (!ok) scheduleFullscreenRetry();
    });

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) scheduleFullscreenRetry();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("contextmenu", preventDefault);
      document.removeEventListener("selectstart", preventDefault);
      document.removeEventListener("dragstart", preventDefault);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (fullscreenRetryTimeoutRef.current) clearTimeout(fullscreenRetryTimeoutRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const stateMachine = stateMachineRef.current;
    const unsubscribeState = stateMachine.subscribe((nextState) => {
      console.info(`[player] state -> ${nextState}`);
      setState(nextState);
    });
    stateMachine.transition('STARTUP');

    const engine = new PlayerEngine((item) => setCurrentItem(item));

    const handleSyncStatus = (status: SyncStatus) => {
      setIsOffline(!status.online);
      setIsStaleOffline(!status.online && status.stale);
      stateMachine.transition(status.online ? 'NETWORK_RESTORED' : 'NETWORK_LOST');
    };

    const sync = new SyncManager(
      deviceId,
      apiBaseUrl,
      (newPl: Playlist) => {
        setPlaylistItems(newPl.items || []);
        engine.replacePlaylist(newPl);
        stateMachine.transition('PLAYLIST_READY');
      },
      handleSyncStatus,
      (isSyncing) => stateMachine.transition(isSyncing ? 'SYNC_BEGIN' : 'SYNC_END')
    );

    engineRef.current = engine;
    syncRef.current = sync;

    const cached = sync.bootstrapFromLocal();
    if (cached?.playlist?.items) {
      setPlaylistItems(cached.playlist.items);
      engine.replacePlaylist(cached.playlist);
      stateMachine.transition('PLAYLIST_READY');
    }

    engine.startPlayback();
    void sync.forceFullSync();
    sync.startSyncLoop();

    return () => {
      stateMachine.transition('STOP');
      unsubscribeState();
      engine.stopPlaybackLoop();
      sync.stop();
      if (playbackErrorTimeoutRef.current) clearTimeout(playbackErrorTimeoutRef.current);
      if (noContentRetryTimeoutRef.current) clearTimeout(noContentRetryTimeoutRef.current);
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    };
  }, [deviceId, apiBaseUrl]);

  useEffect(() => {
    let active = true;
    const item = currentItem;
    const remoteUrl = item?.media?.url || '';
    if (!remoteUrl) {
      setResolvedMediaUrl('');
      return;
    }

    void mediaCache.getMediaSource(remoteUrl).then((url) => {
      if (!active) return;
      setResolvedMediaUrl(url);
    });

    const currentIndex = playlistItems.findIndex((playlistItem) => playlistItem.id === item?.id);
    if (currentIndex >= 0) {
      const nextItem = playlistItems[(currentIndex + 1) % playlistItems.length];
      void mediaCache.preloadOne(nextItem?.media?.url);
    }

    return () => {
      active = false;
    };
  }, [currentItem, playlistItems]);

  const handleVideoEnded = () => {
    engineRef.current?.onMediaEnded();
  };

  const handleMediaError = () => {
    console.warn('[player] media error, scheduling skip');
    stateMachineRef.current.transition('MEDIA_ERROR');
    if (playbackErrorTimeoutRef.current) clearTimeout(playbackErrorTimeoutRef.current);
    playbackErrorTimeoutRef.current = setTimeout(() => {
      engineRef.current?.next();
      stateMachineRef.current.transition('ERROR_RECOVERED');
      playbackErrorTimeoutRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    if (playlistItems.length > 0 || currentItem) return;
    if (noContentRetryTimeoutRef.current) clearTimeout(noContentRetryTimeoutRef.current);
    noContentRetryTimeoutRef.current = setTimeout(() => {
      console.info('[player] no content, retrying sync');
      stateMachineRef.current.transition('STARTUP');
      void syncRef.current?.forceFullSync();
    }, 30000);

    return () => {
      if (noContentRetryTimeoutRef.current) clearTimeout(noContentRetryTimeoutRef.current);
    };
  }, [playlistItems, currentItem]);

  useEffect(() => {
    const scheduleWatchdog = () => {
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = setTimeout(() => {
        const engine = engineRef.current;
        if (!engine) return scheduleWatchdog();
        const status = engine.getStatus();
        const idleForMs = Date.now() - lastRenderAtRef.current;
        const current = currentItemRef.current;
        const expectedMaxMs = (Math.max(1, current?.duration || 10) + 20) * 1000;

        if (status.playlistLength > 0 && status.shouldRun && !status.loopRunning) {
          console.warn('[player] watchdog recovered stopped playback loop');
          stateMachineRef.current.transition('STARTUP');
          engine.startPlayback();
          stateMachineRef.current.transition('PLAYLIST_READY');
        } else if (status.playlistLength > 0 && idleForMs > expectedMaxMs) {
          console.warn('[player] watchdog recovered stalled playback');
          stateMachineRef.current.transition('STARTUP');
          engine.restart();
          stateMachineRef.current.transition('PLAYLIST_READY');
        }

        // Invalid state failsafe: playlist exists but state is IDLE/LOADING too long.
        const stateNow = stateMachineRef.current.getState();
        if (status.playlistLength > 0 && (stateNow === PlayerState.IDLE || stateNow === PlayerState.LOADING) && idleForMs > 15000) {
          console.warn('[player] invalid state detected, forcing LOADING -> PLAYING');
          stateMachineRef.current.transition('STARTUP');
          stateMachineRef.current.transition('PLAYLIST_READY');
        }
        scheduleWatchdog();
      }, 15000);
    };

    scheduleWatchdog();
    return () => {
      if (watchdogTimeoutRef.current) clearTimeout(watchdogTimeoutRef.current);
    };
  }, []);

  if (state === PlayerState.LOADING) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white cursor-none select-none">
        <h1 className="text-2xl font-semibold">No Content</h1>
        <p className="mt-2 text-sm text-gray-400">Retrying content sync...</p>
        {isOffline && (
          <p className="mt-3 text-xs text-amber-400">
            Offline mode active
          </p>
        )}
      </div>
    );
  }

  const isVideo = currentItem.media?.type === 'video';
  const mediaUrl = resolvedMediaUrl || currentItem.media?.url || '';

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none select-none">
      {isOffline && (
        <div className="absolute top-3 right-3 z-10 rounded bg-black/50 px-2 py-1 text-xs text-amber-300">
          {isStaleOffline ? "Offline mode (stale cache)" : "Offline mode"}
        </div>
      )}
      {state === PlayerState.ERROR && (
        <div className="absolute bottom-3 right-3 z-10 rounded bg-red-900/70 px-2 py-1 text-xs text-red-100">
          Media error, skipping...
        </div>
      )}
      {isVideo ? (
        <video
          src={mediaUrl}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          muted
          onEnded={handleVideoEnded}
          onError={handleMediaError}
        />
      ) : (
        <img
          src={mediaUrl}
          className="w-full h-full object-contain"
          alt="Content"
          onError={handleMediaError}
        />
      )}
    </div>
  );
};
