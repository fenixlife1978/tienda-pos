import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  // Vercel/GitHub Actions provide TURSO_* without the VITE_ prefix.
  // Vite does not expose non-VITE env vars to import.meta.env by default,
  // so explicitly bridge them for the client bundle used by the browser/Electron app.
  const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL || '';
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN || '';
  return {
    define: {
      'import.meta.env.TURSO_DATABASE_URL': JSON.stringify(tursoDatabaseUrl),
      'import.meta.env.TURSO_AUTH_TOKEN': JSON.stringify(tursoAuthToken),
      'import.meta.env.VITE_TURSO_DATABASE_URL': JSON.stringify(tursoDatabaseUrl),
      'import.meta.env.VITE_TURSO_AUTH_TOKEN': JSON.stringify(tursoAuthToken),
    },
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.png', 'logo.jpg', 'icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: './',
          name: 'DISTRIBUIDORA LA GRAN BODEGA M&S',
          short_name: 'Gran Bodega',
          description: 'Punto de Venta POS bimoneda, pedidos y facturación con soporte offline.',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: './',
          scope: './',
          icons: [
            { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: './pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}'],
          // Only local assets and required BCV API responses are cached; no external font CDN is used.
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'product-images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/(?:bcv\.today|ve\.dolarapi\.com)\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'bcv-api-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
