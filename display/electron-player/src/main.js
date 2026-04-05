const { app, BrowserWindow, ipcMain, screen, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const Store = require('electron-store');
const fs = require('fs-extra');
const axios = require('axios');
const https = require('https');

// Global axios config to ignore SSL errors (common in local dev/private CAs)
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Command line arguments for multi-display support
const args = process.argv.slice(2);
const displayIndex = parseInt(
  args.find(a => a.startsWith('--display='))?.split('=')[1] ?? '0'
);
const instanceDeviceId = args.find(a => a.startsWith('--device-id='))?.split('=')[1] ?? null;
const instanceServerUrl = args.find(a => a.startsWith('--server='))?.split('=')[1] ?? null;

// Register media protocol as privileged (allows it to be used like a standard protocol)
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, allowServiceWorkers: true } }
]);

const store = new Store();
let MEDIA_DIR;

let mainWindow;

function createWindow() {
  const displays = screen.getAllDisplays();
  const targetDisplay = displays[displayIndex] ?? displays[0];
  const { x, y, width, height } = targetDisplay.bounds;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    kiosk: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In production load built renderer, in dev load vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); 
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (ev, code, desc, url) => {
    console.error(`Failed to load ${url}: ${code} (${desc})`);
  });

  // Prevent closing with Alt+F4 in kiosk mode
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) e.preventDefault();
  });
}

app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('log-level', '3'); // Silence SSL/Networking log spam

app.whenReady().then(() => {
  MEDIA_DIR = path.join(app.getPath('userData'), 'media');
  fs.ensureDirSync(MEDIA_DIR);

  registerIpcHandlers();
  
  // Register the media:// protocol to serve local files
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://app/', '');
    // Decode to handle files with spaces/special characters
    const filename = decodeURIComponent(url);
    const filePath = path.join(MEDIA_DIR, filename);
    callback({ path: filePath });
  });

  createWindow();

  // Auto-launch on system boot
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath('exe'),
  });
});

app.on('before-quit', () => { app.isQuitting = true; });

// Globally trust all certificates to stop SSL handshake errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});

function registerIpcHandlers() {
  // IPC Handlers — called from renderer via preload bridge

  // Get config
  ipcMain.handle('config:get', () => {
    return {
      serverUrl: store.get('serverUrl', ''),
      deviceId: store.get('deviceId', ''),
      configured: store.get('configured', false),
    };
  });

  // Save config
  ipcMain.handle('config:set', (event, { serverUrl, deviceId }) => {
    store.set('serverUrl', serverUrl.replace(/\/$/, ''));
    store.set('deviceId', deviceId);
    store.set('configured', true);
    return true;
  });

  // Reset config (for re-setup)
  ipcMain.handle('config:reset', () => {
    store.clear();
    return true;
  });

  // Get launch args for multi-display
  ipcMain.handle('config:getLaunchArgs', () => {
    return {
      displayIndex,
      deviceId: instanceDeviceId,
      serverUrl: instanceServerUrl,
    };
  });

  // Fetch playlist from server
  ipcMain.handle('player:fetchPlaylist', async (event, { serverUrl, deviceId }) => {
    try {
      const response = await axiosInstance.get(
        `${serverUrl}/screens/player?device_id=${deviceId}`,
        { timeout: 10000 }
      );
      console.log('Playlist response:', JSON.stringify(response.data).substring(0, 200));
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Fetch playlist error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Download media file to local disk
  ipcMain.handle('player:downloadMedia', async (event, { url, filename }) => {
    if (!MEDIA_DIR) {
      return { success: false, error: 'Media directory not initialized' };
    }
    
    if (!filename) {
      console.error('Download error: filename is undefined for URL:', url);
      return { success: false, error: 'Filename is undefined' };
    }

    const localPath = path.join(MEDIA_DIR, filename);
    console.log('Main: target download path:', localPath);

    // If already cached, return existing path
    if (fs.existsSync(localPath)) {
      return { success: true, localPath: `media://app/${filename}` };
    }

    try {
      console.log(`Main: downloading ${url} -> ${localPath}`);
      const response = await axiosInstance({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 60000,
      });

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      return { success: true, localPath: `media://app/${filename}` };
    } catch (error) {
      console.error('Download media error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Get local media path
  ipcMain.handle('player:getMediaPath', (event, filename) => {
    const localPath = path.join(MEDIA_DIR, filename);
    if (fs.existsSync(localPath)) {
      return `media://app/${filename}`;
    }
    return null;
  });

  // Send heartbeat
  ipcMain.handle('player:heartbeat', async (event, { serverUrl, deviceId }) => {
    try {
      await axiosInstance.post(`${serverUrl}/screens/heartbeat`,
        { device_id: deviceId },
        { timeout: 5000 }
      );
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  });

  // Get cached playlist from disk
  ipcMain.handle('player:getCachedPlaylist', () => {
    const cached = store.get('cachedPlaylist', null);
    return cached;
  });

  // Save playlist to disk cache
  ipcMain.handle('player:cachePlaylist', (event, playlist) => {
    store.set('cachedPlaylist', playlist);
    store.set('playlistCachedAt', Date.now());
    return true;
  });

  // Quit app (for admin escape hatch)
  ipcMain.handle('app:quit', () => {
    app.isQuitting = true;
    app.quit();
  });
}
