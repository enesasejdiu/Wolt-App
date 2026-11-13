/* Leonis Rama: Development server. Venue data is proxied while the dev server is running. */

import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { accountsPlugin } from './server/accounts'

/* Stiljan Zeqiri: Removes browser cookies before a request is forwarded to an outside service.
   Cookies left on localhost by other projects made Wolt answer 403, and the homepage stayed empty. */
const dropCookies: ProxyOptions['configure'] = (proxy) => {
  proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('cookie'))
}

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
        configure: dropCookies,
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
        configure: dropCookies,
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
        configure: dropCookies,
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
        configure: dropCookies,
        rewrite: (path) => path.replace(/^\/osrm/, ''),
      },
    },
  },
})
