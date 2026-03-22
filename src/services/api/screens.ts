import type { Screen } from '@/types';
import api from '@/lib/axios';

export const screensApi = {
    getAll: async (): Promise<Screen[]> => {
        const response = await api.get('/screens/');
        return response.data.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id,
            groupId: s.groupId,
            group_name: s.group_name
        })) as Screen[];
    },
    getById: async (id: string | number): Promise<Screen> => {
        const response = await api.get(`/screens/${id}`);
        const s = response.data;
        return {
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id
        } as Screen;
    },
    create: async (payload: { name: string, playlist_id?: number }): Promise<Screen> => {
        const response = await api.post('/screens/register', payload);
        const s = response.data;
        return {
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id
        } as Screen;
    },
    update: async (id: string | number, payload: Partial<Screen>): Promise<Screen> => {
        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.playlistId !== undefined) updatePayload.playlist_id = payload.playlistId;
        if (payload.groupId !== undefined) updatePayload.groupId = payload.groupId;

        const response = await api.put(`/screens/${id}`, updatePayload);
        const s = response.data;
        return {
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id
        } as Screen;
    },
    delete: async (id: string | number): Promise<void> => {
        await api.delete(`/screens/${id}`);
    },
    heartbeat: async (device_id: string): Promise<void> => {
        await api.post('/screens/heartbeat', { device_id });
    },
    getPlayerConfig: async (device_id: string, local_time?: string, local_day?: number): Promise<any> => {
        let url = `/screens/player?device_id=${device_id}`;
        if (local_time) url += `&local_time=${local_time}`;
        if (local_day !== undefined) url += `&local_day=${local_day}`;
        const response = await api.get(url);
        return response.data;
    },
    bulkUpdate: async (screen_ids: (string | number)[], playlist_id: string | number): Promise<{ updated: number, playlist_id: string }> => {
        const response = await api.put('/screens/bulk', { screen_ids, playlist_id });
        return response.data;
    }
};
