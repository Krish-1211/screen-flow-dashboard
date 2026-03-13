import { supabase } from '@/lib/supabase';

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
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
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
        const dbPayload = {
            screen_id: payload.screenId,
            playlist_id: payload.playlistId,
            day: payload.day,
            start_hour: payload.startHour,
            end_hour: payload.endHour
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
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
