import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CacheManager } from './cacheManager.js';
import { PlaylistManager } from './playlistManager.js';
import { PlayerEngine } from './playerEngine.js';
import { HeartbeatSystem } from './heartbeat.js';
import { DisplayManager } from './displayManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const serverUrl = config.server_url;
  const deviceIdPath = path.join(__dirname, 'device_id.txt');

  // 1. Generate or read a persistent device_id
  let deviceId: string;
  if (fs.existsSync(deviceIdPath)) {
    deviceId = fs.readFileSync(deviceIdPath, 'utf8').trim();
  } else {
    // Generate a simple ID or use uuid if we had it.
    // Let's use a simple random string for now if uuid is not installed, 
    // but I installed uuid via npm in the setup step.
    // Wait, I did 'npm install uuid'? No I did 'npm install typescript ts-node node-fetch@2 axios'.
    // Let me add uuid.
    deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    fs.writeFileSync(deviceIdPath, deviceId);
  }

  console.log(`Starting Screen Player for device: ${deviceId}`);

  // 2. Register with backend
  let screenId: number = 0;
  try {
    const regResponse = await axios.post(`${serverUrl}/screens/register`, {
      device_id: deviceId
    });
    screenId = regResponse.data.screen_id;
    console.log(`Registered successfully. Screen ID: ${screenId}`);
  } catch (e) {
    console.error('Registration failed:', (e as any).response?.data || (e as any).message);
    process.exit(1);
  }

  const cacheManager = new CacheManager(path.resolve(__dirname, config.cache_directory));
  const playlistManager = new PlaylistManager();
  const engine = new PlayerEngine(cacheManager);
  const heartbeat = new HeartbeatSystem(deviceId, serverUrl, config.heartbeat_interval);
  const displayManager = new DisplayManager();

  // Start heartbeat
  heartbeat.start();

  // Detect displays
  const displays = await displayManager.getDisplays();
  const resolution = displayManager.getCombinedResolution(displays);
  console.log(`Detected ${displays.length} displays. Combined resolution: ${resolution.width}x${resolution.height}`);

  // 3. Fetch assigned playlist
  console.log('Fetching playlist...');
  const cachedPlaylistPath = path.join(__dirname, 'last_playlist.json');
  try {
    const playlist = await playlistManager.fetchPlaylist(screenId, serverUrl);
    fs.writeFileSync(cachedPlaylistPath, JSON.stringify(playlist, null, 2));
    console.log(`Loaded playlist: ${playlist.name} with ${playlist.items.length} items`);

    // 4. Download all media assets
    console.log('Syncing media assets...');
    for (const item of playlist.items) {
      try {
        await cacheManager.downloadMedia(item.media.url, serverUrl);
      } catch (err) {
        console.error(`Failed to download ${item.media.url}, skipping for now.`);
      }
    }
    console.log('All media synced.');

  } catch (e) {
    console.error('Error fetching playlist:', (e as any).message);
    if (fs.existsSync(cachedPlaylistPath)) {
      console.log('Using cached playlist for offline playback...');
      const cached = JSON.parse(fs.readFileSync(cachedPlaylistPath, 'utf8'));
      playlistManager.setPlaylist(cached);
    } else {
      console.log('No cached playlist found. Waiting for server...');
    }
  }

  // 5. Begin playback loop
  await engine.start(() => playlistManager.getNextItem());
}

main().catch(console.error);
