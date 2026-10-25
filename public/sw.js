const CACHE_NAME = 'mypetid-shell-v3';
const CORE_ASSETS = ['/', '/dashboard/', '/manifest.webmanifest', '/images/logo/MyPetID-Logo_Resized.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only handle this site's own files. Cross-origin calls (Supabase REST/auth,
  // Google Maps, Stripe) and /api routes go straight to the network so that
  // signed-in API responses are never written to a shared on-device cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === 'basic') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => {
    if (cached) return cached;
    // Offline fallback to the app shell only for page navigations; returning
    // HTML for a missing script or image would just cause a second error.
    if (request.mode === 'navigate') return caches.match('/');
    return Response.error();
  })));
});
