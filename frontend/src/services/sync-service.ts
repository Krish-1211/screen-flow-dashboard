/**
 * SyncService - Polling Implementation
 * 
 * This service uses HTTP polling as a replacement for 
 * live updates.
 */

class SyncService {
    private listeners: Record<string, Function[]> = {};
    private interval: NodeJS.Timeout | null = null;
    private pollIntervalMs: number = 30000; // 30 seconds

    connect() {
        if (this.interval) return;
        
        // Start polling loop
        this.interval = setInterval(() => {
            this.poll();
        }, this.pollIntervalMs);
    }

    disconnect() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribeToScreen(_screenId: string) {
        // No-op
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

    private poll() {
        // Emit events to trigger query invalidation
        this.emit('screen-refresh');
        this.emit('playlist-updated');
        this.emit('schedule-updated');
    }

    private emit(event: string, data?: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const syncService = new SyncService();
