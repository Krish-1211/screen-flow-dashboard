import type { User } from '@/types';
import { supabase } from '@/lib/supabase';

export const authApi = {
    login: async (credentials: { email: string; password: string }): Promise<User> => {
        // Hardcoded Accounts for local/demo use
        const hardcodedUsers: Record<string, { pass: string, name: string }> = {
            'admin': { pass: '1234', name: 'Administrator' },
            'client': { pass: 'client123', name: 'Client Manager' }
        };

        const found = hardcodedUsers[credentials.email];
        if (found && found.pass === credentials.password) {
            localStorage.setItem('sb-dummy-auth', 'true');
            return {
                id: `dummy-${credentials.email}`,
                name: found.name,
                email: credentials.email,
            } as User;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });
        
        if (error) throw error;
        
        return {
            id: data.user.id,
            name: data.user.email?.split('@')[0] || 'User',
            email: data.user.email || data.user.id, // Absolute fallback
        } as User;
    },
    me: async (): Promise<User | null> => {
        if (localStorage.getItem('sb-dummy-auth') === 'true') {
            return { id: 'admin-id', name: 'Administrator', email: 'admin' } as User;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        console.log("Auth Check - User ID:", user.id, "Email:", user.email);
        
        return {
            id: user.id,
            name: user.email?.split('@')[0] || 'User',
            email: user.email || user.id, // Absolute fallback
        } as User;
    },
    logout: async () => {
        localStorage.removeItem('sb-dummy-auth');
        await supabase.auth.signOut();
        window.location.href = '/login';
    }
};
