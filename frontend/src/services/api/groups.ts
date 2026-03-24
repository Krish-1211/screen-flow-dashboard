import api from '@/lib/axios';
import type { Group } from '@/types';

export const groupsApi = {
    getAll: async (): Promise<Group[]> => {
        const response = await api.get('/groups');
        return response.data;
    },
    create: async (name: string): Promise<Group> => {
        const response = await api.post('/groups', { name });
        return response.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/groups/${id}`);
    }
};
