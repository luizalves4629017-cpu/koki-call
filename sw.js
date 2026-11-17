const C='provas-v7';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(['index.html','manifest.json','conteudo.js','assunto.js','maiscai.js','fundo1.jpg','fundo2.jpg','fundo3.jpg'].map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{})}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))});
