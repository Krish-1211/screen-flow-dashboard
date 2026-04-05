const { contextBridge, ipcRenderer } = require('electron');

// Stable Bridge: Minimal exposure as per user's "Don't Improve" rule
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  on: (channel, callback) => ipcRenderer.on(channel, callback),
  send: (channel, data) => ipcRenderer.send(channel, data),
});
