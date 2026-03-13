import type { Media } from '@/types';
import { supabase } from '@/lib/supabase';
import { authApi } from './auth';

export const mediaApi = {
    getAll: async (): Promise<Media[]> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from('media')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []) as Media[];
    },
    getById: async (id: string): Promise<Media> => {
        const { data, error } = await supabase
            .from('media')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data as Media;
    },
    upload: async (file: File): Promise<Media> => {
        const user = await authApi.me();
        if (!user) throw new Error("Not authenticated");

        // 1. Upload file to Storage Bucket
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user.email || 'shared'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);

        // 3. Create database record
        const { data, error: dbError } = await supabase
            .from('media')
            .insert([{
                name: file.name,
                type: file.type.startsWith('video') ? 'video' : 'image',
                url: publicUrl,
                duration: 10
            }])
            .select()
            .single();

        if (dbError) throw dbError;
        return data as Media;
    },
    delete: async (id: string): Promise<void> => {
        const user = await authApi.me();
        // 1. Get media info to find storage path
        const { data: media, error: fetchError } = await supabase
            .from('media')
            .select('url')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;

        // 2. Extract path from URL (simplified fallback)
        const filename = media.url.split('/').pop();
        const path = `${user.email || 'shared'}/${filename}`;
        
        if (filename) {
            await supabase.storage.from('media').remove([path]);
        }

        // 3. Delete database record
        const { error: dbError } = await supabase
            .from('media')
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;
    },
};
