# ScreenFlow

ScreenFlow is a Digital Signage Management Dashboard built with React, Vite, TypeScript, and TailwindCSS.

It supports two main execution modes:
1. **Admin Dashboard** - A fully responsive PWA that manages screens, media, and playlists.
2. **Display Player** - A signage interface designed for TVs, mini PCs, and full-screen kiosks with automated media cycling, self-healing connections, and offline playlist fallbacks.

## Running Locally

To run the application locally, you can use `npm run dev` to start the Vite development server.

```sh
npm install
npm run dev
```

## Production

This application is configured as a fully installable PWA with offline-first caching strategies via Workbox. 

To build for production:

```sh
npm run build
```

Then host the `dist/` directory on any modern static provider (Vercel, Netlify, Nginx, etc.).
