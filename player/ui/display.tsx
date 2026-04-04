import React, { useState, useEffect, useRef } from "react";
import { PlayerEngine } from "../core/playerEngine";
import { SyncManager, type SyncStatus } from "../sync/syncManager";
import { PlayerState, PlayerStateMachine } from "../core/stateMachine";
import type { PlaylistItem, PlayerContext } from "@/types";
import { mediaCache } from "../storage/mediaCache";

interface PlayerProps {
  deviceId: string;
  apiBaseUrl: string;
}

export const PlayerDisplay: React.FC<PlayerProps> = ({ deviceId, apiBaseUrl }) => {
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const [itemA, setItemA] = useState<{ item: PlaylistItem | null, url: string }>({ item: null, url: '' });
  const [itemB, setItemB] = useState<{ item: PlaylistItem | null, url: string }>({ item: null, url: '' });

  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [state, setState] = useState<PlayerState>(PlayerState.IDLE);
  const [currentTime, setCurrentTime] = useState(new Date());

  const engineRef = useRef<PlayerEngine | null>(null);
  const loopLockRef = useRef(false);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);

  // 🧠 Mirror Refs to solve stale closures in async callbacks
  const activeLayerRef = useRef(activeLayer);
  const itemARef = useRef(itemA);
  const itemBRef = useRef(itemB);
  const playlistItemsRef = useRef(playlistItems);

  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
  useEffect(() => { itemARef.current = itemA; }, [itemA]);
  useEffect(() => { itemBRef.current = itemB; }, [itemB]);
  useEffect(() => { playlistItemsRef.current = playlistItems; }, [playlistItems]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const playVideoSafe = async (video: HTMLVideoElement | null) => {
    if (!video) return;
    try {
      video.pause();
      video.currentTime = 0;
      video.load();
      await video.play().catch(() => {
        video.muted = true;
        return video.play();
      });
    } catch (e) {
      console.error("[player] video restart error", e);
    }
  };

  useEffect(() => {
    const engine = new PlayerEngine(async (item) => {

      // 🔒 BLOCK ENGINE DURING LOOP
      if (loopLockRef.current) {
        console.log("[player] BLOCKED engine update (loop)");
        return;
      }

      let url = "";
      if (item.media?.type !== "system_gap") {
        url = await mediaCache.getMediaSource(item.media?.url || "");
      } else {
        url = "/black-screen.png";
      }

      const currentItem = (activeLayerRef.current === 'A' ? itemARef.current : itemBRef.current).item;

      // 🧠 HARD LOOP DETECTION (USING REFS)
      if (currentItem?.id === item.id) {
        console.log("[player] HARD LOOP (Ref-tracked) → restart video");

        const video = activeLayerRef.current === 'A' ? videoRefA.current : videoRefB.current;
        if (item.media?.type === "video" && video) {
          void playVideoSafe(video);
        }

        return; // ❌ NO state update
      }

      setPlaylistItems(engine.getPlaylistItems());

      setActiveLayer((curr) => {
        const next = curr === 'A' ? 'B' : 'A';

        if (next === 'A') setItemA({ item, url });
        else setItemB({ item, url });

        return next;
      });

    });

    (window as any).engine = engine;

    const sync = new SyncManager(
      deviceId,
      apiBaseUrl,
      (context: PlayerContext) => {
        engine.updateContext(context);
      },
      () => {},
      () => {}
    );

    engineRef.current = engine;
    engine.startPlayback();
    sync.startSyncLoop();

    return () => {
      engine.stopPlaybackLoop();
      sync.stop();
    };

  }, [deviceId, apiBaseUrl]);

  const handleVideoEnded = () => {
    const engine = engineRef.current;
    if (!engine) return;

    const currentPlaylist = playlistItemsRef.current;

    // 🔥 SINGLE VIDEO LOOP FIX (FINAL - USING REFS)
    if (currentPlaylist.length === 1) {
      const lockedLayer = activeLayerRef.current;
      const originalItem = currentPlaylist[0];
      const originalUrl = (lockedLayer === 'A' ? itemARef.current : itemBRef.current).url;

      loopLockRef.current = true;

      const blackItem: PlaylistItem = {
        id: "black",
        mediaId: "black",
        order: 0,
        duration: 1000,
        media: {
          id: "black",
          name: "black",
          type: "image",
          url: "/black-screen.png"
        }
      };

      if (lockedLayer === 'A') {
        setItemA({ item: blackItem, url: "/black-screen.png" });
      } else {
        setItemB({ item: blackItem, url: "/black-screen.png" });
      }

      setTimeout(() => {
        if (lockedLayer === 'A') {
          setItemA({ item: originalItem, url: originalUrl });
        } else {
          setItemB({ item: originalItem, url: originalUrl });
        }

        loopLockRef.current = false;
      }, 1000);

      return;
    }

    engine.onMediaEnded();
  };

  const renderLayer = (layer: 'A' | 'B') => {
    const data = layer === 'A' ? itemA : itemB;
    if (!data.item) return null;

    const isVideo = data.item.media?.type === "video";
    const isGap = data.item.media?.type === "system_gap";
    const visible = activeLayer === layer;

    return (
      <div
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s"
        }}
        className="absolute inset-0"
      >
        {isGap ? (
          <div className="w-full h-full bg-black flex items-center justify-center text-white text-6xl">
            {currentTime.toLocaleTimeString()}
          </div>
        ) : isVideo ? (
          <video
            key={`${layer}-${data.url}-${data.item.id}`}
            ref={layer === 'A' ? videoRefA : videoRefB}
            src={data.url}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            onEnded={visible ? handleVideoEnded : undefined}
          />
        ) : (
          <img
            src={data.url}
            className="w-full h-full object-contain"
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black">
      {renderLayer('A')}
      {renderLayer('B')}
    </div>
  );
};