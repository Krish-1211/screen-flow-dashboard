import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Volume2, VolumeX, WifiOff, Monitor, Settings, Save, Server } from "lucide-react";
import type { Playlist, PlayerContext } from "@/types";
import { evaluateActivePlaylist, localTimeStrShort, resolveSchedule, SAFE_PLACEHOLDER } from "../src/core/scheduler";
import { mediaCache } from "../storage/mediaCache";
import { playerConfig } from "../config/playerConfig";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

const getYouTubeID = (url: string) => {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

interface PlayerProps {
  deviceId: string;
  apiBaseUrl: string;
}

export const PlayerDisplay: React.FC<PlayerProps> = ({ deviceId: initialId, apiBaseUrl: initialUrl }) => {
  const [deviceId, setDeviceId] = useState(initialId);
  const [apiBaseUrl, setApiBaseUrl] = useState(initialUrl);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [connected, setConnected] = useState(navigator.onLine);
  const [context, setContext] = useState<PlayerContext | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [muted, setMuted] = useState(true);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentScheduleId, setCurrentScheduleId] = useState<string | number | null>(null);
  const [mediaKey, setMediaKey] = useState(Date.now());
  
  // HUD and Setup states
  const [showStatus, setShowStatus] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupUrl, setSetupUrl] = useState(apiBaseUrl);
  const [setupId, setSetupId] = useState(deviceId);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const preloadedNextRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isTransitioningRef = useRef(false);

  // ── Engine Core ──
  const advanceMedia = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    setMediaError(false);
    setFadeState('out');
    setTimeout(() => {
      setPlaylist(currentPl => {
        if (!currentPl?.items?.length || currentPl.items.length === 1) return currentPl;
        setCurrentIndex((prev) => (prev + 1) % currentPl.items.length);
        return currentPl;
      });
      setFadeState('in');
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 50);
    }, 300);
  }, []);

  const handleMediaError = useCallback(() => {
    setMediaError(true);
    setTimeout(advanceMedia, 5000);
  }, [advanceMedia]);

  const onYouTubePlayerStateChange = useCallback((event: any) => {
    // 0 is ENDED
    if (event.data === 0) {
      console.info("[player] YouTube ended, advancing...");
      advanceMedia();
    }
  }, [advanceMedia]);

  // ── Keyboard Controls ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setShowStatus(prev => !prev);
      if (e.key === 's' || e.key === 'S') setShowSetup(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // ── Ticker & Clock & API Injection ──
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    // Inject YouTube API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
    return () => clearInterval(t);
  }, []);

  // ── Schedule Evaluator ──
  useEffect(() => {
    if (!context) return;

    // 1. Resolve exact default playlist
    const defaultPlId = context.screen.defaultPlaylistId || (context.screen as any).playlist_id;
    const defaultPlaylist = context.playlists.find(p => String(p.id) === String(defaultPlId)) || SAFE_PLACEHOLDER();

    // 2. Hydrate schedules with their playlist objects
    const hydratedSchedules = context.schedules.map(s => ({
      ...s,
      playlist: context.playlists.find(p => String(p.id) === String(s.playlistId || s.playlist_id))
    })).filter(s => !!s.playlist) as any[];

    // 3. Resolve using current time as single source of truth
    const resolved = resolveSchedule(hydratedSchedules, currentTime, defaultPlaylist);

    // 4. Detect schedule change and reset playback if needed
    if (resolved.id !== currentScheduleId) {
      console.log("Schedule changed:", currentScheduleId, "→", resolved.id);
      setCurrentScheduleId(resolved.id);
      setCurrentIndex(0);
      setMediaKey(Date.now());
    }

    // 5. Always update playlist from resolved (to respect latest sync data)
    setPlaylist(resolved.playlist);
  }, [currentTime, context]);

  // ── Sync Logic Implementation ──
  // ── Sync Logic Implementation (Basic Auto-Sync) ──
  const syncData = useCallback(async () => {
    if (!deviceId) return;
    try {
      console.log("Sync: Refreshing data...");
      const response = await fetch(`${apiBaseUrl}/screens/player?device_id=${deviceId}`);
      if (!response.ok) throw new Error("Sync failed");
      
      const newContext = await response.json();
      setContext(newContext);
      setConnected(true);
      setLoading(false);
    } catch (e) {
      console.error("Sync: Error fetching context:", e);
      setConnected(false);
      setLoading(false);
    }
  }, [deviceId, apiBaseUrl]);

  useEffect(() => {
    if (!deviceId) return;

    // Initial sync
    syncData();

    // Polling every 60 seconds
    const interval = setInterval(syncData, 60000);

    return () => clearInterval(interval);
  }, [deviceId, syncData]);

  // ── Media Playback Management ──
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!playlist?.items?.length) return;

    const currentItem = playlist.items[currentIndex];
    
    // Safety check for video playback
    if (currentItem?.media?.type === 'video') {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      return; // Video uses 'onEnded' event
    }

    // Special handling for YouTube
    if (currentItem?.media?.type === 'youtube') {
      // We rely completely on the YouTube IFrame API (onStateChange === 0) to advance.
      // We explicitly ignore legacy duration flags (like the default 10s) from the database
      // to ensure the video always plays in its entirety.
      return; 
    }

    // Default duration handling for Images/Static
    const duration = currentItem.duration || 10;
    timerRef.current = setTimeout(advanceMedia, duration * 1000);
    
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, playlist, advanceMedia]);

  const handleSaveSetup = () => {
    localStorage.setItem('sf_api_url', setupUrl);
    localStorage.setItem('sf_device_id', setupId);
    window.location.reload();
  };

  if (loading && !showSetup) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
      </div>
    );
  }

  // ── Fallback / Setup Selection ──
  if ((!playlist || !playlist.items || playlist.items.length === 0) || showSetup) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white text-center p-6 font-sans">
        <div className="mb-12">
          <Monitor className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold tracking-tight">VISIQON</h1>
          <p className="text-blue-400/50 uppercase tracking-widest text-[10px] mt-1">Player Setup</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-md backdrop-blur-xl shadow-2xl">
          <div className="space-y-6 text-left">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2 font-bold">Server Connectivity</label>
              <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-white/5">
                <Server className="w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  value={setupUrl} 
                  onChange={(e) => setSetupUrl(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-sm font-mono"
                  placeholder="https://api.visiqon.com"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2 font-bold">Identity Secret</label>
              <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-white/5">
                <Settings className="w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  value={setupId} 
                  onChange={(e) => setSetupId(e.target.value)}
                  className="bg-transparent border-none outline-none w-full text-sm font-mono"
                  placeholder="Paste Device ID here"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveSetup}
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-4 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              ACTIVATE VISIQON
            </button>
          </div>
        </div>

        <div className="mt-8 text-gray-600 text-[10px] uppercase tracking-widest">
           System Time: {localTimeStrShort(currentTime)}
        </div>
      </div>
    );
  }

  const currentItem = playlist.items[currentIndex];
  const isVideo = currentItem?.media?.type === "video";
  const mediaUrl = currentItem?.media?.url || '';

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none">
      <div 
        className="absolute inset-0" 
        style={{ opacity: fadeState === 'in' ? 1 : 0, transition: 'opacity 200ms ease' }}
      >
        {isVideo ? (
          <video
            key={`${currentItem.id}-${currentIndex}-${mediaKey}`}
            ref={videoRef}
            src={mediaUrl}
            autoPlay playsInline muted={muted} loop={false}
            className="w-full h-full object-contain"
            onEnded={advanceMedia}
            onError={handleMediaError}
          />
        ) : (currentItem?.media?.type === 'youtube') ? (
          <iframe
            key={`${currentItem.id}-${currentIndex}-${mediaKey}`}
            src={`https://www.youtube.com/embed/${getYouTubeID(mediaUrl)}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&enablejsapi=1`}
            className="w-full h-full border-none"
            allow="autoplay; encrypted-media"
            onLoad={(e) => {
              // Connect and listen for events
              if (window.YT && window.YT.Player) {
                new window.YT.Player(e.currentTarget, {
                  events: {
                    onStateChange: onYouTubePlayerStateChange
                  }
                });
              }
            }}
          />
        ) : (
          <img
            key={`${currentItem.id}-${mediaKey}`}
            src={mediaUrl || '/black-screen.png'}
            className="w-full h-full object-contain bg-black"
            onError={handleMediaError}
          />
        )}
      </div>

      {/* Connectivity Alert */}
      {!connected && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-red-500/30 px-3 py-1 rounded-full z-50">
          <WifiOff size={12} className="text-red-500" />
          <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Offline</span>
        </div>
      )}

      {/* Minimal Logo Overlay */}
      <div className="absolute bottom-4 left-4 z-50 pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 font-mono text-[9px] text-white">
          <span className="font-bold tracking-widest">VISIQON</span>
          <span className="text-white/20">|</span>
          <span className="text-white/40">{localTimeStrShort(currentTime)}</span>
        </div>
      </div>

      {/* Diagnostic Overlay */}
      {showStatus && (
        <div className="absolute inset-0 bg-black/90 p-10 text-white font-mono z-[9999] pointer-events-none">
          <h1 className="text-xl font-bold border-b border-white/20 pb-2 mb-4 text-blue-500">VISIQON_CORE_DIAGNOSTIC</h1>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4 text-xs">
              <div>DEVICE_ID: <span className="text-yellow-500">{deviceId}</span></div>
              <div>SERVER: <span className="text-blue-400">{apiBaseUrl}</span></div>
              <div>STATUS: <span className={connected ? "text-green-500" : "text-red-500"}>{connected ? "ONLINE" : "OFFLINE"}</span></div>
              <div>PLAYLIST: {playlist?.name} ({playlist?.id})</div>
              <div>INDEX: {currentIndex + 1} / {playlist?.items?.length}</div>
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest text-right">
              Press 'D' to hide | Press 'S' for Setup
            </div>
          </div>
        </div>
      )}
    </div>
  );
};