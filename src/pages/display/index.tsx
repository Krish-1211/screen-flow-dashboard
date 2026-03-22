import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { WifiOff, AlertTriangle } from "lucide-react";
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
    const fetchPromises = pl.items.map(item => {
      if (item.media?.url && item.media.type !== 'youtube') {
        return fetch(item.media.url)
          .then(res => res.ok ? res : Promise.reject())
          .catch(() => {});
      }
      return Promise.resolve();
    });
    await Promise.all(fetchPromises);
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

  const loadPlaylist = useCallback(async (isInitial = false) => {
    if (!deviceId) return;
    try {
      if (isInitial) setLoading(true);
      
      // Get local context to help server with scheduling
      const now = new Date();
      const localTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      // JS getDay() is 0=Sun, 1=Mon. Dashboard days are 0=Mon, 6=Sun. Need to convert.
      const jsDay = now.getDay();
      const localDay = jsDay === 0 ? 6 : jsDay - 1;
      
      const data = await screensApi.getPlayerConfig(deviceId, localTime, localDay);
      
      if (data && data.items) {
        setPlaylist(data);
        localStorage.setItem(`offline-playlist-${deviceId}`, JSON.stringify(data));
        preloadMedia(data);
      } else {
        setPlaylist(null);
      }
    } catch (err) {
      console.error("Failed to load playlist, using offline storage", err);
      const offline = localStorage.getItem(`offline-playlist-${deviceId}`);
      if (offline) {
        const pl = JSON.parse(offline);
        setPlaylist(pl);
        preloadMedia(pl);
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [deviceId, preloadMedia]);

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
    setMediaError(true);
    setTimeout(advanceMedia, 5000);
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
        <div className="absolute inset-0">
          {isYoutube ? (
            <iframe
              key={currentItem.id}
              src={getYoutubeEmbedUrl(mediaUrl)}
              className="w-full h-full border-none"
              allow="autoplay; encrypted-media"
              title="YouTube"
            />
          ) : isVideo ? (
            <video
              key={currentItem.id}
              src={mediaUrl}
              className="w-full h-full object-contain"
              autoPlay
              playsInline
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

      {!connected && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-50">
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-500 font-bold uppercase">Offline</span>
        </div>
      )}
    </div>
  );
}
