import type { Screen, Space } from '@/types';
import api from '@/lib/axios';

export const screensApi = {
    getAll: async (spaceId?: string): Promise<Screen[]> => {
        let url = '/screens/';
        if (spaceId) url += `?node_id=${spaceId === 'root' ? 'root' : spaceId}`;
        
        const response = await api.get(url);
        return response.data.map((s: any) => ({
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id,
            spaceId: s.nodeId
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
            device_id: s.device_id,
            spaceId: s.nodeId
        } as Screen;
    },
    create: async (payload: { name: string, playlist_id?: string | number, spaceId?: string }): Promise<Screen> => {
        const fullPayload = {
            name: payload.name,
            playlist_id: payload.playlist_id,
            node_id: payload.spaceId,
            device_id: crypto.randomUUID()
        };
        const response = await api.post('/screens', fullPayload);
        const s = response.data;
        return {
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id,
            spaceId: s.nodeId
        } as Screen;
    },
    register: async (payload: { deviceId: string, name: string, playlist_id?: string | number }): Promise<Screen> => {
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
        if (payload.spaceId !== undefined) updatePayload.node_id = payload.spaceId;

        const response = await api.put(`/screens/${id}`, updatePayload);
        const s = response.data;
        return {
            id: String(s.id),
            name: s.name,
            status: s.status,
            playlistId: s.playlistId,
            lastPing: s.lastPing,
            device_id: s.device_id,
            spaceId: s.nodeId
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
    },

    // ── Hierarchical Spaces API ──
    getSpaces: async (parent_id?: string): Promise<Space[]> => {
        const response = await api.get(`/nodes?parent_id=${parent_id || 'root'}`);
        return response.data;
    },
    createSpace: async (name: string, parent_id?: string): Promise<Space> => {
        const response = await api.post('/nodes', { name, parent_id });
        return response.data;
    },
    updateSpace: async (id: string, updates: { name?: string, parent_id?: string }): Promise<Space> => {
        const response = await api.put(`/nodes/${id}`, updates);
        return response.data;
    },
    deleteSpace: async (id: string): Promise<void> => {
        await api.delete(`/nodes/${id}`);
    },
    getSpacePath: async (id: string): Promise<Space[]> => {
        const response = await api.get(`/nodes/path/${id}`);
        return response.data;
    }
};
