import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

class WebSocketService {
    private channel: RealtimeChannel | null = null;
    private listeners: Record<string, Function[]> = {};

    connect() {
        if (this.channel) return;

        // Create a single global channel for screen sync
        this.channel = supabase.channel('screen_flow_global');

        // Listen to postgres changes on screens and playlists
        this.channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, payload => {
                this.emit('screen-refresh', payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, payload => {
                this.emit('playlist-updated', payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, payload => {
                this.emit('schedule-updated', payload);
            })
            .on('broadcast', { event: 'refresh-signal' }, payload => {
                this.emit('screen-refresh', payload);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Connected to Supabase Realtime');
                }
            });
    }

    disconnect() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }

    subscribeToScreen(screenId: string) {
        // Handled globally by postgres triggers
    }

    on(event: string, callback: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event: string, callback?: Function) {
        if (!this.listeners[event]) return;
        if (callback) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        } else {
            this.listeners[event] = [];
        }
    }

    private emit(event: string, data?: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const wsService = new WebSocketService();
