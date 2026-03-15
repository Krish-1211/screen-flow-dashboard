import type { Playlist } from '@/types';
import api from '@/lib/axios';

const mapPlaylist = (pl: any): Playlist => ({
    ...pl,
    items: pl.items?.map((item: any) => ({
        id: item.id,
        mediaId: item.media_id,
        media: item.media ? {
            id: item.media.id,
            name: item.media.name,
            type: item.media.type,
            url: item.media.url,
            duration: item.media.duration,
            thumbnail: item.media.thumbnail
        } : undefined,
        duration: item.duration,
        order: item.position
    })) || []
});

export const playlistsApi = {
    getAll: async (): Promise<Playlist[]> => {
        const response = await api.get('/playlists/');
        return (response.data as any[]).map(mapPlaylist);
    },
    getById: async (id: string | number): Promise<Playlist> => {
        const response = await api.get(`/playlists/${id}`);
        return mapPlaylist(response.data);
    },
    create: async (payload: Partial<Playlist>): Promise<Playlist> => {
        const response = await api.post('/playlists/', {
            name: payload.name || 'New Playlist',
            items: payload.items?.map((item, index) => ({
                media_id: Number(item.mediaId),
                duration: item.duration,
                position: item.order ?? index
            })) || []
        });
        return mapPlaylist(response.data);
    },
    update: async (id: string | number, payload: Partial<Playlist>): Promise<Playlist> => {
        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.items !== undefined) {
            updatePayload.items = payload.items.map((item, index) => ({
                media_id: Number(item.mediaId),
                duration: item.duration,
                position: item.order ?? index
            }));
        }

        const response = await api.put(`/playlists/${id}`, updatePayload);
        return mapPlaylist(response.data);
    },
    delete: async (id: string | number): Promise<void> => {
        await api.delete(`/playlists/${id}`);
    },
};
