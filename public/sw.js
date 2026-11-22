// Önce ağ, ağ yoksa son önbellek. Supabase (başka adres) karışmaz.
const SURUM = 'v1';
self.addEventListener('install', (e) => { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { if (r.ok) { const k = r.clone(); caches.open(SURUM).then((c) => c.put(e.request, k)); } return r; })
      .catch(() => caches.match(e.request)),
  );
});
