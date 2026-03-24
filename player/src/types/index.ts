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
