# Changelog

## [1.4.0] - 2026-03-15
### Added
- Bulk screen assignments feature.
- Webhook notifications for screen offline events.
- Advanced content scheduling with day/time rules.
- System-wide Audit Log tracking administrative actions.

## [1.3.0] - 2026-03-15
### Added
- JWT authentication for the management API.
- Hardened CORS policy with explicit origin allowlist.
- Server-issued cryptographically secure device identity (UUID4) via httpOnly cookies.
- Path traversal prevention on media uploads and file serving.
- Dedicated `/auth/token` endpoint for dashboard administrative login.

### Fixed
- Screen status real-time calculation logic.
- Indentation errors in backend screen routes.
- Polling mechanism for dashboard status updates.
- Heartbeat grace period and atomic playlist updates (cumulative).
- Upload deduplication race fix considerations.
