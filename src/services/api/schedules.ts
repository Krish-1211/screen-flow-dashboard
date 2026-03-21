import api from '@/lib/axios';

export interface Schedule {
    id: string;
    screen_id: string;
    playlist_id: string;
    name?: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
    active: boolean;
    created_at: string;
}

export const schedulesApi = {
    getAll: async (screenId?: string): Promise<Schedule[]> => {
        const url = screenId ? `/schedules/?screen_id=${screenId}` : '/schedules/';
        const response = await api.get(url);
        return response.data;
    },
    create: async (payload: Partial<Schedule>): Promise<Schedule> => {
        const response = await api.post('/schedules/', payload);
        return response.data;
    },
    update: async (id: string, payload: Partial<Schedule>): Promise<Schedule> => {
        const response = await api.put(`/schedules/${id}`, payload);
        return response.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/schedules/${id}`);
    }
};
