const C = "market-pulse-v4";
const F = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => Promise.all(F.map(u => fetch(new Request(u, { cache: "reload" })).then(r => c.put(u, r)).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  // Only the app's own files are cached. Sheet data (docs.google.com) always goes to the network, the app keeps its own saved copy.
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.indexOf("/audio/") !== -1) return;
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
