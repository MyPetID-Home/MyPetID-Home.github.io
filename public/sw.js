const CACHE_NAME = 'mypetid-shell-v5';
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

// ---------- Web push (works while the app is closed) ----------
// The server (/api/push/dispatch) sends JSON: { title, body, url, kind, id }.
// Each notification kind gets its own tag so a new scan alert replaces the
// previous scan alert instead of stacking, while different kinds stay separate.
const PUSH_ICON = '/images/logo/icon-192.png';
const PUSH_BADGE = '/images/logo/favicon-96.png';

function sameOriginUrl(raw) {
  try {
    const url = new URL(raw || '/dashboard/', self.location.origin);
    // Only open pages on this site; anything else falls back to the dashboard.
    return url.origin === self.location.origin ? url.href : new URL('/dashboard/', self.location.origin).href;
  } catch (error) {
    return new URL('/dashboard/', self.location.origin).href;
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (error) { data = { body: event.data ? event.data.text() : '' }; }
  const title = (data.title || 'MyPetID').slice(0, 120);
  const kind = data.kind || 'info';
  const options = {
    body: (data.body || '').slice(0, 300),
    icon: PUSH_ICON,
    badge: PUSH_BADGE,
    tag: `mypetid-${kind}`,
    renotify: kind === 'scan' || kind === 'alert',
    requireInteraction: kind === 'alert',
    data: { url: sameOriginUrl(data.url), id: data.id || null, kind },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = sameOriginUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    // Prefer a window already on the target page, then any open MyPetID window.
    const exact = windows.find((client) => client.url === target);
    if (exact) return exact.focus();
    const any = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (any) return any.focus().then((client) => (client && 'navigate' in client ? client.navigate(target) : client)).catch(() => self.clients.openWindow(target));
    return self.clients.openWindow(target);
  }));
});
