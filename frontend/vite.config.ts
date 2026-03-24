import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const enablePwa = process.env.ENABLE_PWA === "true";

  return {
  server: {
    host: "::",
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    enablePwa && VitePWA({
      registerType: 'autoUpdate',
      minify: false,
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'ScreenFlow Signage',
        short_name: 'ScreenFlow',
        description: 'Digital Signage Management Dashboard',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}'],
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
