# ScreenFlow Signage — Technical Documentation v1.4

## 1. Overview
ScreenFlow is a robust, lightweight digital signage management dashboard. It allows administrators to manage media assets, organize them into playlists, schedule their display across multiple screens, and monitor screen health in real-time.

## 2. Core Architecture
- **Backend**: FastAPI (Python 3.11)
- **Frontend**: React (Vite + TypeScript)
- **Database**: PostgreSQL (SQLAlchemy ORM)
- **Storage**: Backblaze B2 (S3-compatible)
- **Deployment**: Render (Web Service for Backend/Frontend + Managed PostgreSQL)

## 3. Technology Stack
- **Frontend State**: TanStack Query (React Query)
- **API Client**: Axios
- **Styling**: Tailwind CSS + Shadcn UI
- **Auth**: JWT-based Authentication
- **Background Tasks**: FastAPI BackgroundTasks for webhook dispatching and stale screen cleanup.

## 4. Database Schema

### 4.1 Screens
| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER` | Primary Key |
| `name` | `VARCHAR` | Human-readable screen name |
| `device_id` | `VARCHAR` | Unique UUID4 generated at registration |
| `status` | `VARCHAR` | `online` / `offline` |
| `last_seen` | `DATETIME` | Timestamp of the last heartbeat |
| `current_playlist_id` | `INTEGER` | Default playlist assigned to the screen |

### 4.2 Media
| Column | Type | Description |
|---|---|---|
| `id` | `INTEGER` | Primary Key |
| `filename` | `VARCHAR` | Sanitized original filename |
| `file_type` | `VARCHAR` | `image` / `video` |
| `url` | `VARCHAR` | Pre-signed B2 storage URL |
| `duration` | `INTEGER` | Playback duration (default: 10s for images) |

### 4.3 Playlists
- `Playlist`: Standard container for media items.
- `PlaylistItem`: Junction table between Playlists and Media with `position` and `duration` overrides.

### 4.4 Schedules
- Allows overriding default playlists based on specific days and time ranges.
- Uses PostgreSQL-specific `ARRAY(Integer)` for `days_of_week`.

## 5. Screen Registration Flow (v1.4)
The registration flow is **Admin-Initiated**.
1. **Admin Creation**: The administrator creates a screen via the Dashboard, providing a name and optional playlist.
2. **Device ID Generation**: The server generates a persistent `UUID4` `device_id`.
3. **Player URL**: The admin copies the Player URL: `/display?device_id=<device_id>`.
4. **Playback**: When the player opens this URL, it fetches content from the public `/screens/player` endpoint using the `device_id`.
5. **Heartbeat**: The player sends heartbeats every 30 seconds containing the `device_id` to maintain its "online" status.

## 6. API Reference (Public Endpoints)

### 6.1 Player Configuration
`GET /screens/player?device_id=<device_id>`
Returns the current active playlist (default or scheduled) and all associated media URLs.
- **Auth**: None (Public)
- **Error**: `404` if `device_id` is invalid.

### 6.2 Heartbeat
`POST /screens/heartbeat`
- **Payload**: `{"device_id": "uuid-string"}`
- **Auth**: None (Public)
- **Effect**: Updates `last_seen` and sets status to `online`. Triggers `screen.offline` webhooks for other stale screens.

### 6.3 Health Check
`API_ROUTE /health`
- **Methods**: `GET`, `HEAD`
- **Response**: `{"status": "ok"}`
- **Purpose**: Used for uptime monitoring to keep the Render free-tier service awake.

## 7. Configuration (Environment Variables)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Secret for signing auth tokens |
| `ADMIN_USERNAME` | Master admin username |
| `ADMIN_PASSWORD` | Master admin password |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins |
| `B2_ENDPOINT` | Backblaze B2 S3 endpoint |
| `B2_KEY_ID` | B2 Key ID |
| `B2_APPLICATION_KEY` | B2 Application Key |
| `B2_BUCKET_NAME` | B2 Bucket Name |

## 8. Webhooks
Configurable webhooks for system events:
- `screen.online`: Triggered when a screen sends a heartbeat after being offline.
- `screen.offline`: Triggered when a screen missed heartbeats (timeout: 60s).
- `media.upload`: Triggered when new media is added.

## 9. Security
- **JWT Auth**: All management endpoints (`/media`, `/playlists`, `/screens` (admin)) require a valid JWT.
- **CORS**: Enforced whitelist.
- **B2 Privacy**: Media is stored in a private bucket; URLs are generated with limited validity.