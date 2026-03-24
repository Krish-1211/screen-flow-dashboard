import type { Playlist } from '@/types';

export interface PersistedPlaylist {
  playlist: Playlist;
  version: string;
  timestamp: number;
}

const STORAGE_KEY = 'sf_player_state';

export const playlistStore = {
  get: (): PersistedPlaylist | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  save: (playlist: Playlist) => {
    const state: PersistedPlaylist = {
      playlist,
      version: playlist.updatedAt || new Date().toISOString(),
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
