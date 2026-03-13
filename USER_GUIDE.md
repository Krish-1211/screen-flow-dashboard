# 📺 ScreenFlow User Guide

Welcome to ScreenFlow! This guide will help you set up and manage your digital signage network.

---

## 1. Accessing the Dashboard
- **URL**: [Signage Dashboard](http://localhost:8080)
- **Login**: `client`
- **Password**: `client123`
- **Security**: The dashboard is protected. Only authorized users can manage content.

## 2. Managing Your Media
1. Navigate to the **Media Library** in the sidebar.
2. Click **Upload Media**.
3. Drag and drop your images (JPG, PNG) or videos (MP4).
4. Files will be stored securely on the cloud and automatically cached for offline playback on your screens.

## 3. Creating Playlists
1. Go to the **Playlists** page.
2. Click the **+** button to create a new playlist.
3. Select your new playlist from the list.
4. From the right-hand panel, click the **+ Add** button on any media item to include it in the playlist.
5. Set the **duration** (in seconds) for each item.
6. Changes are saved automatically.

## 4. Registering a New Screen
1. Go to the **Screens** page.
2. Click **Add Screen**.
3. Give your screen a recognizable name (e.g., "Lobby TV").
4. A unique **Screen ID** will be generated.
5. On your display device (Smart TV, Mini PC, etc.), open the URL:
   `[Dashboard-URL]/display/[Screen-ID]`
    *Example: http://localhost:8080/display/abcd-1234*

## 5. Assigning Content to Screens
1. On the **Screens** page, find your screen in the table.
2. Use the **Select Playlist** dropdown to assign a playlist.
3. The display device will instantly sync and start playing the new content.

---

## 💡 Pro Tips for Offline Playback
- **Preloading**: Once the display page is opened, it automatically downloads all media files to the browser's permanent storage.
- **Offline Indicator**: If the internet goes down, you'll see a small "OFFLINE" badge on the display, but the content will continue to loop smoothly.
- **Standalone App**: For a more professional setup, we can convert this into an **Electron Desktop App** which runs in fullscreen "Kiosk Mode" and starts automatically with the computer.

---
*© 2026 ScreenFlow Signage Systems*
