import { PlaylistItem } from './playlistManager';
import { CacheManager } from './cacheManager';

export class PlayerEngine {
  private cacheManager: CacheManager;
  private isRunning: boolean = false;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  async start(getNextItem: () => PlaylistItem | null) {
    this.isRunning = true;
    console.log('Playback engine started');

    while (this.isRunning) {
      const item = getNextItem();
      if (!item) {
        // console.log('No item to play, waiting...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      await this.playItem(item);
    }
  }

  stop() {
    this.isRunning = false;
  }

  private async playItem(item: PlaylistItem) {
    const localPath = this.cacheManager.getLocalPath(item.media.url);
    const mediaType = item.media.type;

    console.log(`[PLAYING] ${mediaType.toUpperCase()}: ${item.media.name} (${localPath})`);

    if (mediaType === 'image') {
      const duration = (item.duration || 5) * 1000;
      await new Promise(r => setTimeout(r, duration));
    } else if (mediaType === 'video') {
      // In a real player, we'd wait for the video to end.
      // Since we are in a headless engine for now, we'll use a placeholder duration
      // or if the backend provided one, we'll use that.
      // If none, let's assume 10s for demo purposes or wait for process (if implemented).
      const duration = (item.duration || 10) * 1000;
      await new Promise(r => setTimeout(r, duration));
    }

    console.log(`[FINISHED] ${item.media.name}`);
  }
}
