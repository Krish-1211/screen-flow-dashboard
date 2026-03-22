export interface User {
    id: string;
    name: string;
    email: string;
}

export interface Group {
    id: string;
    name: string;
    screen_count: number;
}

export interface Screen {
    id: number | string;
    name: string;
    status: 'online' | 'offline';
    playlistId?: number;
    lastPing?: string;
    device_id?: string;
    groupId?: string;
    group_name?: string;
}

export interface Media {
    id: number | string;
    name: string;
    type: 'image' | 'video' | 'youtube';
    url: string;
    duration?: number;
    thumbnail?: string;
}

export interface PlaylistItem {
    id: number | string;
    mediaId: number | string;
    media?: Media;
    duration: number; // in seconds
    order: number;
}

export interface Playlist {
    id: number | string;
    name: string;
    items: PlaylistItem[];
}
