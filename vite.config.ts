import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { VitePWA } from 'vite-plugin-pwa';

// Builds without these ship an app that dies on "Warming the Hearth..." (Firebase throws
// auth/invalid-api-key before React mounts), so refuse to build instead.
const REQUIRED_BUILD_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  if (command === 'build') {
    const missing = REQUIRED_BUILD_ENV.filter(key => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing env vars in .env.local: ${missing.join(', ')}`);
    }
  }
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Vesta Planner',
          short_name: 'Vesta',
          description: 'Your Digital Hearth for managing health and nutrition.',
          theme_color: '#FBF8F3',
          background_color: '#FBF8F3',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              // Artwork inside the 80% safe zone, for Android's circle/squircle masks
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Push reminder handlers (public/push-sw.js)
          importScripts: ['push-sw.js'],
          runtimeCaching: [
            {
              // The barcode reader (zxing-wasm, ~1 MB): cached on first scan rather than
              // precached, so people who never scan don't download it
              urlPattern: /\/assets\/zxing_reader-.*\.wasm$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'barcode-reader',
                expiration: { maxEntries: 2 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-framer': ['framer-motion'],
            'ui-recharts': ['recharts'],
            'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics'],
            'genai': ['@google/genai']
          }
        }
      }
    }
  };
});
