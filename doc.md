# ScreenFlow Signage — Technical Documentation v1.5

## 1. Overview
ScreenFlow is a production-grade digital signage management dashboard. It allows administrators to manage cloud-hosted media and YouTube embeds, organize them into playlists, schedule their display across global screen networks, and monitor playback health in real-time.

## 2. Core Architecture
- **Backend**: FastAPI (Python 3.11) on standard Python runtime.
- **Frontend**: React 18 (Vite + TypeScript) with Radix UI components.
- **Database**: PostgreSQL (SQLAlchemy ORM) with UUID primary keys.
- **Storage**: Supabase Storage (S3-compatible bucket) for high-performance asset delivery.
- **Deployment**: Render Web Services for both Backend API and Frontend Dashboard.

## 3. Technology Stack
- **Frontend State**: TanStack Query (React Query) for robust caching and synchronization.
- **API Client**: Axios with interceptors for global error handling and authentication.
- **Styling**: Vanilla CSS with modern HSL palettes + Tailwind utility layers where necessary.
- **Auth**: Secure JWT-based Authentication with admin-level protection on management routes.
- **Background Tasks**: FastAPI BackgroundTasks for webhook dispatching and stale heartbeat cleanup.

## 4. Database Schema (v1.5)

### 4.1 Screens
| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `name` | `VARCHAR` | Human-readable screen name (e.g., "Lobby Main") |
| `device_id` | `VARCHAR` | Unique UUID4 string used for hardware identification |
| `status` | `VARCHAR` | `online` (last ping < 60s) / `offline` |
| `last_seen` | `DATETIME` | Timestamp of the last received heartbeat |
| `current_playlist_id` | `UUID` | Default fallback playlist for the screen |

### 4.2 Media
| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary Key |
| `name` | `VARCHAR` | User-defined display name for the asset |
| `type` | `VARCHAR` | `image`, `video`, or `youtube` |
| `url` | `VARCHAR` | The raw YouTube URL OR the Supabase object key |
| `duration` | `NUMERIC` | Playback duration (default 10s for static images) |
| `thumbnail` | `VARCHAR` | (Optional) URL to optimized preview thumbnail |
| `created_at` | `DATETIME` | Audit timestamp of original import |

### 4.3 Playlists & Schedules
*   **Playlists**: Sequential containers for media items.
*   **PlaylistItem**: Junction table mapping media to playlists with `order` and `duration` overrides.
*   **Schedules**: High-priority overrides (Smart Grouping). Allows assigning a specific playlist based on `days_of_week` (PostgreSQL Integer Array) and `start_time`/`end_time`.

## 5. Media Integration Features

### 5.1 YouTube Direct Embedding
To ensure 100% reliability and zero wait-time for administrators:
- **No-Fetch Import**: The backend instantly saves YouTube links without long download processes or server-side verification.
- **Iframe Player**: The signage player automatically detects `youtube` type media and initializes a native YouTube Iframe API player.
- **Clean UI**: Player is pre-configured for `modestbranding=1`, `controls=0`, and `autoplay=1&mute=1` for a professional signage look.
- **Smart Thumbnails**: Frontend dynamically pulls high-quality thumbnails (`hqdefault.jpg`) with an automatic fallback to standard thumbnails (`0.jpg`) if high-def is unavailable.

### 5.2 Asset Management
- **Custom Naming**: Users can set a specialized name during upload/import to replace cryptic system filenames.
- **Partial Updates**: Media can be renamed at any time via a dedicated `PATCH /media/{id}/rename` endpoint.
- **Media Proxy**: All storage assets are served via a backend proxy (`/media/proxy/{filename}`) to bypass CORS restrictions and support HTTP Range requests for video seeking.

## 6. API Reference (Key Endpoints)

### 6.1 Management API (Protected)
- `POST /media/upload`: Upload image/video with optional `name` field.
- `POST /media/youtube`: Add YouTube link with custom `name`.
- `PATCH /media/{id}/rename`: Update display name of an existing asset.
- `GET /media/`: List all tracked media with dynamic proxy URLs.

### 6.2 Signage API (Public)
- `GET /screens/player?device_id=<id>`: Fetches full playback configuration (active playlist + items).
- `POST /screens/heartbeat`: Receives `device_id` to maintain "Online" status. Handles stale screen detection.

## 7. Deployment & Environment
- **Runtime**: Python 3.11 standard runtime on Render.
- **CORS**: Managed via `CORS_ALLOWED_ORIGINS` environment variable. Whitelisting dashboard and player origins is mandatory.
- **Heartbeat Timeout**: Screens not seen within 60 seconds are automatically marked as `offline`.

## 8. Security
- **JWT Protection**: All management endpoints require an `Authorization: Bearer <token>` header.
- **B2/Supabase Privacy**: Buckets are kept private. Assets are only accessible through the dashboard's authenticated proxy or short-lived pre-signed URLs.
- **Audit Logs**: Critical management actions (uploads, deletions, renames) are recorded in the system audit logs.