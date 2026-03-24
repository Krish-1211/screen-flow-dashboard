/// <reference types="vite/client" />

export interface AppConfig {
  deviceId: string;
  apiBaseUrl: string;
  heartbeatInterval: number;
}

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const playerConfig = {
  getDeviceId: (): string => {
    const isValidDeviceId = (id: string | null): id is string => {
      return !!id && id !== "null" && id !== "undefined" && id.trim() !== "";
    };

    // Check URL first
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('device_id');
    if (isValidDeviceId(urlId)) {
      localStorage.setItem('sf_device_id', urlId);
      return urlId;
    }

    // Fallback to local storage (persistent device identity)
    const stored = localStorage.getItem('sf_device_id');
    if (isValidDeviceId(stored)) return stored;

    // Generate new one if none exists
    const newId = crypto.randomUUID();
    localStorage.setItem('sf_device_id', newId);
    
    // Force URL correction
    window.history.replaceState({}, "", `/display?device_id=${newId}`);
    
    return newId;
  },

  getApiUrl: (): string => {
    return DEFAULT_API_URL.replace(/\/$/, '');
  },

  getHeartbeatInterval: (): number => {
    return 30000; // 30s
  }
};
