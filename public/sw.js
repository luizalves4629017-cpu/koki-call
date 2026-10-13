// Service worker do eco: deixa o app instalável e abre a casca mesmo com rede lenta.
// Sempre busca na rede primeiro (o cache é só pra quando a internet cair), então depois de
// um deploy o "Reiniciar agora" já pega a versão nova. Página (index.html), /version e
// version.json nunca vêm do cache HTTP do navegador.
const CACHE = "eco-v2";
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/icon-192.png", "/icon-512.png"])).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("message", (e) => {
  if (e.data === "pular-espera") self.skipWaiting();
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/api/")) return;
  // Versão: sempre da rede, nunca guarda
  if (url.pathname === "/version" || url.pathname === "/version.json") return;
  const ehPagina = req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");
  const buscar = ehPagina ? fetch(req, { cache: "no-store" }) : fetch(req);
  e.respondWith(
    buscar
      .then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(ehPagina ? "/" : req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(ehPagina ? "/" : req).then((r) => r || caches.match("/")))
  );
});
