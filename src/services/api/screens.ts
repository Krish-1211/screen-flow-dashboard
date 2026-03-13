import type { Screen } from '@/types';
import { supabase } from '@/lib/supabase';
import { authApi } from './auth';

export const screensApi = {
    getAll: async (): Promise<Screen[]> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from('screens')
            .select('*')
            .eq('owner', user.email)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return (data || []).map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            playlistId: s.playlist_id,
            lastPing: s.last_ping
        })) as Screen[];
    },
    getById: async (id: string): Promise<Screen> => {
        const { data, error } = await supabase
            .from('screens')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        return {
            id: data.id,
            name: data.name,
            status: data.status,
            playlistId: data.playlist_id,
            lastPing: data.last_ping
        } as Screen;
    },
    create: async (payload: Partial<Screen>): Promise<Screen> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from('screens')
            .insert([{
                name: payload.name || 'New Screen',
                status: 'offline',
                owner: user.email
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        return {
            id: data.id,
            name: data.name,
            status: data.status,
            playlistId: data.playlist_id,
            lastPing: data.last_ping
        } as Screen;
    },
    update: async (id: string, payload: Partial<Screen>): Promise<Screen> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.status !== undefined) updatePayload.status = payload.status;
        if (payload.playlistId !== undefined) updatePayload.playlist_id = payload.playlistId;
        if (payload.lastPing !== undefined) updatePayload.last_ping = payload.lastPing;

        const { data, error } = await supabase
            .from('screens')
            .update(updatePayload)
            .eq('id', id)
            .eq('owner', user.email)
            .select()
            .single();
        
        if (error) throw error;
        
        return {
            id: data.id,
            name: data.name,
            status: data.status,
            playlistId: data.playlist_id,
            lastPing: data.last_ping
        } as Screen;
    },
    delete: async (id: string): Promise<void> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('screens')
            .delete()
            .eq('id', id)
            .eq('owner', user.email);
        
        if (error) throw error;
    },
};
