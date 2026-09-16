/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": la app avisa "Hay una versión nueva" y el usuario decide
      // cuándo recargar; nunca se reemplaza el código a mitad de un cierre.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'logo.jpg', 'metodos/*.png'],
      manifest: {
        name: 'FrytControl — Minimarket Fryt',
        short_name: 'FrytControl',
        description: 'Registro de turnos, ventas y proveedores',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBF6EC',
        theme_color: '#5C3317',
        lang: 'es',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Cerrar turno', short_name: 'Cerrar', url: '/turno', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Hoy', short_name: 'Hoy', url: '/hoy', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Solo el shell de la app se precachea; los datos viven en React Query
        // (IndexedDB) y siempre se piden a Supabase.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fuentes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /\/storage\/v1\/object\/public\/logos-proveedores\//i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'logos', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // El service worker precachea todos los chunks; los <link modulepreload>
    // que Vite inyecta compiten con él y Chrome los descarta con un aviso
    // ("cross-world service worker resource mismatch"). Sin preload, los
    // chunks llegan igual desde la caché del SW.
    modulePreload: false,
    rollupOptions: {
      output: {
        // Solo se separan las dependencias que usa toda la app. recharts se
        // queda en el chunk de Análisis (carga diferida): en forma de objeto,
        // manualChunks lo convertía en dependencia del entry y se descargaba
        // en todas las pantallas.
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase'
          if (/node_modules\/(react|react-dom|scheduler|@tanstack\/(react-router|router-core|react-query|query-core|history))\//.test(id)) return 'vendor-react'
          return undefined
        },
      },
    },
  },
  test: {
    // Utilidades puras y el data layer corren en node; los tests de
    // componentes (.test.tsx) declaran `// @vitest-environment jsdom` arriba.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
