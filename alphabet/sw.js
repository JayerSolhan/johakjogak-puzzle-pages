// Alphabet Castle v1.6.0 — network-first for updated pages, cache for offline use.
const CACHE='unicorn-alphabet-v1-6-0-pages';
const PREFIX='unicorn-alphabet-';
const CORE=['./','./index.html','./icon.svg','./manifest.webmanifest'];
const ROOT=new URL('./',self.registration.scope);
const INDEX=new URL('./index.html',self.registration.scope);
const CORE_PATHS=new Set(CORE.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Cache the CC-licensed standalone pronunciation clips after their first successful playback.
  if(url.hostname==='upload.wikimedia.org'&&url.pathname.startsWith('/wikipedia/commons/')){
    event.respondWith((async()=>{
      const store=await caches.open(CACHE),cached=await store.match(req);
      if(cached)return cached;
      const live=await fetch(req);
      if(live.ok||live.type==='opaque')await store.put(req,live.clone());
      return live;
    })());return;
  }
  if(url.origin!==self.location.origin||!url.pathname.startsWith(ROOT.pathname))return;
  const isPage=req.mode==='navigate'||url.pathname===ROOT.pathname||url.pathname===INDEX.pathname;
  if(!isPage&&!CORE_PATHS.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      // Bypass the HTTP cache; newly published HTML should take effect on next open.
      const response=await fetch(req,{cache:'no-store'});
      if(response.ok&&response.type==='basic'){
        await cache.put(isPage?INDEX.href:req,response.clone());
      }
      return response;
    }catch(err){
      const saved=await cache.match(isPage?INDEX.href:req);
      if(saved)return saved;
      throw err;
    }
  })());
});
