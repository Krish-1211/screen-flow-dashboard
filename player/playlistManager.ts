import axios from 'axios';

export interface PlaylistItem {
  id: number;
  media_id: number;
  duration: number | null;
  position: number;
  media: {
    id: number;
    name: string;
    type: 'video' | 'image';
    url: string;
  };
}

export interface Playlist {
  id: number;
  name: string;
  items: PlaylistItem[];
}

export class PlaylistManager {
  private playlist: Playlist | null = null;
  private currentIndex: number = -1;

  async fetchPlaylist(screenId: number, serverUrl: string): Promise<Playlist> {
    const response = await axios.get(`${serverUrl}/screens/${screenId}/playlist`, { timeout: 10000 });
    this.playlist = response.data;
    this.currentIndex = -1; // Reset when new playlist fetched
    return this.playlist!;
  }

  setPlaylist(playlist: Playlist) {
    this.playlist = playlist;
    this.currentIndex = -1;
  }

  getCurrentPlaylist(): Playlist | null {
    return this.playlist;
  }

  getNextItem(): PlaylistItem | null {
    if (!this.playlist || this.playlist.items.length === 0) return null;
    this.currentIndex = (this.currentIndex + 1) % this.playlist.items.length;
    return this.playlist.items[this.currentIndex];
  }

  getPlaylistItems(): PlaylistItem[] {
    return this.playlist?.items || [];
  }
}
