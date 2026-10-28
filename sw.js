// App files are public. Parent photos and puzzle progress remain on-device only.
const CACHE_NAME = 'jj-puzzle-public-v05';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/puzzle.svg'];
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('jj-puzzle-public-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  const url=new URL(req.url);
  if(!CORE.some(path=>url.pathname===new URL(path,self.registration.scope).pathname))return;
  // Network-first for updates (avoids trapping families on a stale puzzle build).
  event.respondWith(fetch(req).then(resp=>{
    if(resp.ok&&resp.type==='basic'){const copy=resp.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));}
    return resp;
  }).catch(()=>caches.match(req)));
});
