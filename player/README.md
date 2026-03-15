# Screen Player Engine

Standalone player for ScreenFlow digital signage.

## Architecture

- **Main Loop**: Managed in `main.ts`, handles registration and lifecycle.
- **Cache Manager**: Handles local storage of media files (`player/cache/`).
- **Playlist Manager**: Fetches and manages the sequence of media items.
- **Player Engine**: Controls the playback logic (images vs videos).
- **Display Manager**: Detects connected monitors and manages window positioning.
- **Heartbeat System**: Periodically pings the backend to report online status.

## Future Plans (Phase 10)

### .exe Player Packaging
Use Electron or a similar wrapper to package the TypeScript player into a standalone executable.

### Video Wall Layouts
Extend `displayManager.ts` to support complex grids and spans for multiple monitors forming a single large display.

### White-Label Branding
Implement a configuration-driven UI for the player that allows custom logos and colors.

### Remote Reseller Management
Prepare APIs for multi-tenant backend support where resellers can manage their own sets of screens.

### Central Cloud Sync
Implement a sync mechanism that allows local shop servers to periodically sync content with a central cloud management dashboard.

## Modular Design
The system is designed to be offline-first. The player engine operates independently of a continuous network connection once the media and playlist are cached.
