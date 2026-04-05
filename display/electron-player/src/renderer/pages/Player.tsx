import React, { useEffect, useRef, useState } from 'react';

interface MediaItem {
  id: number;
  duration: number;
  filename: string; // Will be normalized
  url: string;      // Will be normalized
  file_type: string; // Will be normalized
  media?: {         // Raw backend property
    name: string;
    type: string;
    url?: string;
  };
}

interface PlaylistData {
  playlist_id: number;
  items: MediaItem[];
}

type AppState = 'loading' | 'waiting' | 'playing' | 'offline';

export default function Player() {
  const [state, setState] = useState<AppState>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [localPaths, setLocalPaths] = useState<Record<string, string>>({});
  const [isOnline, setIsOnline] = useState(true);
  const configRef = useRef<{ serverUrl: string; deviceId: string } | null>(null);
  const syncIntervalRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const playTimerRef = useRef<any>(null);

  useEffect(() => {
    init();
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, []);

  async function init() {
    console.log('Player initializing...');
    const config = await window.screenflow.config.get();
    console.log('Config loaded:', config);
    configRef.current = config;
    await syncPlaylist();

    // Heartbeat every 30 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (configRef.current) {
        window.screenflow.player.heartbeat(configRef.current);
      }
    }, 30000);

    // Re-sync every 60 seconds (better for responsiveness)
    syncIntervalRef.current = setInterval(syncPlaylist, 60 * 1000);
  }

  async function syncPlaylist() {
    if (!configRef.current) return;
    console.log('Checking for playlist updates...', new Date().toLocaleTimeString());

    try {
      const result = await window.screenflow.player.fetchPlaylist(configRef.current);

      if (result.success && result.data?.items?.length > 0) {
        console.log('Playlist fetched successfully:', result.data.items.length, 'items');
        setIsOnline(true);
        
        // NORMALIZE: Convert backend structure to what the player expects
        const normalizedItems = result.data.items.map((item: any) => {
          const media = item.media || {};
          const rawUrl = media.url || media.name || '';
          
          // Construct full URL if it's relative
          const fullUrl = rawUrl.startsWith('http') 
            ? rawUrl 
            : `${configRef.current?.serverUrl}/${rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl}`;
            
          // PREVENT ENAMETOOLONG: Strip query parameters from filename
          const filenameWithParams = rawUrl.split('/').pop() || '';
          const filename = filenameWithParams.split('?')[0] || `item-${item.id}`;

          return {
            ...item,
            url: fullUrl,
            filename: filename,
            file_type: media.type || (filename.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image')
          };
        });

        // Smart Update: Detect any change in items or order
        const getHash = (list: MediaItem[]) => JSON.stringify(list.map(i => ({ id: i.id, url: i.url, duration: i.duration })));
        const currentItemsHash = getHash(items);
        const newItemsHash = getHash(normalizedItems);
        
        if (newItemsHash !== currentItemsHash || state !== 'playing') {
          console.log('Playlist changed or first load, updating app state...');
          // Cache the normalized playlist
          await window.screenflow.player.cachePlaylist({ ...result.data, items: normalizedItems });
          // Download all media files
          await downloadAllMedia(normalizedItems);
        } else {
          console.log('Playlist unchanged, keeping current playback.');
        }
      } else {
        console.log('Server unreachable or empty playlist, trying cache...');
        setIsOnline(false);
        // Try cached playlist
        const cached = await window.screenflow.player.getCachedPlaylist();
        if (cached?.items?.length > 0) {
          console.log('Loaded from cache:', cached.items.length, 'items');
          await loadLocalPaths(cached.items);
        } else {
          console.log('No items in cache, waiting for content.');
          setState('waiting');
        }
      }
    } catch (err) {
      console.error('syncPlaylist error:', err);
      setState('waiting');
    }
  }

  async function downloadAllMedia(mediaItems: MediaItem[]) {
    console.log('Starting media downloads for', mediaItems.length, 'items');
    const paths: Record<string, string> = {};

    try {
      for (const item of mediaItems) {
        // Derive filename if missing
        if (!item.filename && item.url) {
          item.filename = item.url.split('/').pop() || `item-${item.id}`;
          console.log('Derived filename:', item.filename);
        }

        if (!item.filename || !item.url) {
          console.warn('Skipping item with missing URL or filename:', item);
          continue;
        }

        console.log('Downloading:', item.filename, 'from', item.url);
        const result = await window.screenflow.player.downloadMedia({
          url: item.url,
          filename: item.filename,
        });
        
        if (result.success) {
          paths[item.filename] = `media://app/${item.filename}`;
        } else {
          console.warn('Failed to download:', item.filename, result.error);
          // Fallback to URL if download fails but we might be online
          paths[item.filename] = item.url;
        }
      }

      console.log('All downloads finished. Paths mapping ready.');
      setLocalPaths(paths);
      setItems(mediaItems);
      setCurrentIndex(0);
      setState('playing');
    } catch (err) {
      console.error('downloadAllMedia error:', err);
      if (mediaItems.length > 0) {
        setItems(mediaItems);
        setState('playing');
      } else {
        setState('waiting');
      }
    }
  }

  async function loadLocalPaths(mediaItems: MediaItem[]) {
    const paths: Record<string, string> = {};
    for (const item of mediaItems) {
      const exists = await window.screenflow.player.getMediaPath(item.filename);
      if (exists) paths[item.filename] = `media://app/${item.filename}`;
    }
    setLocalPaths(paths);
    setItems(mediaItems);
    setCurrentIndex(0);
    setState('playing');
  }

  // Advance to next item after duration
  useEffect(() => {
    if (state !== 'playing' || items.length === 0) return;
    const current = items[currentIndex];
    const duration = (current.duration || 10) * 1000;

    playTimerRef.current = setTimeout(() => {
      setCurrentIndex((prev: number) => (prev + 1) % items.length);
    }, duration);

    return () => { if (playTimerRef.current) clearTimeout(playTimerRef.current); };
  }, [currentIndex, state, items]);

  // Keyboard shortcut: Ctrl+Shift+Q to quit, Ctrl+Shift+S to re-setup
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        window.screenflow.app.quit();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        window.screenflow.config.reset().then(() => window.location.reload());
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Loading state
  if (state === 'loading') {
    return (
      <div style={fullscreenStyle('#0a0a0f')}>
        <div style={{ color: '#7c3aed', fontSize: 28, fontWeight: 700 }}>ScreenFlow</div>
        <div style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Loading content...</div>
      </div>
    );
  }

  // Waiting for content state
  if (state === 'waiting') {
    return (
      <div style={fullscreenStyle('#0a0a0f')}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>📺</div>
        <div style={{ color: '#7c3aed', fontSize: 32, fontWeight: 700 }}>ScreenFlow</div>
        <div style={{ color: '#555', fontSize: 16, marginTop: 12 }}>
          Waiting for content...
        </div>
        <div style={{ color: '#333', fontSize: 12, marginTop: 8 }}>
          Assign a playlist to this screen from the dashboard
        </div>
        {!isOnline && (
          <div style={{
            position: 'absolute', bottom: 20, right: 20,
            color: '#ef4444', fontSize: 11,
          }}>
            ● OFFLINE
          </div>
        )}
      </div>
    );
  }

  // Playing state
  const currentItem = items[currentIndex];
  const src = localPaths[currentItem?.filename] || currentItem?.url;

  return (
    <div style={fullscreenStyle('#000')}>
      {currentItem?.file_type === 'video' ? (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onEnded={() => setCurrentIndex((prev: number) => (prev + 1) % items.length)}
          onError={(e) => console.error('Video load failed:', src, e)}
        />
      ) : (
        <img
          key={src}
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          alt=""
          onError={(e) => console.error('Image load failed:', src, e)}
        />
      )}

      {/* Offline indicator — subtle, bottom right */}
      {!isOnline && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          color: 'rgba(239,68,68,0.6)', fontSize: 10,
          fontFamily: 'monospace',
        }}>
          ● OFFLINE
        </div>
      )}
    </div>
  );
}

function fullscreenStyle(bg: string): React.CSSProperties {
  return {
    width: '100vw', height: '100vh',
    background: bg,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Inter, sans-serif', color: '#fff',
    position: 'relative', overflow: 'hidden',
  };
}
