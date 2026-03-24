export const versionManager = {
  get: (): string => {
    return localStorage.getItem('sf_player_version') || '0';
  },

  set: (version: string) => {
    localStorage.setItem('sf_player_version', version);
  },

  isUpToDate: (serverVersion: string): boolean => {
    return versionManager.get() === serverVersion;
  },

  getETag: (): string => {
    return localStorage.getItem('sf_player_etag') || '';
  },

  setETag: (etag: string) => {
    localStorage.setItem('sf_player_etag', etag);
  }
};
