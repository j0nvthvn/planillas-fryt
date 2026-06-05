// Service worker mínimo — cumple los criterios de Chrome para PWA instalable.
// No cachea nada para que los datos de Supabase siempre sean frescos.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
self.addEventListener('fetch', () => {})
