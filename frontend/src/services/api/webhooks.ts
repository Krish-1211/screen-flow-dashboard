import api from '@/lib/axios';

export interface Webhook {
    id: number;
    url: string;
    secret?: string;
    events: string[];
    enabled: boolean;
    created_at: string;
}

export const webhooksApi = {
    getAll: async (): Promise<Webhook[]> => {
        const response = await api.get('/webhooks/');
        return response.data;
    },
    create: async (payload: Partial<Webhook>): Promise<Webhook> => {
        const response = await api.post('/webhooks/', payload);
        return response.data;
    },
    update: async (id: number, payload: Partial<Webhook>): Promise<Webhook> => {
        const response = await api.put(`/webhooks/${id}`, payload);
        return response.data;
    },
    delete: async (id: number): Promise<void> => {
        await api.delete(`/webhooks/${id}`);
    }
};
