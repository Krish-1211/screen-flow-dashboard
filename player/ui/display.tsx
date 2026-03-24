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
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const [itemA, setItemA] = useState<{ item: PlaylistItem | null, url: string }>({ item: null, url: '' });
  const [itemB, setItemB] = useState<{ item: PlaylistItem | null, url: string }>({ item: null, url: '' });
  const [playbackCycle, setPlaybackCycle] = useState(0);
  
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE);
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
  
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  const playVideoSafe = async (video: HTMLVideoElement | null) => {
    if (!video) return;
    if (!video.src) {
      console.error("[player] Video src missing, cannot play");
      return;
    }

    try {
      console.log(`[player] Hard reset triggered - CURRENT TIME: ${video.currentTime}, DURATION: ${video.duration}`);
      
      video.pause();
      video.currentTime = 0;
      
      // Force reload to clear browser ended state
      const originalSrc = video.src;
      video.src = originalSrc;
      video.load();

      setTimeout(async () => {
        try {
          video.muted = false;
          await video.play();
          console.log("[player] Playback restarted successfully");
        } catch (err) {
          console.warn('[player] Autoplay unmuted blocked, falling back to muted');
          video.muted = true;
          await video.play().catch(e => console.error('[player] Playback failed even when muted', e));
        }
      }, 150);
    } catch (err) {
      console.error('[player] Error in playVideoSafe', err);
    }
  };

  useEffect(() => {
    // Failsafe watchdog: If video is stuck in ended state, restart it.
    const interval = setInterval(() => {
      const activeVideo = activeLayer === 'A' ? videoRefA.current : videoRefB.current;
      if (activeVideo) {
        console.log(`[player] Watchdog Check - ended: ${activeVideo.ended}, currentTime: ${activeVideo.currentTime}`);
        if (activeVideo.ended) {
          console.warn("[player] Video stuck in ended state. Restarting...");
          void playVideoSafe(activeVideo);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeLayer]);

  useEffect(() => {
    console.log("Device ID (local):", localStorage.getItem("sf_device_id"));
  }, []);

  useEffect(() => {
    currentItemRef.current = (activeLayer === 'A' ? itemA : itemB).item;
    if (currentItemRef.current) {
      lastRenderAtRef.current = Date.now();
    }
  }, [itemA, itemB, activeLayer]);

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
    const registerScreen = async () => {
      if (!localStorage.getItem("sf_registered")) {
        try {
          const response = await fetch(`${apiBaseUrl}/screens/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              deviceId: deviceId,
              name: "Screen-" + deviceId.slice(0, 6)
            })
          });
          if (response.ok) {
            localStorage.setItem("sf_registered", "true");
            console.info("[player] Screen registered successfully");
          } else {
            const errData = await response.json();
            console.error("[player] Screen registration failed", errData);
          }
        } catch (e) {
          console.error("[player] Network error during registration", e);
        }
      }
    };
    void registerScreen();
  }, [deviceId, apiBaseUrl]);

  useEffect(() => {
    const stateMachine = stateMachineRef.current;
    const unsubscribeState = stateMachine.subscribe((nextState) => {
      console.info(`[player] state -> ${nextState}`);
      setState(nextState);
    });
    stateMachine.transition('STARTUP');

    const engine = new PlayerEngine(async (item) => {
      const url = await mediaCache.getMediaSource(item.media?.url || '');
      
      const currentItem = (activeLayer === 'A' ? itemA : itemB).item;
      const isLoop = currentItem?.id === item.id;
      
      if (isLoop) {
        console.log("[player] Solo loop detected, skipping layer swap and restarting current media.");
        const activeVideo = activeLayer === 'A' ? videoRefA.current : videoRefB.current;
        if (item.media?.type === 'video' && activeVideo) {
          void playVideoSafe(activeVideo);
        }
        // Even if not a video, increment cycle for potential UI needs
        setPlaybackCycle(prev => prev + 1);
        return;
      }

      setActiveLayer((current) => {
        const next = current === 'A' ? 'B' : 'A';
        if (next === 'A') {
          setItemA({ item, url });
        } else {
          setItemB({ item, url });
        }
        return next;
       });
     });

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

  // Handle video playback when layer changes
  useEffect(() => {
    if (activeLayer === 'A' && itemA.item?.media?.type === 'video') {
      void playVideoSafe(videoRefA.current);
    } else if (activeLayer === 'B' && itemB.item?.media?.type === 'video') {
      void playVideoSafe(videoRefB.current);
    }
  }, [activeLayer, itemA.item, itemB.item]);

  // Preloading
  useEffect(() => {
    const currentItem = (activeLayer === 'A' ? itemA : itemB).item;
    if (!currentItem) return;

    const currentIndex = playlistItems.findIndex((p) => p.id === currentItem.id);
    if (currentIndex >= 0) {
      const nextItem = playlistItems[(currentIndex + 1) % playlistItems.length];
      void mediaCache.preloadOne(nextItem?.media?.url);
    }
  }, [activeLayer, itemA.item, itemB.item, playlistItems]);

  const handleVideoEnded = () => {
    const video = activeLayer === 'A' ? videoRefA.current : videoRefB.current;
    if (video) {
        console.log("ENDED FIRED");
        console.log("CURRENT TIME:", video.currentTime);
        console.log("DURATION:", video.duration);
    }
    console.log("[player] VIDEO ENDED, advancing engine...");
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
    const currentItem = (activeLayer === 'A' ? itemA : itemB).item;
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
  }, [playlistItems, itemA.item, itemB.item, activeLayer]);

  useEffect(() => {
    console.log("[player] Active Playlist Items:", playlistItems);
    const engine = engineRef.current;
    if (engine) {
      const status = engine.getStatus();
      console.log(`[player] Current Status: index ${status.currentIndex}, length ${status.playlistLength}, loopRunning ${status.loopRunning}`);
    }
  }, [playlistItems, activeLayer]);

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

  const currentItem = (activeLayer === 'A' ? itemA : itemB).item;
  if (!currentItem && !itemA.item && !itemB.item) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white cursor-none select-none">
        <h1 className="text-2xl font-semibold">No Content</h1>
        <p className="mt-2 text-sm text-gray-400">Retrying content sync...</p>
        {isOffline && (
          <p className="mt-3 text-xs text-amber-400">Offline mode active</p>
        )}
      </div>
    );
  }

  const renderLayer = (layer: 'A' | 'B') => {
    const data = layer === 'A' ? itemA : itemB;
    if (!data.item) return null;
    
    const isVideo = data.item.media?.type === 'video';
    const isVisible = activeLayer === layer;

    return (
      <div 
        key={layer}
        className="fade-item"
        style={{ opacity: isVisible ? 1 : 0, zIndex: isVisible ? 2 : 1 }}
      >
        {isVideo ? (
          <video
            key={`${layer}-${data.item.id}-${playbackCycle}`}
            ref={layer === 'A' ? videoRefA : videoRefB}
            src={data.url}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            preload="auto"
            onEnded={layer === activeLayer ? handleVideoEnded : undefined}
            onError={layer === activeLayer ? handleMediaError : undefined}
          />
        ) : (
          <img
            key={`${layer}-${data.item.id}-${playbackCycle}`}
            src={data.url}
            className="w-full h-full object-contain"
            alt="Content"
            onError={layer === activeLayer ? handleMediaError : undefined}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none select-none">
      {isOffline && (
        <div className="absolute top-3 right-3 z-30 rounded bg-black/50 px-2 py-1 text-xs text-amber-300">
          {isStaleOffline ? "Offline mode (stale cache)" : "Offline mode"}
        </div>
      )}
      {state === PlayerState.ERROR && (
        <div className="absolute bottom-3 right-3 z-30 rounded bg-red-900/70 px-2 py-1 text-xs text-red-100">
          Media error, skipping...
        </div>
      )}
      <div className="fade-container">
        {renderLayer('A')}
        {renderLayer('B')}
      </div>
    </div>
  );
};
