import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOff, AlertTriangle } from "lucide-react";
import { syncService } from "@/services/sync-service";
import { screensApi } from "@/services/api/screens";
import type { Playlist } from "@/types";

export default function DisplayPlayerPage() {
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get("device_id");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enter fullscreen on mount if possible and handle kiosk mode
  useEffect(() => {
    const handleContext = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", handleContext);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("contextmenu", handleContext);
      document.body.style.overflow = "auto";
    };
  }, []);

  const preloadMedia = useCallback(async (pl: Playlist) => {
    console.log("Preloading media for offline use...");
    const fetchPromises = pl.items.map(item => {
      if (item.media?.url && item.media.type !== 'youtube') {
        return fetch(item.media.url)
          .then(res => {
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return res;
          })
          .catch(err => console.error(`Failed to preload ${item.media?.name}:`, err.message));
      }
      return Promise.resolve();
    });
    await Promise.all(fetchPromises);
    console.log("Preload complete.");
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    let interval: any;

    const startHeartbeat = async () => {
      try {
        // Start periodic heartbeats with deviceId
        screensApi.heartbeat(deviceId).catch(console.error);
        interval = setInterval(() => {
          screensApi.heartbeat(deviceId).catch(console.error);
        }, 30000);

        // Signal offline on tab close
        const handleUnload = () => {
          const data = JSON.stringify({ status: 'offline', device_id: deviceId });
          const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/screens/heartbeat`;
          navigator.sendBeacon(url, data);
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => {
          clearInterval(interval);
          window.removeEventListener('beforeunload', handleUnload);
        };
      } catch (err) {
        console.error("Heartbeat initialization failed", err);
      }
    };

    startHeartbeat();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [deviceId]);

  const loadPlaylist = useCallback(async (isInitial = false) => {
    if (!deviceId) return;
    try {
      if (isInitial && !playlist) setLoading(true);
      // Fetch the full screen + playlist config using device_id
      const data = await screensApi.getPlayerConfig(deviceId);
      
      if (data.id) {
        // data here is a serialized playlist with items
        setPlaylist(data);
        localStorage.setItem(`offline-playlist-${deviceId}`, JSON.stringify(data));
        preloadMedia(data);
      } else {
        setPlaylist(null);
      }
    } catch (err) {
      console.error("Failed to load playlist, trying offline storage", err);
      const offline = localStorage.getItem(`offline-playlist-${deviceId}`);
      if (offline) {
        const pl = JSON.parse(offline);
        setPlaylist(pl);
        preloadMedia(pl);
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId, preloadMedia, playlist]);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }
    loadPlaylist(true);
    const pollInterval = setInterval(() => loadPlaylist(false), 30000);

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

  const advanceMedia = useCallback(() => {
    setMediaError(false);
    if (!playlist?.items?.length) return;
    setCurrentIndex((prev) => (prev + 1) % playlist.items.length);
  }, [playlist]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playlist?.items?.length) return;

    const currentItem = playlist.items[currentIndex];
    const duration = currentItem.duration || 10;

    timerRef.current = setInterval(advanceMedia, duration * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, playlist, advanceMedia]);

  const handleMediaError = (e: any) => {
    const errorMsg = e?.target?.error ? `Error Code: ${e.target.error.code} - ${e.target.error.message}` : "General playback error";
    console.error(`Playback failed for ${currentItem?.media?.name}:`, errorMsg);
    setMediaError(true);
    setTimeout(advanceMedia, 5000); // skip to next after 5s
  };

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
        <h1 className="text-3xl font-bold">No Screen ID Provided</h1>
        <p className="mt-2 text-gray-400">Please use the URL generated from the dashboard.</p>
      </div>
    );
  }

  if (!playlist || playlist.items.length === 0) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white cursor-pointer"
        onClick={() => {
          if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(console.error);
          }
        }}
      >
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h1 className="text-3xl font-bold">No Content Assigned</h1>
        <p className="mt-2 text-gray-400">Please assign a playlist to this screen from the dashboard.</p>
        {!document.fullscreenElement && <p className="mt-4 text-xs text-gray-600">Click to enter fullscreen</p>}
      </div>
    );
  }

  const currentItem = playlist.items[currentIndex];
  // ensure there is media before checking type
  const isVideo = currentItem?.media?.type === 'video';
  const isYoutube = currentItem?.media?.type === 'youtube';
  const mediaUrl = currentItem?.media?.url || '/fallback.png';

  const getYoutubeEmbedUrl = (url: string) => {
    let videoId = "";
    if (url.includes("v=")) {
      videoId = url.split("v=")[1].split("&")[0];
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1].split("?")[0];
    } else {
      videoId = url;
    }
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&rel=0&showinfo=0`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none"
      onClick={() => {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(console.error);
        }
      }}
    >
      {/* Media Player */}
      {mediaError ? (
        <div className="flex flex-col items-center justify-center text-white">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold">Media Format Error</h2>
          <p className="text-gray-400">Skipping to next item...</p>
        </div>
      ) : (
        <div className="absolute inset-0 transition-opacity duration-1000">
          {isYoutube ? (
            <iframe
              key={currentItem.id}
              src={getYoutubeEmbedUrl(mediaUrl)}
              className="w-full h-full border-none pointer-events-none"
              allow="autoplay; encrypted-media"
              title="YouTube Content"
              onError={handleMediaError}
            />
          ) : isVideo ? (
            <video
              key={currentItem.id} // force re-mount for new source
              src={mediaUrl}
              className="w-full h-full object-cover animate-in fade-in duration-1000"
              autoPlay
              playsInline
              crossOrigin="anonymous"
              onError={handleMediaError}
              onEnded={advanceMedia} // videos might dictate their own duration playback
            />
          ) : (
            <img
              key={currentItem.id}
              src={mediaUrl}
              className="w-full h-full object-cover animate-in fade-in duration-1000"
              alt="Signage Content"
              crossOrigin="anonymous"
              onError={handleMediaError}
            />
          )}
        </div>
      )}

      {/* Connection Mode Indicator (Only show if offline for Kiosk) */}
      {!connected && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-50">
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-500 font-bold">OFFLINE</span>
        </div>
      )}
    </div>
  );
}
