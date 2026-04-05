/// <reference types="vite/client" />

export interface AppConfig {
  deviceId: string;
  apiBaseUrl: string;
  heartbeatInterval: number;
}

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'https://screen-api-6sac.onrender.com';

export const playerConfig = {
  getDeviceId: (): string => {
    const isValidDeviceId = (id: string | null): id is string => {
      return !!id && id !== "null" && id !== "undefined" && id.trim() !== "";
    };

    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('device_id');
    if (isValidDeviceId(urlId)) {
      localStorage.setItem('sf_device_id', urlId);
      return urlId;
    }

    const stored = localStorage.getItem('sf_device_id');
    if (isValidDeviceId(stored)) return stored;

    const newId = crypto.randomUUID();
    localStorage.setItem('sf_device_id', newId);
    return newId;
  },

  getApiUrl: (): string => {
    const stored = localStorage.getItem('sf_api_url');
    if (stored && stored.startsWith('http')) return stored.replace(/\/$/, '');
    return DEFAULT_API_URL.replace(/\/$/, '');
  },

  setApiUrl: (url: string) => {
    if (url.startsWith('http')) {
      localStorage.setItem('sf_api_url', url.replace(/\/$/, ''));
    }
  },

  getHeartbeatInterval: (): number => {
    return 30000;
  }
};
