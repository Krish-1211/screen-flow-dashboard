export const mediaCache = {
  /**
   * Resolves a media URL to its local path if cached, 
   * otherwise returns the original remote URL.
   * This is designed to be replaceable with Android File System bridges later.
   */
  resolve: async (remoteUrl: string): Promise<string> => {
    // For browser environment, we check if it's in the Cache API
    // For Android, this would check the local downloads folder
    if (!remoteUrl) return '';
    
    try {
      if ('caches' in window) {
        const cache = await caches.open('sf-media-cache');
        const match = await cache.match(remoteUrl);
        if (match) {
          return URL.createObjectURL(await match.blob());
        }
      }
    } catch (e) {
      console.warn('Cache resolution failed, falling back to network', e);
    }

    return remoteUrl;
  },

  preload: async (urls: string[]) => {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('sf-media-cache');
      await Promise.allSettled(urls.map(url => cache.add(url)));
    } catch (e) {
      console.warn('Media preloading failed', e);
    }
  },

  hasLocal: async (remoteUrl: string): Promise<boolean> => {
    if (!remoteUrl || !('caches' in window)) return false;
    try {
      const cache = await caches.open('sf-media-cache');
      const match = await cache.match(remoteUrl);
      return Boolean(match);
    } catch {
      return false;
    }
  },

  getMediaSource: async (remoteUrl: string): Promise<string> => {
    if (await mediaCache.hasLocal(remoteUrl)) {
      return mediaCache.resolve(remoteUrl);
    }
    return remoteUrl;
  },

  preloadOne: async (url?: string): Promise<void> => {
    if (!url || !('caches' in window)) return;
    try {
      const cache = await caches.open('sf-media-cache');
      const existing = await cache.match(url);
      if (!existing) await cache.add(url);
    } catch (e) {
      console.warn('Media single preload failed', e);
    }
  }
};
