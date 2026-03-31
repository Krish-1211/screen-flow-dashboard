export interface Media {
  id: number | string;
  name: string;
  type: 'image' | 'video' | 'youtube' | 'system_gap';
  url: string;
  duration?: number;
  thumbnail?: string;
}

export interface PlaylistItem {
  id: number | string;
  mediaId: number | string;
  media?: Media;
  duration: number;
  order: number;
}

export interface Playlist {
  id: number | string;
  name: string;
  items: PlaylistItem[];
  updatedAt?: string;
  version?: string;
}
export interface Schedule {
  id: string;
  playlistId: string;
  startTime: string; // HH:mm:ss
  endTime: string;   // HH:mm:ss
  days: number[];    // 0=Mon... 6=Sun
}

export interface PlayerContext {
  screen: {
    id: string;
    name: string;
    defaultPlaylistId: string;
  };
  playlists: Playlist[];
  schedules: Schedule[];
}
