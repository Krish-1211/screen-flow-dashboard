import { supabase } from '@/lib/supabase';
import { authApi } from './auth';

export interface Schedule {
    id: string;
    screenId: string;
    playlistId: string;
    day: string;
    startHour: number;
    endHour: number;
    created_at?: string;
}

export const schedulesApi = {
    getAll: async (): Promise<Schedule[]> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const identifier = user.email || user.id;
        if (!identifier) return [];

        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('owner', identifier)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(s => ({
            ...s,
            screenId: s.screen_id,
            playlistId: s.playlist_id,
            startHour: s.start_hour,
            endHour: s.end_hour
        })) as Schedule[];
    },
    create: async (payload: Partial<Schedule>): Promise<Schedule> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const identifier = user.email || user.id;
        const dbPayload = {
            screen_id: payload.screenId,
            playlist_id: payload.playlistId,
            day: payload.day,
            start_hour: payload.startHour,
            end_hour: payload.endHour,
            owner: identifier
        };
        const { data, error } = await supabase
            .from('schedules')
            .insert([dbPayload])
            .select()
            .single();
        if (error) throw error;
        return data as Schedule;
    },
    delete: async (id: string): Promise<void> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const identifier = user.email || user.id;
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id)
            .eq('owner', identifier);
        if (error) throw error;
    }
};
