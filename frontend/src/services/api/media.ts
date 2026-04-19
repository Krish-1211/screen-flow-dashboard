import type { Media } from '@/types';
import api from '@/lib/axios';

export const mediaApi = {
    getAll: async (parentId?: string | null, tree?: boolean): Promise<Media[]> => {
        let url = '/media/';
        const params = new URLSearchParams();
        if (parentId) params.append('parent_id', parentId);
        if (tree) params.append('tree', 'true');
        if (params.toString()) url += `?${params.toString()}`;
        const response = await api.get(url);
        return response.data as Media[];
    },
    getById: async (id: string): Promise<Media> => {
        const response = await api.get(`/media/${id}`);
        return response.data as Media;
    },
    upload: async (file: File, parentId: string | null = null, name?: string): Promise<Media> => {
        const formData = new FormData();
        formData.append('file', file);
        if (name) formData.append('name', name);
        formData.append('parent_id', parentId === null ? 'root' : parentId);
        const response = await api.post('/media/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data as Media;
    },
    addYoutube: async (url: string, parentId: string | null = null, name?: string): Promise<Media> => {
        const response = await api.post('/media/youtube', { url, name, parent_id: parentId === null ? 'root' : parentId });
        return response.data as Media;
    },
    createFolder: async (name: string, parentId: string | null = null): Promise<Media> => {
        const response = await api.post('/media/folder', { name, parent_id: parentId === null ? 'root' : parentId });
        return response.data as Media;
    },
    update: async (id: string | number, payload: Partial<Media>): Promise<Media> => {
        // Ensure folderId/parent_id is explicitly handled if present in payload
        const updatedPayload = { ...payload };
        if (updatedPayload.parent_id === null) {
            updatedPayload.parent_id = 'root';
        }
        const response = await api.put(`/media/${id}`, updatedPayload);
        return response.data as Media;
    },
    delete: async (id: string | number): Promise<void> => {
        await api.delete(`/media/${id}`);
    },
    paste: async (mediaId: string | number, targetFolderId: string | null, type: 'copy' | 'cut'): Promise<any> => {
        const response = await api.post('/media/paste', { 
            mediaId: String(mediaId), 
            targetFolderId: targetFolderId === null ? 'root' : String(targetFolderId), 
            type 
        });
        return response.data;
    }
};
