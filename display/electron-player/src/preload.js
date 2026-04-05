const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenflow', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (data) => ipcRenderer.invoke('config:set', data),
    reset: () => ipcRenderer.invoke('config:reset'),
    getLaunchArgs: () => ipcRenderer.invoke('config:getLaunchArgs'),
  },
  player: {
    fetchPlaylist: (data) => ipcRenderer.invoke('player:fetchPlaylist', data),
    downloadMedia: (data) => ipcRenderer.invoke('player:downloadMedia', data),
    getMediaPath: (filename) => ipcRenderer.invoke('player:getMediaPath', filename),
    heartbeat: (data) => ipcRenderer.invoke('player:heartbeat', data),
    getCachedPlaylist: () => ipcRenderer.invoke('player:getCachedPlaylist'),
    cachePlaylist: (playlist) => ipcRenderer.invoke('player:cachePlaylist', playlist),
  },
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
  },
});
