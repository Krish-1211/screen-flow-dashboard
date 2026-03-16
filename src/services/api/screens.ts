import type { Screen } from '@/types';
import api from '@/lib/axios';

export const screensApi = {
    getAll: async (): Promise<Screen[]> => {
        const response = await api.get('/screens/');
        return response.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.last_seen,
            device_id: s.device_id
        })) as Screen[];
    },
    getById: async (id: string | number): Promise<Screen> => {
        const response = await api.get(`/screens/${id}`);
        const s = response.data;
        return {
            id: s.id,
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.last_seen,
            device_id: s.device_id
        } as Screen;
    },
    create: async (payload: { name: string, playlist_id?: number }): Promise<Screen> => {
        const response = await api.post('/screens/register', payload);
        const s = response.data;
        return {
            id: s.id,
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.last_seen,
            device_id: s.device_id
        } as Screen;
    },
    update: async (id: string | number, payload: Partial<Screen>): Promise<Screen> => {
        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.playlistId !== undefined) updatePayload.current_playlist_id = payload.playlistId;

        const response = await api.put(`/screens/${id}`, updatePayload);
        const s = response.data;
        return {
            id: s.id,
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.last_seen,
            device_id: s.device_id
        } as Screen;
    },
    delete: async (id: string | number): Promise<void> => {
        await api.delete(`/screens/${id}`);
    },
    heartbeat: async (device_id: string): Promise<void> => {
        await api.post('/screens/heartbeat', { device_id });
    },
    getPlayerConfig: async (device_id: string): Promise<any> => {
        const response = await api.get(`/screens/player?device_id=${device_id}`);
        return response.data;
    },
    bulkUpdate: async (screen_ids: number[], playlist_id: number): Promise<{ updated: number, playlist_id: number }> => {
        const response = await api.put('/screens/bulk', { screen_ids, playlist_id });
        return response.data;
    }
};
