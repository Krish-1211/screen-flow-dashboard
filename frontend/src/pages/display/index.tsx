import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOff, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { screensApi } from "@/services/api/screens";
import type { Playlist, PlayerContext, Schedule } from "@/types";

// ── Helpers (Defined outside component to avoid TDZ issues) ──
const localTimeStrShort = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

export default function DisplayPlayerPage() {
  console.log("PLAYER REAL BUILD v3.1");

  const [searchParams, setSearchParams] = useSearchParams();
  const urlDeviceId = searchParams.get("device_id");
  
  // ── Step 1: Initialize Identity ──
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const isValidDeviceId = (id: string | null) => {
      return id && id !== "null" && id !== "undefined" && id.trim() !== "";
    };

    const getOrCreateDeviceId = () => {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("device_id");
      const urlName = params.get("name");

      if (isValidDeviceId(urlId)) {
        localStorage.setItem("sf_device_id", urlId!);
        return urlId!;
      }

      const stored = localStorage.getItem("sf_device_id");
      if (isValidDeviceId(stored)) return stored!;

      const newId = crypto.randomUUID();
      localStorage.setItem("sf_device_id", newId);
      
      const targetUrl = urlName 
        ? `/display?device_id=${newId}&name=${urlName}` 
        : `/display?device_id=${newId}`;
      window.history.replaceState({}, "", targetUrl);
      return newId;
    };

    const finalId = getOrCreateDeviceId();
    console.log("Device ID:", finalId);
    setDeviceId(finalId);

    const register = async () => {
      if (localStorage.getItem("sf_registered") === "true") return;

      const params = new URLSearchParams(window.location.search);
      const urlName = params.get("name");

      try {
        await screensApi.register({
          deviceId: finalId,
          name: urlName || "" 
        });
        localStorage.setItem("sf_registered", "true");
        console.log("Screen registration check completed:", finalId);
      } catch (err) {
        console.warn("Auto-registration check:", err);
      }
    };
    register();
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [context, setContext] = useState<PlayerContext | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [clockTime, setClockTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingPlaylistRef = useRef<Playlist | null>(null);
  const isVideoPlayingRef = useRef(false);
  const preloadedNextRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── Diagnostic Visibility ──
  useEffect(() => {
    (window as any).playerState = {
      context,
      playlist,
      deviceId,
      currentIndex
    };
  }, [context, playlist, deviceId, currentIndex]);

  useEffect(() => {
    const handleContext = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handleContext);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.body.style.overflow = "auto";
    };
  }, []);

  const preloadNextItem = useCallback((pl: Playlist, idx: number) => {
    if (!pl?.items?.length) return;
    const nextIdx = (idx + 1) % pl.items.length;
    const nextItem = pl.items[nextIdx];
    if (!nextItem?.media?.url || nextItem.media.type === 'youtube') return;

    if (nextItem.media.type === 'video') {
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.src = nextItem.media.url;
      vid.load();
      preloadedNextRef.current = vid;
    } else {
      const img = new Image();
      img.src = nextItem.media.url;
      preloadedNextRef.current = img;
    }
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    let interval: any;

    const startHeartbeat = async () => {
      screensApi.heartbeat(deviceId);
      interval = setInterval(() => {
        screensApi.heartbeat(deviceId);
      }, 30000);

      const handleUnload = () => {
        const data = JSON.stringify({ status: 'offline', device_id: deviceId });
        const url = `${import.meta.env.VITE_API_URL || 'https://screen-api-6sac.onrender.com'}/screens/heartbeat`;
        navigator.sendBeacon(url, data);
      };
      window.addEventListener('beforeunload', handleUnload);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleUnload);
      };
    };

    startHeartbeat();
    return () => clearInterval(interval);
  }, [deviceId]);

  const lastPlaylistRef = useRef<Playlist | null>(null);

  const SAFE_PLACEHOLDER = useCallback((): Playlist => ({
    id: 'safe-recovery',
    name: 'Safe Recovery',
    node_type: 'playlist',
    items: [{
      id: 'safe-item',
      mediaId: 'safe-media',
      duration: 60,
      order: 0,
      media: {
        id: 'safe-media',
        name: 'System Recovery',
        type: 'system_gap',
        url: '',
        node_type: 'file'
      }
    }]
  }), []);

  const evaluateActivePlaylist = useCallback((ctx: PlayerContext): Playlist => {
    const evalNow = new Date(); // Use local scope variable
    const currentDay = evalNow.getDay() === 0 ? 6 : evalNow.getDay() - 1;
    const currentMinutes = evalNow.getHours() * 60 + evalNow.getMinutes();

    console.log("===== EVALUATING PLAYLIST =====");
    console.log("Current Time:", localTimeStrShort(evalNow));
    
    const safeSchedules = (ctx.schedules || []).map(s => ({
      ...s,
      playlistId: String((s as any).playlistId || (s as any).playlist_id)
    }));

    const activeSchedules = safeSchedules.filter(s => {
      const days = (s.days || []).map(Number);
      const isDayMatch = days.includes(currentDay);
      
      const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      
      const start = toMin(s.startTime);
      const end = toMin(s.endTime);
      
      let isTimeMatch = false;
      if (end < start) {
        // Overnight case
        isTimeMatch = currentMinutes >= start || currentMinutes < end;
      } else {
        // Normal case
        isTimeMatch = currentMinutes >= start && currentMinutes < end;
      }

      console.log(`[player] Eval Sched ${s.id}: dayMatch=${isDayMatch}(${days} vs ${currentDay}), timeMatch=${isTimeMatch}(${start}-${end} vs ${currentMinutes})`);
      
      return isDayMatch && isTimeMatch;
    });

    console.log("Active Schedules:", activeSchedules);

    let targetId: string | null = null;
    let strategy = "none";

    if (activeSchedules.length > 0) {
      activeSchedules.sort((a, b) => {
        if (a.startTime !== b.startTime) return b.startTime.localeCompare(a.startTime);
        return String(b.id).localeCompare(String(a.id));
      });
      targetId = String(activeSchedules[0].playlistId);
      strategy = "schedule";
    } 
    else if (ctx.screen.defaultPlaylistId || (ctx.screen as any).playlist_id) {
      targetId = String(ctx.screen.defaultPlaylistId || (ctx.screen as any).playlist_id);
      strategy = "default";
    }

    const findPl = (id: string | null) => {
      if (!id) return null;
      return ctx.playlists.find(p => String(p.id) === id && p.items?.length > 0);
    };

    let resolved = findPl(targetId);

    if (resolved) {
      console.log(`[player] RESOLVED: ${resolved.id} (${strategy})`);
      lastPlaylistRef.current = resolved;
      return resolved;
    }

    console.warn(`[player] No active schedule or default playlist found. Strategy was: ${strategy}`);
    return SAFE_PLACEHOLDER();
  }, [SAFE_PLACEHOLDER]);

  const loadPlaylist = useCallback(async (isInitial = false) => {
    if (!deviceId) return;
    try {
      if (isInitial) setLoading(true);
      
      const loadNow = new Date();
      const localTime = `${String(loadNow.getHours()).padStart(2, '0')}:${String(loadNow.getMinutes()).padStart(2, '0')}`;
      const jsDay = loadNow.getDay();
      const localDay = jsDay === 0 ? 6 : jsDay - 1;
      
      const data: PlayerContext = await screensApi.getPlayerConfig(deviceId, localTime, localDay);
      
      console.log("FULL CONTEXT RECEIVED:", data);
      
      if (data && data.playlists) {
        setContext(data);
        const activePl = evaluateActivePlaylist(data);

        setPlaylist(currentPl => {
            if (activePl?.id !== currentPl?.id) {
                console.info(`[player] sync flip: ${currentPl?.id} -> ${activePl?.id}`);
                setCurrentIndex(0);
                return activePl;
            }
            return activePl; 
        });
      } else {
        setPlaylist(null);
      }
      
      localStorage.setItem(`sf_heartbeat_${deviceId}`, Date.now().toString());
    } catch (err) {
      console.warn("[player] Sync failure, retrying 5s", err);
      setTimeout(() => loadPlaylist(false), 5000);
    } finally {
      setLoading(false); 
    }
  }, [deviceId, evaluateActivePlaylist]);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    
    loadPlaylist(true);
    const pollInterval = setInterval(() => loadPlaylist(false), 15000);

    const watchdog = setInterval(() => {
      const lastPing = parseInt(localStorage.getItem(`sf_heartbeat_${deviceId}`) || "0");
      if (Date.now() - lastPing > 60000) {
        window.location.reload();
      }
    }, 15000);

    const handleOnline = () => setConnected(true);
    const handleOffline = () => setConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(pollInterval);
      clearInterval(watchdog);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPlaylist, deviceId]);

  useEffect(() => {
    if (!context) return;
    const interval = setInterval(() => {
        const activePl = evaluateActivePlaylist(context);
        setPlaylist(currentPl => {
            if (activePl?.id !== currentPl?.id) {
                console.info(`[player] local schedule flip: ${currentPl?.id} -> ${activePl?.id}`);
                setCurrentIndex(0);
                return activePl;
            }
            return currentPl;
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [context, evaluateActivePlaylist]);

  const advanceMedia = useCallback(() => {
    setMediaError(false);
    isVideoPlayingRef.current = false;
    
    // --- Phase 4: Smooth transition (Black Frame transition) ---
    // Instead of switching instantly, we fade OUT then switch INDEX then fade IN.
    setFadeState('out');

    setTimeout(() => {
      setPlaylist(currentPl => {
        if (!currentPl?.items?.length) return currentPl;
        
        // Single item? No index change.
        if (currentPl.items.length === 1) return currentPl;

        setCurrentIndex((prev) => (prev + 1) % currentPl.items.length);
        return currentPl;
      });
      setFadeState('in');
    }, 300); // 300ms black buffer
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!playlist?.items?.length) return;

    const currentItem = playlist.items[currentIndex];
    const mediaType = currentItem?.media?.type;

    // --- Phase 1: Static Preservation (Images/Gap) ---
    if (playlist.items.length === 1) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (mediaType === 'video' && videoRef.current) {
         videoRef.current.loop = true;
         videoRef.current.play().catch(() => {});
      }
      console.log("[player] SINGLE ITEM STABLE STATE");
      return;
    }

    // --- Phase 2: Playback Transition Management ---
    if (mediaType === 'video') {
      isVideoPlayingRef.current = true;
      preloadNextItem(playlist, currentIndex);
      return; 
    }

    const duration = currentItem.duration || 10;
    preloadNextItem(playlist, currentIndex);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advanceMedia, duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, playlist, advanceMedia, preloadNextItem]);

  const handleMediaError = () => {
    setMediaError(true);
    setTimeout(advanceMedia, 5000);
  };

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); 
    setMuted(prev => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold">Missing Device ID</h1>
        <p className="mt-2 text-gray-400">Please use the full URL from your dashboard.</p>
      </div>
    );
  }

  // Early return for "No Content" is fine now because it uses helpers defined at top
  if (!playlist || !playlist.items || playlist.items.length === 0) {
    const errorNow = new Date();
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold">Waiting for Content</h1>
        <p className="mt-2 text-gray-400 max-w-md">
          {context ? "No active schedule or default playlist found for this screen." : "Connecting to server..."}
        </p>
        
        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-4xl font-bold font-mono tracking-tighter text-gray-100">{localTimeStrShort(errorNow)}</span>
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">Device Local Time</span>
        </div>

        <div className="mt-12 text-[10px] text-gray-600 font-mono tracking-widest uppercase py-1 px-3 border border-gray-800 rounded">
          DEVICE ID: {deviceId}
        </div>
      </div>
    );
  }

  const currentItem = playlist.items[currentIndex];
  const isVideo = currentItem?.media?.type === 'video';
  const isYoutube = currentItem?.media?.type === 'youtube';
  const isGap = currentItem?.media?.type === 'system_gap';
  const mediaUrl = currentItem?.media?.url || '';

  const getYoutubeEmbedUrl = (url: string) => {
    let videoId = "";
    if (url.includes("v=")) videoId = url.split("v=")[1].split("&")[0];
    else if (url.includes("youtu.be/")) videoId = url.split("youtu.be/")[1].split("?")[0];
    else videoId = url;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&modestbranding=1&loop=1&rel=0&showinfo=0`;
  };

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none"
      onClick={() => {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(() => {});
        }
      }}
    >
      {mediaError ? (
        <div className="flex flex-col items-center justify-center text-white">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold">Media Error</h2>
          <p className="text-gray-400">Skipping in 5s...</p>
        </div>
      ) : (
        <div 
          className="absolute inset-0"
          style={{
            opacity: fadeState === 'in' ? 1 : 0,
            transition: 'opacity 200ms ease'
          }}
        >
          {isGap ? (
            <div className="w-full h-full bg-black shadow-[inset_0_0_100px_rgba(0,0,0,1)]" />
          ) : isYoutube ? (
            <iframe
              key={currentItem.id}
              src={getYoutubeEmbedUrl(mediaUrl)}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media"
              title="YouTube"
            />
          ) : isVideo ? (
            <video
              key={playlist.items.length === 1 ? 'static-video' : `${currentItem.id}-${mediaUrl}-${currentIndex}`} 
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              muted={muted}
              loop={playlist.items.length === 1}
              preload="auto"
              onError={handleMediaError}
              onEnded={() => {
                if (playlist.items.length === 1) {
                   console.log("[player] Single item video loop restart");
                   if (videoRef.current) {
                     videoRef.current.currentTime = 0;
                     videoRef.current.play().catch(() => {});
                   }
                } else {
                   advanceMedia();
                }
              }}
            />
          ) : (
            <img
              key={playlist.items.length === 1 ? 'static-img' : currentItem.id}
              src={mediaUrl}
              className="w-full h-full object-contain"
              alt="Content"
              onError={handleMediaError}
            />
          )}
        </div>
      )}

      {(isVideo || isYoutube) && !mediaError && (
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 z-50 bg-black/50 backdrop-blur-sm rounded-full p-2.5 
                     text-white/70 hover:text-white hover:bg-black/70 transition-all duration-200"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}

      {!connected && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-50">
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-500 font-bold uppercase">Offline</span>
        </div>
      )}

      {/* --- Diagnostic HUD --- */}
      <div className="absolute bottom-4 left-4 z-50 pointer-events-none group">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-2 text-[10px] font-mono text-white/40 group-hover:text-white/80 transition-opacity">
          <div>PLAYING: {playlist.name}</div>
          <div>ID: {playlist.id}</div>
          <div className="flex gap-2 mt-1">
            <span className={`px-1 rounded ${playlist.id === 'safe-recovery' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {playlist.id === 'safe-recovery' ? 'SAFE_GAP' : 'STABLE'}
            </span>
            <span>{localTimeStrShort(new Date())}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
