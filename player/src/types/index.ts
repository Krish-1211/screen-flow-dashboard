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
  is_system?: boolean; // 👈 Runtime injected items
}

export interface Playlist {
  id: number | string;
  name: string;
  items: PlaylistItem[];
  updatedAt?: string;
  version?: string;
}
export interface Schedule {
  id: string | number;
  playlistId?: string | number;
  playlist_id?: string | number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  days: number[];    // 0=Mon... 6=Sun
}

export interface PlayerContext {
  screen: {
    id: string | number;
    name: string;
    defaultPlaylistId?: string | number | null;
    playlist_id?: string | number | null;
  };
  playlists: Playlist[];
  schedules: Schedule[];
}
