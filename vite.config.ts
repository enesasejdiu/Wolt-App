/* Leonis Rama: Development server. Venue data is proxied while the dev server is running. */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { accountsPlugin } from './server/accounts'

export default defineConfig({
  /* Leonis Rama: React plugin and local accounts plugin. */
  plugins: [react(), accountsPlugin()],
  server: {
    port: 5173,
    proxy: {
      /* Leonis Rama: Proxies venue pages used by the homepage, listings, and venue view. */
      '/wolt': {
        target: 'https://restaurant-api.wolt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wolt/, ''),
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
      },
      /* Stiljan Zeqiri: Proxies store assortment requests. */
      '/consumer': {
        target: 'https://consumer-api.wolt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/consumer/, ''),
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
      },
      /* Ensar Sallahu: Proxies address geocoding. */
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        headers: {
          'user-agent': 'WoltKosovoPreview/1.0',
          'accept-language': 'en',
        },
      },
      /* Ensar Sallahu: Proxies driving-route requests. */
      '/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm/, ''),
      },
    },
  },
})
