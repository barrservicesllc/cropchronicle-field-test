const CACHE='cropchronicle-iphone-r1-v25';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./core.mjs','./ag-intel.mjs','./predictive.mjs','./providers.mjs','./map-engine.mjs','./vendor/maplibre-gl.mjs','./vendor/maplibre-gl-shared.mjs','./vendor/maplibre-gl-worker.mjs','./vendor/maplibre-gl.css','./manifest.webmanifest','./icon.svg'];
const LOCAL=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cropchronicle-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||!LOCAL.has(url.href))return;event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));}return response;}).catch(()=>caches.match('./index.html'))));});
