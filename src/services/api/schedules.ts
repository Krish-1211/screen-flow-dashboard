import api from '@/lib/axios';

export interface Schedule {
    id: number;
    screen_id: number;
    playlist_id: number;
    name?: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    active: boolean;
    created_at: string;
}

export const schedulesApi = {
    getAll: async (screenId?: number): Promise<Schedule[]> => {
        const url = screenId ? `/schedules/?screen_id=${screenId}` : '/schedules/';
        const response = await api.get(url);
        return response.data;
    },
    create: async (payload: Partial<Schedule>): Promise<Schedule> => {
        const response = await api.post('/schedules/', payload);
        return response.data;
    },
    update: async (id: number, payload: Partial<Schedule>): Promise<Schedule> => {
        const response = await api.put(`/schedules/${id}`, payload);
        return response.data;
    },
    delete: async (id: number): Promise<void> => {
        await api.delete(`/schedules/${id}`);
    }
};
