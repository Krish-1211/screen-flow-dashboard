# ScreenFlow — Render Deployment Guide

## Prerequisites
- A Render account (render.com) — free tier is sufficient for demos.
- A Backblaze B2 account (backblaze.com/b2) with a private bucket.
- This repository pushed to GitHub or GitLab.

## Step 1 — Set up Backblaze B2
1. Log into Backblaze → B2 Cloud Storage → Buckets → Create a Bucket.
2. Bucket Name: `screenflow-media` (must be globally unique).
3. Bucket Settings: **Private**.
4. Go to App Keys → Add a New Application Key.
5. Key Name: `screenflow-api`.
6. Allow access to bucket: `screenflow-media`.
7. Type of Access: **Read and Write**.
8. Copy: **keyID** and **applicationKey**.
9. Note your S3 Endpoint (e.g., `https://s3.us-east-005.backblazeb2.com`).

## Step 2 — Deploy to Render
1. Go to render.com → New → Blueprint.
2. Connect your GitHub/GitLab repo.
3. Render will detect `render.yaml` and create all three services
   (API, Dashboard, PostgreSQL) automatically.
4. Once created, go to the `screenflow-api` service → Environment.
5. Fill in all `sync: false` variables:

| Variable | Value |
|---|---|
| JWT_SECRET_KEY | Any long random string (min 32 chars) |
| ADMIN_USERNAME | Your chosen admin username |
| ADMIN_PASSWORD | Your chosen admin password |
| CORS_ALLOWED_ORIGINS | Your Render dashboard URL, e.g. `https://screenflow-dashboard.onrender.com` |
| B2_KEY_ID | From Backblaze App Keys |
| B2_APPLICATION_KEY | From Backblaze App Keys |
| B2_BUCKET_NAME | `screenflow-media` |
| B2_ENDPOINT | Your Backblaze S3 Endpoint |

6. Go to the `screenflow-dashboard` service → Environment.
7. Set `VITE_API_URL` to your API service URL, e.g.:
   `https://screenflow-api.onrender.com`
8. Trigger a manual deploy on both services.

## Step 3 — Configure UptimeRobot (Prevents false offline alerts)
1. Go to uptimerobot.com → Add New Monitor.
2. Monitor type: HTTP(s).
3. URL: `https://screenflow-api.onrender.com/health`
4. Monitoring interval: Every 5 minutes.
5. Save. This keeps the backend warm and prevents heartbeat timeouts.

## Step 4 — Verify
- Open your dashboard URL and log in with ADMIN_USERNAME / ADMIN_PASSWORD.
- Register a test screen by opening `<dashboard-url>/display` in another tab.
- Upload a test image — it should appear in the Media Library.
- Assign the media to a playlist and assign the playlist to your test screen.
- Confirm the display page shows the content.
