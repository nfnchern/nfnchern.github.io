const CACHE = 'chordz-v32';
const FILES = ['./index.html', './manifest.json', './icon.svg', './app.css', './app.js', './progressions.js', './progression-graph.js'];
self.addEventListener('install', event => event.waitUntil(Promise.all([caches.open(CACHE).then(cache => cache.addAll(FILES)), self.skipWaiting()])));
self.addEventListener('activate', event => event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('./index.html'))));
});
