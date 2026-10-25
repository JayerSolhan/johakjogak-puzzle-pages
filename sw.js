// Public app shell only. Family photos remain in each device's IndexedDB.
const CACHE_NAME = 'jj-puzzle-public-041-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('jj-puzzle-public-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url=new URL(req.url);
  if (!SHELL.some(path => url.pathname === new URL(path,self.registration.scope).pathname)) return;
  event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
