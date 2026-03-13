export interface User {
    id: string;
    name: string;
    email: string;
}

export interface Screen {
    id: string;
    name: string;
    status: 'online' | 'offline';
    playlistId?: string;
    lastPing?: string;
}

export interface Media {
    id: string;
    name: string;
    type: 'image' | 'video';
    url: string;
    duration?: number;
    thumbnail?: string;
}

export interface PlaylistItem {
    id: string;
    mediaId: string;
    media?: Media;
    duration: number; // in seconds
    order: number;
}

export interface Playlist {
    id: string;
    name: string;
    items: PlaylistItem[];
}
