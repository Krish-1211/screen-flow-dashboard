import type { Playlist, PlaylistItem, Media } from '@/types';
import { supabase } from '@/lib/supabase';
import { authApi } from './auth';

export const playlistsApi = {
    getAll: async (): Promise<Playlist[]> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { data: playlists, error: plError } = await supabase
            .from('playlists')
            .select('*')
            .eq('owner', user.email)
            .order('created_at', { ascending: false });
        
        if (plError) throw plError;

        const { data: media, error: mError } = await supabase
            .from('media')
            .select('*')
            .eq('owner', user.email);
        
        if (mError) throw mError;

        return (playlists || []).map(pl => ({
            ...pl,
            items: (pl.items || []).map((item: any) => ({
                ...item,
                media: media?.find(m => m.id === item.mediaId) as Media
            }))
        })) as Playlist[];
    },
    getById: async (id: string): Promise<Playlist> => {
        const { data: pl, error: plError } = await supabase
            .from('playlists')
            .select('*')
            .eq('id', id)
            .single();
        
        if (plError) throw plError;

        const { data: media, error: mError } = await supabase
            .from('media')
            .select('*');
        
        if (mError) throw mError;

        return {
            ...pl,
            items: (pl.items || []).map((item: any) => ({
                ...item,
                media: media?.find(m => m.id === item.mediaId) as Media
            }))
        } as Playlist;
    },
    create: async (payload: Partial<Playlist>): Promise<Playlist> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from('playlists')
            .insert([{
                name: payload.name || 'New Playlist',
                items: payload.items || [],
                owner: user.email
            }])
            .select()
            .single();
        
        if (error) throw error;
        return data as Playlist;
    },
    update: async (id: string, payload: Partial<Playlist>): Promise<Playlist> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const updatePayload: any = {};
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.items !== undefined) updatePayload.items = payload.items;

        const { data, error } = await supabase
            .from('playlists')
            .update(updatePayload)
            .eq('id', id)
            .eq('owner', user.email)
            .select()
            .single();
        
        if (error) throw error;
        return data as Playlist;
    },
    delete: async (id: string): Promise<void> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', id)
            .eq('owner', user.email);
        
        if (error) throw error;
    },
};
