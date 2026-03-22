# ScreenFlow Player – Complete Logic Documentation

> **Last Updated:** March 22, 2026  
> This document is a single-source-of-truth reference for every part of the player system: how it boots, fetches content, renders media, handles failures, and communicates with the backend.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Two Player Implementations](#2-the-two-player-implementations)
3. [Web Player (Primary – `src/pages/display`)](#3-web-player)
   - 3.1 [Boot Sequence](#31-boot-sequence)
   - 3.2 [Device Identity](#32-device-identity)
   - 3.3 [Heartbeat System](#33-heartbeat-system)
   - 3.4 [Playlist Loading & Polling](#34-playlist-loading--polling)
   - 3.5 [Schedule-Aware Time Sync](#35-schedule-aware-time-sync)
   - 3.6 [Media Rendering Loop](#36-media-rendering-loop)
   - 3.7 [Error Handling & Recovery](#37-error-handling--recovery)
   - 3.8 [Offline Fallback (localStorage)](#38-offline-fallback-localstorage)
   - 3.9 [Fullscreen & Display Controls](#39-fullscreen--display-controls)
4. [Standalone Node Player (`player/`)](#4-standalone-node-player)
   - 4.1 [Architecture](#41-architecture)
   - 4.2 [Module Breakdown](#42-module-breakdown)
   - 4.3 [Cache System](#43-cache-system)
   - 4.4 [Display Detection](#44-display-detection)
5. [Server-Side Player API (`server.js`)](#5-server-side-player-api)
   - 5.1 [GET /screens/player](#51-get-screensplayer)
   - 5.2 [POST /screens/heartbeat](#52-post-screensheartbeat)
   - 5.3 [Schedule Evaluation Engine](#53-schedule-evaluation-engine)
   - 5.4 [Playlist Enrichment Pipeline](#54-playlist-enrichment-pipeline)
6. [API Service Layer (`screensApi`)](#6-api-service-layer)
7. [Data Flow Diagram](#7-data-flow-diagram)
8. [Configuration Reference](#8-configuration-reference)
9. [Known Edge Cases & Design Decisions](#9-known-edge-cases--design-decisions)

---

## 1. Architecture Overview

The ScreenFlow player system consists of **three layers** that work together:

```
┌──────────────────────────────────────────────────────────┐
│                    DISPLAY DEVICE                        │
│  ┌────────────────────┐   ┌──────────────────────────┐   │
│  │   Web Player       │   │   Standalone Node Player │   │
│  │  (Browser-based)   │   │   (Dedicated hardware)   │   │
│  │  src/pages/display  │   │   player/                │   │
│  └────────┬───────────┘   └──────────┬───────────────┘   │
│           │                          │                    │
│           └──────────┬───────────────┘                    │
│                      │  HTTP API                         │
└──────────────────────┼───────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────┐
│               BACKEND SERVER (server.js)                 │
│                      │                                    │
│   ┌──────────────────┴───────────────────────────────┐   │
│   │  GET /screens/player     POST /screens/heartbeat │   │
│   │  Schedule Evaluation  →  Playlist Enrichment     │   │
│   └──────────────────────────────────────────────────┘   │
│                      │                                    │
│   ┌──────────────────┴───────────────────────────────┐   │
│   │              Prisma ORM (SQLite/Postgres)        │   │
│   │  Screen | Schedule | Playlist | PlaylistItem     │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. The Two Player Implementations

| Feature | Web Player | Standalone Node Player |
|---|---|---|
| **Location** | `src/pages/display/index.tsx` | `player/` directory |
| **Runtime** | Browser (React component) | Node.js (TypeScript) |
| **Use Case** | Any device with a browser | Dedicated signage hardware |
| **Media Rendering** | HTML `<img>`, `<video>`, `<iframe>` | Console-based (headless) |
| **Offline Support** | `localStorage` cache | Filesystem cache (`player/cache/`) |
| **YouTube Support** | Yes (embedded iframe) | No |
| **Status** | **Primary – Production** | Prototype / Development |

---

## 3. Web Player

**File:** `src/pages/display/index.tsx`  
**Route:** `/display?device_id=<DEVICE_ID>`

This is the main player used in production. It runs inside the React application and is accessed by opening the player URL on any browser (TV, tablet, kiosk, etc.).

### 3.1 Boot Sequence

When the player page loads, the following happens in order:

```
1. Parse URL → extract `device_id` from query string
2. Disable right-click context menu (prevents accidental UI interactions on kiosks)
3. Hide body scrollbar (fullscreen immersion)
4. Start 30-second heartbeat loop
5. Call `loadPlaylist(true)` → first fetch with loading spinner
6. Start 10-second poll interval for playlist updates
7. Register online/offline event listeners
8. Begin media rendering loop
```

### 3.2 Device Identity

The device is identified entirely through the URL query parameter `device_id`.

```
https://your-domain.com/display?device_id=dev_1774175622489
```

- This ID is generated by the **dashboard** when a screen is registered.
- If the backend does not recognise a `device_id`, it **auto-registers** a new screen record with a name like `New Screen (2489)`.
- The device ID is also used as the `localStorage` key for offline playlist storage.

### 3.3 Heartbeat System

**Purpose:** Keeps the dashboard's "Online/Offline" status indicator accurate.

```typescript
// Every 30 seconds:
screensApi.heartbeat(deviceId);  // POST /screens/heartbeat { device_id }
```

**Lifecycle:**
| Event | Action |
|---|---|
| Player opens | Immediate heartbeat + 30s interval starts |
| Player is open | Heartbeat fires every 30 seconds |
| Tab/window closes | `navigator.sendBeacon()` fires one last heartbeat with `status: 'offline'` |
| Network drops | Heartbeat silently fails; dashboard marks screen offline after timeout |

**Why `sendBeacon`?** Regular `fetch()` or `axios` calls are cancelled when a page unloads. `sendBeacon` guarantees the request is sent even during page close.

### 3.4 Playlist Loading & Polling

The player fetches its assigned content through a **continuous polling loop**:

```
┌─────────────────────────────────────────────────────┐
│                    Every 10 seconds                  │
│                                                      │
│  1. Get current local time (HH:MM)                  │
│  2. Convert JS day → Dashboard day index            │
│  3. GET /screens/player?device_id=X                  │
│     &local_time=14:30&local_day=5                    │
│  4. Server evaluates schedules → returns playlist   │
│  5. Player updates its internal state               │
│  6. Preload all media URLs via fetch()              │
│  7. Save playlist to localStorage (offline backup)  │
└─────────────────────────────────────────────────────┘
```

**Key detail:** The player sends its **local time and day** to the server. This ensures schedules are evaluated based on the physical location of the display, not the server's timezone.

### 3.5 Schedule-Aware Time Sync

JavaScript and the dashboard use different day-of-week numbering:

| Day | JavaScript `getDay()` | Dashboard Index |
|---|---|---|
| Monday | 1 | 0 |
| Tuesday | 2 | 1 |
| Wednesday | 3 | 2 |
| Thursday | 4 | 3 |
| Friday | 5 | 4 |
| Saturday | 6 | 5 |
| **Sunday** | **0** | **6** |

The conversion in the player:
```typescript
const jsDay = now.getDay();
const localDay = jsDay === 0 ? 6 : jsDay - 1;
```

### 3.6 Media Rendering Loop

The player cycles through playlist items using a timer-based advance system:

```
┌────────────────────┐
│  currentIndex = 0  │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│  Read playlist.items[currentIndex]                  │
│                                                     │
│  Is it YouTube?  → render <iframe> (autoplay,muted) │
│  Is it video?    → render <video> (autoPlay)        │
│  Is it image?    → render <img>                     │
│                                                     │
│  Wait for item.duration seconds (default: 10s)      │
│  Then: currentIndex = (currentIndex + 1) % length   │
└────────────────────────────────────────────────────┘
```

**Timer mechanism:** Uses `setInterval` with the current item's `duration` (in seconds). Each time `currentIndex` or `playlist` changes, the timer resets to prevent drift.

**Video special case:** If a video is shorter than its `duration`, the `onEnded` event fires and immediately advances to the next item.

### 3.7 Error Handling & Recovery

```
Media Error occurs (broken URL, codec issue, 404)
    │
    ├─ Set mediaError = true → show "Media Error / Skipping in 5s..."
    │
    └─ After 5 seconds → advanceMedia() → move to next item
```

The player **never stops**. If a single media item fails, it shows an error screen for 5 seconds and then skips to the next piece of content.

### 3.8 Offline Fallback (localStorage)

Every time a playlist is successfully loaded from the server, it is saved:

```typescript
localStorage.setItem(`offline-playlist-${deviceId}`, JSON.stringify(data));
```

If the next server fetch fails (network down, server error):

```typescript
const offline = localStorage.getItem(`offline-playlist-${deviceId}`);
// Parse and use the cached playlist
```

This means the player **continues showing the last known good content** even when completely disconnected from the internet.

### 3.9 Fullscreen & Display Controls

- **Right-click disabled:** `document.addEventListener("contextmenu", e => e.preventDefault())`
- **Scrollbar hidden:** `document.body.style.overflow = "hidden"`
- **Cursor hidden:** CSS class `cursor-none` on the container
- **Click-to-fullscreen:** Clicking anywhere on the player triggers `requestFullscreen()`
- **Media sizing:** All content uses `object-contain` to scale without cropping

---

## 4. Standalone Node Player

**Directory:** `player/`  
**Entry point:** `player/main.ts`

This is a headless, server-side player designed for dedicated hardware (Raspberry Pi, industrial PCs). It is **not used in production** currently but provides the foundation for future hardware deployments.

### 4.1 Architecture

```
main.ts (orchestrator)
  ├── config.json          → Server URL, heartbeat interval, cache dir
  ├── cacheManager.ts      → Downloads and validates media files
  ├── playlistManager.ts   → Fetches and cycles through playlist items
  ├── playerEngine.ts      → Runs the playback loop
  ├── heartbeat.ts         → Periodic health check to server
  └── displayManager.ts    → Detects connected displays
```

### 4.2 Module Breakdown

#### `main.ts` – Orchestrator
1. Reads `config.json` for server URL and settings
2. Generates or reads a persistent `device_id` (stored in `device_id.txt`)
3. Registers with backend via `POST /screens/register`
4. Initialises all subsystems (cache, playlist, engine, heartbeat, display)
5. Fetches playlist and downloads all media to local cache
6. Starts the playback engine loop

#### `playlistManager.ts` – Content Source
- **`fetchPlaylist(screenId, serverUrl)`**: Fetches the assigned playlist from the API
- **`getNextItem()`**: Returns the next `PlaylistItem` in round-robin order
- **`setPlaylist()`**: Manually sets a playlist (used for offline cached playlists)
- Tracks `currentIndex` internally and wraps around at the end

#### `playerEngine.ts` – Playback Loop
- Runs an infinite `while(isRunning)` loop
- Calls `getNextItem()` to get the next content piece
- Logs `[PLAYING]` and `[FINISHED]` for each item
- Waits for `item.duration` seconds (default: 5s for images, 10s for videos)
- Currently headless (console output only); designed to be extended with a rendering backend

#### `cacheManager.ts` – Media Cache
- Organises files into `cache/videos/` and `cache/images/`
- **Download with retry:** 3 attempts with exponential backoff
- **Integrity validation:** Checks file exists and size > 0 bytes
- **Corruption recovery:** Deletes corrupted files and re-downloads

```
player/cache/
  ├── videos/
  │   ├── promo_video.mp4
  │   └── announcement.webm
  └── images/
      ├── slide_1.png
      └── banner.jpg
```

#### `heartbeat.ts` – Health Monitor
- Sends `POST /screens/heartbeat` every `heartbeat_interval` seconds (default: 30)
- Runs on a `setInterval` timer
- Failures are logged but don't crash the player

#### `displayManager.ts` – Screen Detection
- On macOS: Reads `system_profiler SPDisplaysDataType` to detect connected monitors
- Returns resolution and position for each display
- Falls back to 1920×1080 if detection fails
- Calculates combined resolution for multi-display setups

### 4.3 Cache System

```
Download Request
    │
    ├─ File exists locally?
    │   ├─ Yes → Validate integrity
    │   │         ├─ Valid → Return local path (skip download)
    │   │         └─ Corrupted → Delete and re-download
    │   │
    │   └─ No → Download from server
    │           ├─ Success → Validate → Return path
    │           └─ Failure → Retry (up to 3 times, exponential backoff)
    │                         └─ All retries failed → Throw error, skip item
```

### 4.4 Display Detection

```typescript
const displays = await displayManager.getDisplays();
// Returns: [{ id, name, resolution: { width, height }, position: { x, y } }]

const combined = displayManager.getCombinedResolution(displays);
// Returns: { width: 3840, height: 1080 } for two side-by-side 1080p displays
```

---

## 5. Server-Side Player API

### 5.1 GET /screens/player

**File:** `server.js`, line ~224  
**Purpose:** Returns the active playlist for a given device

**Query Parameters:**
| Param | Required | Description |
|---|---|---|
| `device_id` | Yes | The unique identifier for the display |
| `local_time` | No | Player's local time in `HH:MM` format |
| `local_day` | No | Player's day index (0=Mon, 6=Sun) |

**Response Flow:**
```
1. Look up screen by deviceId
2. If not found → auto-register a new screen
3. Call getActivePlaylist(screen, local_time, local_day)
   a. Check schedules → if match → return scheduled playlist
   b. No schedule → return default assigned playlist
   c. No playlist at all → return fallback "No Content" placeholder
4. Return enriched playlist JSON
```

**Response Shape:**
```json
{
  "id": "abc-123",
  "name": "Morning Loop",
  "items": [
    {
      "id": "item-1",
      "mediaId": "media-1",
      "order": 0,
      "duration": 15,
      "media": {
        "id": "media-1",
        "name": "Welcome Banner",
        "type": "image",
        "url": "https://example.com/banner.jpg",
        "duration": 15
      }
    }
  ]
}
```

### 5.2 POST /screens/heartbeat

**Purpose:** Updates the screen's online status and last-seen timestamp

**Request Body:**
```json
{ "device_id": "dev_1774175622489" }
```

**Server Action:**
```javascript
await prisma.screen.update({
    where: { deviceId },
    data: { status: 'online', lastSeen: new Date() }
});
```

### 5.3 Schedule Evaluation Engine

**File:** `server.js`, function `getActivePlaylist()`

This is the core logic that decides **what content plays right now**.

**Decision Tree:**
```
getActivePlaylist(screen, clientTime, clientDay)
    │
    ├─ 1. Fetch ALL schedules for this screen + global schedules
    │
    ├─ 2. Determine current time & day
    │      ├─ Client provided time? → Use it
    │      └─ No? → Use server time (with JS→Dashboard day conversion)
    │
    ├─ 3. Filter schedules by:
    │      ├─ Day match: schedule's daysOfWeek includes currentWeekday
    │      └─ Time match: currentTime is between (startTime - 1min) and endTime
    │
    ├─ 4. Active schedule found?
    │      ├─ Yes → Fetch its playlist → enrich with media → RETURN
    │      └─ No  → Continue to fallback
    │
    ├─ 5. Screen has a default playlist assigned?
    │      ├─ Yes → Fetch it → enrich with media → RETURN
    │      └─ No  → RETURN null
    │
    └─ 6. Null result → Player shows "No Content" placeholder
```

**The 1-Minute Buffer:**
```javascript
// If schedule starts at 14:00, effectively starts matching at 13:59
schStartM -= 1;
if (schStartM < 0) { schStartM = 59; schStartH -= 1; }
```

This ensures that if a player polls at 13:59:45, the 14:00 schedule is already active, so content starts exactly on time rather than 10 seconds late (the next poll cycle).

### 5.4 Playlist Enrichment Pipeline

**File:** `server.js`, function `enrichPlaylistData()`

Raw playlist data from the database only contains `mediaId` references. The enrichment step resolves these into full media objects:

```
Input (from DB):
  { id, playlistId, mediaId, order, duration }

After enrichment:
  { id, playlistId, mediaId, order, duration,
    media: { id, name, type, url, duration, createdAt } }
```

Steps:
1. For each `PlaylistItem`, fetch the corresponding `Media` record
2. Filter out items with missing media (deleted files)
3. Sort by `order` field (ascending)

---

## 6. API Service Layer

**File:** `src/services/api/screens.ts`

This TypeScript module wraps all player-related API calls with proper typing:

| Method | API Call | Description |
|---|---|---|
| `screensApi.heartbeat(deviceId)` | `POST /screens/heartbeat` | Sends online status |
| `screensApi.getPlayerConfig(deviceId, time, day)` | `GET /screens/player?...` | Fetches active playlist |
| `screensApi.getAll()` | `GET /screens/` | Lists all screens (dashboard) |
| `screensApi.create(payload)` | `POST /screens/register` | Registers new screen |
| `screensApi.update(id, payload)` | `PUT /screens/:id` | Updates screen config |
| `screensApi.delete(id)` | `DELETE /screens/:id` | Removes a screen |
| `screensApi.bulkUpdate(ids, playlistId)` | `PUT /screens/bulk` | Mass playlist assignment |

---

## 7. Data Flow Diagram

```
                              ┌─────────────────┐
                              │   DASHBOARD UI   │
                              │  (React Admin)   │
                              └────────┬─────────┘
                                       │
                   Creates/edits playlists, assigns to screens,
                   sets schedules, uploads media
                                       │
                                       ▼
┌─────────────┐    HTTP API    ┌───────────────────┐    Prisma ORM    ┌──────────┐
│  WEB PLAYER │ ◄────────────► │    server.js       │ ◄──────────────► │ DATABASE │
│  (Browser)  │                │                    │                  │ (SQLite) │
│             │ ──heartbeat──► │  /screens/heartbeat│                  │          │
│             │ ◄──playlist──  │  /screens/player   │                  │          │
│             │                │                    │                  │          │
└─────────────┘                │  getActivePlaylist │                  └──────────┘
                               │  enrichPlaylistData│
┌─────────────┐                │                    │
│ NODE PLAYER │ ◄────────────► │  /screens/register │
│ (Hardware)  │                └───────────────────-┘
└─────────────┘

Timeline (per 10-second cycle):
  0s  ──── Player sends GET /screens/player with local_time & local_day
  0s  ──── Server evaluates schedules → returns playlist JSON
  0s  ──── Player updates state, preloads media, saves to localStorage
  10s ──── Cycle repeats
```

---

## 8. Configuration Reference

### Web Player (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `https://screen-api-6sac.onrender.com` | Backend API base URL |

### Standalone Node Player (`player/config.json`)

```json
{
  "server_url": "http://localhost:8000",
  "heartbeat_interval": 30,
  "cache_directory": "./cache"
}
```

| Key | Default | Description |
|---|---|---|
| `server_url` | `http://localhost:8000` | Backend API base URL |
| `heartbeat_interval` | `30` | Seconds between heartbeat pings |
| `cache_directory` | `./cache` | Where to store downloaded media |

### Timing Constants (Hardcoded)

| Constant | Value | Location | Description |
|---|---|---|---|
| Heartbeat interval | 30s | `display/index.tsx:51` | How often player reports "I'm alive" |
| Playlist poll interval | 10s | `display/index.tsx:111` | How often player checks for new content |
| Error skip timeout | 5s | `display/index.tsx:148` | How long error screen shows before skipping |
| Default media duration | 10s | `display/index.tsx:137` | Fallback if no duration specified |
| Schedule start buffer | -1 min | `server.js:107` | Pre-activates schedules 1 minute early |

---

## 9. Known Edge Cases & Design Decisions

### Why does the player send its local time?
The server might be in a completely different timezone (e.g., Render's US servers). If we used server time, a schedule meant for 9 AM IST might trigger at 9 AM UTC instead. By sending the player's local time, schedules always align with the physical location of the display.

### Why is there a 1-minute buffer on schedule start times?
The player polls every 10 seconds. If a schedule starts at exactly `14:00` and the last poll was at `13:59:55`, the next poll at `14:00:05` would catch it. But if the last poll was at `13:59:50`, the next one is at `14:00:00` — a tight race. The 1-minute buffer guarantees the schedule is already active by the time any poll in that minute fires.

### Why auto-register unknown devices?
In a real-world deployment, a technician plugs in a new TV, opens the player URL, and expects it to "just work." Auto-registration creates a screen record immediately, so the dashboard admin can see it and assign content — no manual registration step required.

### Why `sendBeacon` for the unload heartbeat?
`fetch()` and `axios` calls are cancelled when a browser tab closes. `navigator.sendBeacon()` is specifically designed to fire a small POST request that persists through page unload, ensuring the server gets notified.

### What happens if the server is completely unreachable?
The player loads the last successful playlist from `localStorage` and continues playing it indefinitely. The offline indicator (red WiFi icon) appears in the top-right corner. As soon as the connection is restored, the next poll cycle picks up the latest content.

### Why are there two separate player implementations?
The **Web Player** is the most versatile — it works on any device with a browser. The **Standalone Node Player** is designed for scenarios where a full browser isn't available or practical (e.g., embedded Linux SBCs, headless kiosks). The Node player was built as a prototype and can be extended with hardware-specific rendering (e.g., `mpv` for video playback).

---

## File Reference

| File | Purpose |
|---|---|
| `src/pages/display/index.tsx` | Web Player – React component (production) |
| `src/services/api/screens.ts` | API wrapper for heartbeat, playlist fetch, CRUD |
| `server.js` (lines 44–156) | `enrichPlaylistData()` + `getActivePlaylist()` – server-side scheduling & enrichment |
| `server.js` (lines 224–261) | `GET /screens/player` – player API endpoint |
| `player/main.ts` | Standalone Node player – entry point |
| `player/cacheManager.ts` | Media download, caching, and integrity validation |
| `player/playlistManager.ts` | Playlist fetch and round-robin item cycling |
| `player/playerEngine.ts` | Headless playback loop |
| `player/heartbeat.ts` | Periodic online status reporting |
| `player/displayManager.ts` | Hardware display detection |
| `player/config.json` | Standalone player configuration |
