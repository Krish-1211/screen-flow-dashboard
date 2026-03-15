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
    create: async (payload: Partial<Screen>): Promise<Screen> => {
        // Backend register now reads from cookie or generates UUID
        const response = await api.post('/screens/register', {
            name: payload.name
        }, { withCredentials: true });
        const s = response.data;
        return {
            id: s.screen_id,
            name: payload.name || 'New Screen',
            status: 'online',
            playlistId: s.playlist,
            lastPing: new Date().toISOString(),
            device_id: '' // Will be handled by cookie locally
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
    heartbeat: async (): Promise<void> => {
        // device_id is now read from cookie on backend
        await api.post('/screens/heartbeat', {}, { withCredentials: true });
    },
    register: async (name?: string): Promise<{ screen_id: number, playlist: number }> => {
        const response = await api.post('/screens/register', { name }, { withCredentials: true });
        return response.data;
    },
    bulkUpdate: async (screen_ids: number[], playlist_id: number): Promise<{ updated: number, playlist_id: number }> => {
        const response = await api.put('/screens/bulk', { screen_ids, playlist_id });
        return response.data;
    }
};
