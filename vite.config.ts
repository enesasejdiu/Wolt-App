import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/wolt': {
        target: 'https://restaurant-api.wolt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wolt/, ''),
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
      },
      '/consumer': {
        target: 'https://consumer-api.wolt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/consumer/, ''),
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        headers: {
          'user-agent': 'WoltKosovoPreview/1.0',
          'accept-language': 'en',
        },
      },
      '/osrm': {
        target: 'https://router.project-osrm.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/osrm/, ''),
      },
    },
  },
})
