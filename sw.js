// Offline-ready app shell + cached logos. ESPN data is never touched here (always live from the network).
var V = new URL(self.location.href).searchParams.get("v") || "0", CACHE = "sb-" + V, KEEP = [CACHE, "sb-img", "sb-font"];
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return KEEP.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Page: use the network, but fall back to the saved copy if it takes over 1.5s or fails.
function netFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return new Promise(function (res) {
      var done = false;
      var t = setTimeout(function () { c.match(req).then(function (m) { if (m && !done) { done = true; res(m); } }); }, 1500);
      fetch(req).then(function (r) {
        clearTimeout(t); if (r.ok) c.put(req, r.clone());
        if (!done) { done = true; res(r); }
      }, function () {
        clearTimeout(t);
        c.match(req).then(function (m) { if (!done) { done = true; res(m || Response.error()); } });
      });
    });
  });
}
// Versioned files (?v=N never change): saved copy first.
function cacheFirst(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { if (r.ok) c.put(req, r.clone()); return r; });
    });
  });
}
// Logos and fonts: show the saved copy now, refresh it quietly.
function swr(name, req) {
  return caches.open(name).then(function (c) {
    return c.match(req).then(function (m) {
      var f = fetch(req).then(function (r) { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }, function () { return m; });
      return m || f;
    });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === "navigate") e.respondWith(netFirst(req));
    else if (/[?&]v=/.test(u.search) && !/sw\.js$/.test(u.pathname)) e.respondWith(cacheFirst(req));
  } else if (u.hostname === "a.espncdn.com") e.respondWith(swr("sb-img", req));
  else if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") e.respondWith(swr("sb-font", req));
});
