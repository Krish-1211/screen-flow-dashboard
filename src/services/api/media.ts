import type { Media } from '@/types';
import api from '@/lib/axios';

export const mediaApi = {
    getAll: async (): Promise<Media[]> => {
        const response = await api.get('/media/');
        return response.data as Media[];
    },
    getById: async (id: string): Promise<Media> => {
        const response = await api.get(`/media/${id}`);
        return response.data as Media;
    },
    upload: async (file: File, name?: string): Promise<Media> => {
        const formData = new FormData();
        formData.append('file', file);
        if (name) formData.append('name', name);
        const response = await api.post('/media/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data as Media;
    },
    addYoutube: async (url: string, name?: string): Promise<Media> => {
        const response = await api.post('/media/youtube', { url, name });
        return response.data as Media;
    },
    update: async (id: string, name: string): Promise<Media> => {
        const response = await api.patch(`/media/${id}`, { name });
        return response.data as Media;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/media/${id}`);
    },
};
