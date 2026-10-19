// Offline-ready app shell + cached logos. ESPN data is never touched here (always live from the network).
var V = new URL(self.location.href).searchParams.get("v") || "0", CACHE = "sb-" + V, KEEP = [CACHE, "sb-img", "sb-font"];
var SCOPE = self.registration.scope, SHELL = new Request(SCOPE);
// Is this a request for the page itself (any hash or query, with or without index.html)?
function isShell(u) { var sp = new URL(SCOPE).pathname; return u.pathname === sp || u.pathname === sp + "index.html"; }
// On install, save the page and every file it names (?v=N), so the first open after an update is instant too.
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return fetch(SHELL, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) return;
      return r.clone().text().then(function (t) {
        var urls = [], re = /(?:href|src)="([^"?]+\?v=(\d+))"/g, m, same = true;
        while ((m = re.exec(t))) { urls.push(m[1]); if (m[2] !== V) same = false; }
        if (!same) return;                 // the server's page belongs to another build; let the page handler sort it out
        ["fun.js", "fun.css", "profile.js"].forEach(function (f) { urls.push(f + "?v=" + V); });   // loaded later by the app, same build
        return c.put(SHELL, r).then(function () { return Promise.all(urls.map(function (u) { return c.add(new Request(u)).catch(function () {}); })); });
      });
    }).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return KEEP.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Page: the saved copy opens at once; the network copy is checked behind it and, if it changed, saved and announced
// to every open tab (the app shows "a new version is ready"). No saved copy yet: wait for the network.
function shell(e) {
  var req = e.request;
  return caches.open(CACHE).then(function (c) {
    return c.match(SHELL).then(function (m) {
      var m2 = m && m.clone();   // the page consumes m itself; the copy is what gets compared
      var net = fetch(req).then(function (r) {
        if (!r.ok) return r;
        if (!m2) { c.put(SHELL, r.clone()); return r; }
        return Promise.all([r.clone().text(), m2.text()]).then(function (tt) {
          if (tt[0] !== tt[1]) return c.put(SHELL, r.clone()).then(announce).then(function () { return r; });
          return r;
        });
      });
      if (m) { e.waitUntil(net.catch(function () {})); return m; }
      return net.catch(function () { return Response.error(); });
    });
  });
}
function announce() {
  return self.clients.matchAll({ type: "window" }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: "update" }); }); });
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
    if (req.mode === "navigate" && isShell(u)) e.respondWith(shell(e));
    else if (/[?&]v=/.test(u.search) && !/sw\.js$/.test(u.pathname)) e.respondWith(cacheFirst(req));
  } else if (u.hostname === "a.espncdn.com") e.respondWith(swr("sb-img", req));
  else if (u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") e.respondWith(swr("sb-font", req));
});
