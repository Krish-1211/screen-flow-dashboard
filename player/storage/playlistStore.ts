import type { PlayerContext } from '@/types';

export interface PersistedContext {
  context: PlayerContext;
  timestamp: number;
}

const STORAGE_KEY = 'sf_player_context';

export const contextStore = {
  get: (): PersistedContext | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  save: (context: PlayerContext) => {
    const state: PersistedContext = {
      context,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
