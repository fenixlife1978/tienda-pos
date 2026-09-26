import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function tursoApiDevPlugin() {
  return {
    name: 'turso-api-dev-middleware',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        let bodyData = '';
        req.on('data', (chunk: any) => { bodyData += chunk; });
        req.on('end', async () => {
          try {
            if (bodyData) {
              req.body = JSON.parse(bodyData);
            }
          } catch {}

          const customRes = {
            status(code: number) {
              res.statusCode = code;
              return customRes;
            },
            json(data: any) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return customRes;
            },
            setHeader(name: string, val: string) {
              res.setHeader(name, val);
              return customRes;
            }
          };

          if (req.url?.startsWith('/api/auth/login')) {
            try {
              const loginModule = await import('./api/auth/login.ts');
              await loginModule.default(req, customRes);
            } catch (err: any) {
              console.error('Error in Vite dev login middleware:', err);
              customRes.status(500).json({ error: err?.message || String(err) });
            }
            return;
          }

          if (req.url?.startsWith('/api/turso')) {
            try {
              const tursoModule = await import('./api/turso.ts');
              await tursoModule.default(req, customRes);
            } catch (err: any) {
              console.error('Error in Vite dev turso middleware:', err);
              customRes.status(500).json({ error: err?.message || String(err) });
            }
            return;
          }

          next();
        });
      });
    },
  };
}

export default defineConfig(() => {
  // Turso is server-side only. Never inject TURSO_* into the browser bundle.
  return {
    base: './',
    plugins: [
      tursoApiDevPlugin(),
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

