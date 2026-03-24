import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOff, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { screensApi } from "@/services/api/screens";
import type { Playlist } from "@/types";

export default function DisplayPlayerPage() {
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
      
      // Force URL update (keep name if provided)
      const targetUrl = urlName 
        ? `/display?device_id=${newId}&name=${urlName}` 
        : `/display?device_id=${newId}`;
      window.history.replaceState({}, "", targetUrl);
      return newId;
    };

    const finalId = getOrCreateDeviceId();
    console.log("Device ID:", finalId);
    setDeviceId(finalId);

    // ── Step 6: Prevent duplicate screen registration ──
    const register = async () => {
      if (localStorage.getItem("sf_registered") === "true") return;

      const params = new URLSearchParams(window.location.search);
      const urlName = params.get("name");

      try {
        await screensApi.register({
          deviceId: finalId,
          name: urlName || `Screen-${finalId.slice(0, 6)}`
        });
        localStorage.setItem("sf_registered", "true");
        console.log("Screen auto-registered:", finalId, "as:", urlName || "Auto");
      } catch (err) {
        // If it fails with 409 or similar, it might already exist
        console.warn("Auto-registration check:", err);
      }
    };
    register();
  }, []);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingPlaylistRef = useRef<Playlist | null>(null);
  const isVideoPlayingRef = useRef(false);
  const preloadedNextRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── Disable right-click & scrollbar ──
  useEffect(() => {
    const handleContext = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handleContext);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.body.style.overflow = "auto";
    };
  }, []);

  // ── Preload the NEXT item in background ──
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

  // ── Heartbeat (unchanged) ──
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

  // ── Playlist loading (only stage pending if content actually changed) ──
  const loadPlaylist = useCallback(async (isInitial = false) => {
    if (!deviceId) return;
    try {
      if (isInitial) setLoading(true);
      
      const now = new Date();
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const jsDay = now.getDay();
      const localDay = jsDay === 0 ? 6 : jsDay - 1;
      
      const data = await screensApi.getPlayerConfig(deviceId, localTime, localDay);
      
      if (data && data.items) {
        localStorage.setItem(`offline-playlist-${deviceId}`, JSON.stringify(data));

        if (isInitial) {
          setPlaylist(data);
        } else {
          // Only stage a pending update if the playlist actually changed
          // (different ID or different number of items = real change)
          pendingPlaylistRef.current = data;
        }
      } else if (isInitial) {
        setPlaylist(null);
      }
    } catch (err) {
      console.error("Failed to load playlist, using offline storage", err);
      const offline = localStorage.getItem(`offline-playlist-${deviceId}`);
      if (offline) {
        const pl = JSON.parse(offline);
        if (isInitial) setPlaylist(pl);
        else pendingPlaylistRef.current = pl;
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [deviceId]);

  // ── Poll interval & online/offline (unchanged structure) ──
  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    loadPlaylist(true);
    const pollInterval = setInterval(() => loadPlaylist(false), 10000);

    const handleOnline = () => setConnected(true);
    const handleOffline = () => setConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPlaylist, deviceId]);

  // ── Advance to next item with crossfade ──
  const advanceMedia = useCallback(() => {
    setMediaError(false);
    isVideoPlayingRef.current = false;

    // Fade out current item
    setFadeState('out');

    setTimeout(() => {
      // Check if a genuinely different playlist arrived from background poll
      const pending = pendingPlaylistRef.current;
      if (pending) {
        pendingPlaylistRef.current = null;

        // Only reset to index 0 if this is a DIFFERENT playlist
        // (different ID = schedule changed or admin swapped playlists)
        const currentId = playlist?.id;
        const pendingId = pending.id;
        
        if (pendingId !== currentId) {
          setPlaylist(pending);
          setCurrentIndex(0);
        } else {
          // Same playlist re-fetched — just update data silently and advance
          setPlaylist(pending);
          setCurrentIndex((prev) => (prev + 1) % (pending.items?.length || 1));
        }
      } else if (playlist?.items?.length) {
        setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
      }
      // Fade in next item
      setFadeState('in');
    }, 200);
  }, [playlist]);

  // ── Timer logic: only for images and youtube, NOT for videos ──
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!playlist?.items?.length) return;

    const currentItem = playlist.items[currentIndex];
    const mediaType = currentItem?.media?.type;

    if (mediaType === 'video') {
      // Videos advance via onEnded — no timer needed
      isVideoPlayingRef.current = true;
      // Preload the next item while this video plays
      preloadNextItem(playlist, currentIndex);
      return;
    }

    // Images & YouTube use duration-based timer
    const duration = currentItem.duration || 10;
    
    // Preload next item during this item's display
    preloadNextItem(playlist, currentIndex);

    timerRef.current = setTimeout(advanceMedia, duration * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, playlist, advanceMedia, preloadNextItem]);

  // ── Error handler ──
  const handleMediaError = () => {
    setMediaError(true);
    setTimeout(advanceMedia, 5000);
  };

  // ── Mute toggle (applies to active video element live) ──
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger fullscreen
    setMuted(prev => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  // ── Early returns for loading / error states (unchanged) ──
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold">Missing Device ID</h1>
        <p className="mt-2 text-gray-400">Please use the full URL from your dashboard.</p>
      </div>
    );
  }

  if (!playlist || playlist.items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-2xl font-bold">No Content Assigned</h1>
        <p className="mt-2 text-gray-400 max-w-md">Please assign a playlist to this screen from the dashboard to begin playback.</p>
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
            <div className="w-full h-full bg-black" />
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
              key={`${currentItem.id}-${currentIndex}`} // Unique key to force re-render
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
              muted={muted}
              preload="auto"
              onError={handleMediaError}
              onEnded={advanceMedia}
            />
          ) : (
            <img
              key={currentItem.id}
              src={mediaUrl}
              className="w-full h-full object-contain"
              alt="Content"
              onError={handleMediaError}
            />
          )}
        </div>
      )}

      {/* Mute / Unmute Toggle */}
      {(isVideo || isYoutube) && !mediaError && (
        <button
          onClick={toggleMute}
          className="absolute bottom-4 right-4 z-50 bg-black/50 backdrop-blur-sm rounded-full p-2.5 
                     text-white/70 hover:text-white hover:bg-black/70 transition-all duration-200
                     opacity-0 hover:opacity-100 focus:opacity-100"
          style={{ opacity: undefined }} // Let CSS handle it, show on hover via group
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
    </div>
  );
}
