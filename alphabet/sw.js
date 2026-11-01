// Alphabet Castle v1.7 — single-speaker audio cached for reliable offline iPad use.
const CACHE='unicorn-alphabet-v1-7-pages';
const PREFIX='unicorn-alphabet-';
const SOUND_FILES='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter=>'./audio/'+letter+'.mp3');
const CORE=['./','./index.html','./icon.svg','./manifest.webmanifest',...SOUND_FILES];
const ROOT=new URL('./',self.registration.scope);
const INDEX=new URL('./index.html',self.registration.scope);
const CORE_PATHS=new Set(CORE.map(file=>new URL(file,self.registration.scope).pathname));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
 .then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
 .then(()=>self.clients.claim()));
});
async function rangedAudio(req,cached){
 const buffer=await cached.arrayBuffer(),total=buffer.byteLength;
 const range=req.headers.get('range')||'';
 const found=/^bytes=(\d+)-(\d*)$/i.exec(range);
 if(!found)return cached;
 const start=Number(found[1]),end=found[2]?Math.min(total-1,Number(found[2])):total-1;
 if(start>=total||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
 const part=buffer.slice(start,end+1);
 return new Response(part,{status:206,headers:{
  'Content-Type':'audio/mpeg','Accept-Ranges':'bytes',
  'Content-Range':'bytes '+start+'-'+end+'/'+total,
  'Content-Length':String(part.byteLength)
 }});
}
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(ROOT.pathname))return;
 const isPage=req.mode==='navigate'||url.pathname===ROOT.pathname||url.pathname===INDEX.pathname;
 const isSound=url.pathname.startsWith(ROOT.pathname+'audio/')&&url.pathname.endsWith('.mp3');
 if(!isPage&&!CORE_PATHS.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  if(isSound){
   let saved=await cache.match(url.href);
   if(!saved){
    const full=new Request(url.href,{mode:'same-origin'});
    const response=await fetch(full);
    if(response.ok){await cache.put(url.href,response.clone());saved=response;}
   }
   if(saved)return req.headers.has('range')?rangedAudio(req,saved):saved;
   return fetch(req);
  }
  try{
   // Network-first navigation so installed apps receive new versions.
   const response=await fetch(req,{cache:'no-store'});
   if(response.ok&&response.type==='basic')await cache.put(isPage?INDEX.href:req,response.clone());
   return response;
  }catch(error){
   const saved=await cache.match(isPage?INDEX.href:req);
   if(saved)return saved;
   throw error;
  }
 })());
});
