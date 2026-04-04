export interface User {
    id: string;
    name: string;
    email: string;
}

export interface Space {
    id: string;
    name: string;
    parent_id?: string;
    screenCount?: number;
    subspaceCount?: number;
}

export interface Screen {
    id: number | string;
    name: string;
    status: 'online' | 'offline' | string;
    playlistId?: number | string;
    playlist_id?: number | string;
    defaultPlaylistId?: string | number | null;
    lastPing?: string;
    device_id?: string;
    spaceId?: string;
}

export interface Media {
    id: number | string;
    name: string;
    type: 'image' | 'video' | 'youtube' | 'system_gap';
    url: string;
    duration?: number;
    thumbnail?: string;
    parent_id?: string | null;
    node_type: 'file' | 'folder';
    children?: Media[];
}

export interface PlaylistItem {
    id: number | string;
    mediaId: number | string;
    media?: Media;
    duration: number; // in seconds
    order: number;
    is_system?: boolean; // 👈 Runtime injected items
}

export interface Playlist {
    id: number | string;
    name: string;
    items?: PlaylistItem[];
    parent_id?: string | null;
    node_type: 'playlist' | 'folder';
    children?: Playlist[];
    updatedAt?: string;
    version?: string;
}
export interface Schedule {
  id: string | number;
  name: string;
  screenId?: string | number;
  screen_id?: string | number;
  playlistId?: string | number;
  playlist_id?: string | number;
  startTime: string;
  endTime: string;
  days: number[];
  active: boolean;
}

export interface PlayerContext {
  screen: Screen & { defaultPlaylistId: string | null };
  playlists: Playlist[];
  schedules: Schedule[];
}
