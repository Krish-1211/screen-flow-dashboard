import { useEffect, useState } from 'react';
import Setup from './pages/Setup';
import Player from './pages/Player';

declare global {
  interface Window {
    screenflow: {
      config: {
        get: () => Promise<{ serverUrl: string; deviceId: string; configured: boolean }>;
        set: (data: { serverUrl: string; deviceId: string }) => Promise<boolean>;
        reset: () => Promise<boolean>;
        getLaunchArgs: () => Promise<{ displayIndex: number; deviceId: string | null; serverUrl: string | null }>;
      };
      player: {
        fetchPlaylist: (data: { serverUrl: string; deviceId: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
        downloadMedia: (data: { url: string; filename: string }) => Promise<{ success: boolean; localPath: string; error?: string }>;
        getMediaPath: (filename: string) => Promise<string | null>;
        heartbeat: (data: { serverUrl: string; deviceId: string }) => Promise<{ success: boolean }>;
        getCachedPlaylist: () => Promise<any>;
        cachePlaylist: (playlist: any) => Promise<boolean>;
      };
      app: {
        quit: () => Promise<void>;
      };
    };
  }
}

export default function App() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    window.screenflow.config.getLaunchArgs().then(async (args) => {
      if (args.deviceId && args.serverUrl) {
        // Auto-configure from launch args, no setup needed
        await window.screenflow.config.set({
          serverUrl: args.serverUrl,
          deviceId: args.deviceId,
        });
        setConfigured(true);
      } else {
        const config = await window.screenflow.config.get();
        setConfigured(config.configured);
      }
    });
  }, []);

  if (configured === null) return null; // Loading

  if (!configured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  return <Player />;
}
