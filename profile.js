/* Profiles + Collection Log. Loaded only when the profile button is tapped. */
(function () {
  "use strict";
  var D = document, F = window.FUN, LS = localStorage;
  var PK = ["sb-followed", "sb-pins", "sb-tab", "sb-ysub", "sb-col"];   // data that belongs to a profile
  var ITER = 120000;
  function el(t, c, x) { var e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(txt, cls, fn) { var b = el("button", cls || "pm-b", txt); b.type = "button"; if (fn) b.onclick = fn; return b; }
  function g(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function s(k, v) { try { if (v == null) LS.removeItem(k); else LS.setItem(k, v); } catch (e) {} }
  function profiles() { try { return JSON.parse(g("sb-profiles") || "{}") || {}; } catch (e) { return {}; } }
  function putProfiles(p) { s("sb-profiles", JSON.stringify(p)); }
  function active() { var a = g("sb-active"); return a && profiles()[a] ? a : null; }
  function snapshot() { var o = {}; PK.forEach(function (k) { var v = g(k); if (v != null) o[k] = v; }); return o; }
  function b64(buf) { var a = new Uint8Array(buf), t = ""; for (var i = 0; i < a.length; i++) t += String.fromCharCode(a[i]); return btoa(t); }
  function unb64(x) { var t = atob(x), a = new Uint8Array(t.length); for (var i = 0; i < t.length; i++) a[i] = t.charCodeAt(i); return a; }
  function hashPw(pw, salt, it) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]).then(function (k) {
      return crypto.subtle.deriveBits({ name: "PBKDF2", salt: unb64(salt), iterations: it, hash: "SHA-256" }, k, 256);
    }).then(b64);
  }
  // Everything in a collection besides the cards (i), seen flags (s) and visit days (d): stats counters, pack meters,
  // packs owed, the favorite. Both merges used to drop these, which zeroed the stats page on every sync. Counters keep
  // the higher value (a sync never inflates), dates keep the earliest first visit and latest top-up, and the favorite
  // and the in-progress meters follow the copy given first (this device).
  function kd(k) { var p = String(k || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]).getTime() : 0; }
  function mergeExtra(o, a, b) {
    [a, b].forEach(function (c) {
      if (!c) return;
      Object.keys(c).forEach(function (k) {
        if (k === "i" || k === "s" || k === "d") return;
        var v = c[k], x = o[k];
        if (k === "tr") { var tt = o[k] || (o[k] = {}); Object.keys(v || {}).forEach(function (id) { tt[id] = Math.max(tt[id] || 0, v[id] || 0); }); return; }   // copies traded in: per card, the highest count
        if (x == null) { o[k] = v; return; }
        if (typeof v === "number" && typeof x === "number") o[k] = Math.max(x, v);
        else if (k === "d0") { if (kd(v) && kd(v) < kd(x)) o[k] = v; }
        else if (k === "ld") { if (kd(v) > kd(x)) o[k] = v; }
        else if (k === "ue") { if (v && x && (kd(v.d) > kd(x.d) || (v.d === x.d && v.n > x.n))) o[k] = v; }
        else if (Array.isArray(v) && Array.isArray(x)) { if (v.length > x.length) o[k] = v; }
      });
    });
    return o;
  }
  function mergeCol(a, b) {                       // union of two collections: earliest find, summed counts
    var o = { i: {}, s: {}, d: [] };
    [a, b].forEach(function (c) {
      if (!c) return;
      for (var k in (c.i || {})) { var e = c.i[k], x = o.i[k]; var n = x ? [Math.min(x[0], e[0]), x[1] + e[1]] : [e[0], e[1]]; if ((x && x[2]) || e[2]) n.push((x && x[2]) || e[2]); o.i[k] = n; }
      for (var k2 in (c.s || {})) o.s[k2] = 1;
      (c.d || []).forEach(function (d) { if (o.d.indexOf(d) < 0) o.d.push(d); });
    });
    o.d = o.d.slice(-60); return mergeExtra(o, a, b);
  }
  function parse(x) { try { return JSON.parse(x); } catch (e) { return null; } }
  function applyBlob(blob) { PK.forEach(function (k) { s(k, blob && blob[k] != null ? blob[k] : null); }); }

  // ---------- account actions ----------
  function validName(n) { return /^[A-Za-z0-9_.\-]{3,16}$/.test(n); }
  function create(name, pw) {
    var P = profiles(), l = name.toLowerCase();
    if (!validName(name)) return Promise.reject("Username: 3 to 16 letters, numbers, _ . -");
    if (P[l]) return Promise.reject("That username is taken on this device.");
    if (pw.length < 6) return Promise.reject("Password needs at least 6 characters.");
    // Claim the name online first: one person per name, everywhere (case-insensitive).
    return lbAuth("create", name, pw).catch(function (e) {
      e = String(e);
      if (/EMAIL_EXISTS/.test(e)) throw "That username is taken. If it's yours, use Log in.";
      if (/WEAK_PASSWORD/.test(e)) throw "Password needs at least 6 characters.";
      if (/TOO_MANY/.test(e)) throw "Too many tries. Wait a few minutes.";
      throw "Couldn't reach the server to claim that name. Check your connection and try again.";
    }).then(function () {
      var salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      return hashPw(pw, salt, ITER).then(function (h) {
        P[l] = { n: name, s: salt, h: h, it: ITER, d: snapshot(), c: Date.now() };
        putProfiles(P); s("sb-active", l);
        F.disc("mack");
        lbCache = null;
        return Promise.race([lbSync(true).then(function () { return savePush(true); }).catch(function () {}), new Promise(function (r) { setTimeout(r, 2500); })]);
      });
    });
  }
  function login(name, pw) {
    var P = profiles(), p = P[name.toLowerCase()];
    if (!p) return remoteLogin(name, pw);
    return hashPw(pw, p.s, p.it || ITER).then(function (h) {
      if (h !== p.h) throw "Wrong password.";
      var guest = parse(g("sb-col")), blob = p.d || {}, merged = mergeCol(parse(blob["sb-col"]), guest);
      if (!merged.i.mack) merged.i.mack = [Date.now(), 1];
      blob["sb-col"] = JSON.stringify(merged);
      applyBlob(blob); s("sb-active", name.toLowerCase());
      var go = function () { location.reload(); };
      Promise.race([lbJoin(name, pw, true), new Promise(function (r) { setTimeout(r, 2500); })]).then(go, go);
    });
  }
  function saveActive() { var a = active(); if (!a) return; var P = profiles(); P[a].d = snapshot(); putProfiles(P); }
  function logout() {
    saveActive(); var go = function () { applyBlob(null); s("sb-active", null); s("sb-lb", null); location.reload(); };
    Promise.race([savePush().catch(function () {}), new Promise(function (r) { setTimeout(r, 2500); })]).then(go, go);
  }
  function removeProfile() { var a = active(), P = profiles(); if (a) { delete P[a]; putProfiles(P); s("sb-active", null); s("sb-lb", null); } }



  // ---------- online leaderboard (Firebase REST: no SDK, loaded only here) ----------
  var FB = { key: "AIzaSyAJPV2xfmuK95zJwxaXbfVz9IWbUfdDCFI", pid: "scoreboard-b6d7e" };
  var DOC = "https://firestore.googleapis.com/v1/projects/" + FB.pid + "/databases/(default)/documents";
  var WT = { C: 1, U: 3, R: 8, E: 20, L: 50, M: 150, S: 200 };
  function myScore() { var c = F.col().i, sc = 0, n = 0; F.CAT.forEach(function (x) { if (c[x[0]]) { sc += WT[x[2]]; n++; } }); return { score: sc, cards: n }; }
  function lbGet() { return parse(g("sb-lb")); }
  function lbPut(o) { s("sb-lb", o ? JSON.stringify(o) : null); }
  function jpost(url, body, headers) {
    return fetch(url, { method: "POST", headers: headers || { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw (j.error && j.error.message) || "ERR"; return j; }); });
  }
  function lbAuth(mode, name, pw) {
    return jpost("https://identitytoolkit.googleapis.com/v1/accounts:" + (mode === "create" ? "signUp" : "signInWithPassword") + "?key=" + FB.key, { email: name.toLowerCase() + "@scoreboard.app", password: pw, returnSecureToken: true })
      .then(function (j) { var o = { uid: j.localId, rt: j.refreshToken, it: j.idToken, exp: Date.now() + (+j.expiresIn - 60) * 1000, name: name }; lbPut(o); return o; });
  }
  function lbJoin(name, pw, sync, rw) {            // one login for both: try to create the online account, else sign in
    if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(name) || pw.length < 6) return Promise.resolve(false);
    return lbAuth("create", name, pw).catch(function (e) { if (/EMAIL_EXISTS/.test(String(e))) return lbAuth("login", name, pw); throw e; })
      .then(function () { lbCache = null; return sync ? pullApply(!!rw).then(function (c) { lbJoin.changed = c; return lbSync(true); }).then(function () { return savePush(true); }) : 0; }).then(function () { return true; }, function () { return false; });
  }
  function lbToken() {
    var o = lbGet(); if (!o) return Promise.reject("NOAUTH");
    if (Date.now() < o.exp) return Promise.resolve(o);
    return jpost("https://securetoken.googleapis.com/v1/token?key=" + FB.key, "grant_type=refresh_token&refresh_token=" + encodeURIComponent(o.rt), { "Content-Type": "application/x-www-form-urlencoded" })
      .then(function (j) { o.it = j.id_token; o.rt = j.refresh_token; o.exp = Date.now() + (+j.expires_in - 60) * 1000; lbPut(o); return o; });
  }
  function lbSync(force) {                       // uploads only when the score changed
    var o0 = lbGet(); if (!o0) return Promise.resolve(); var m = myScore();
    if (!force && o0.last === m.score) return Promise.resolve();
    return lbToken().then(function (o) {
      var f = { name: { stringValue: o.name }, score: { integerValue: String(m.score) }, cards: { integerValue: String(m.cards) }, ts: { integerValue: String(Date.now()) } };
      return fetch(DOC + "/scores/" + o.uid, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + o.it }, body: JSON.stringify({ fields: f }) })
        .then(function (r) { if (!r.ok) throw "WRITE"; var o2 = lbGet() || o; o2.last = m.score; lbPut(o2); });
    });
  }
  // ---------- cloud save (whole profile in Firestore saves/{uid}, so any device can log in) ----------
  function sh(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
  function mergeMax(a, b) {                      // sync-safe union: earliest find, highest count (never inflates)
    var o = { i: {}, s: {}, d: [] };
    [a, b].forEach(function (c) {
      if (!c) return;
      for (var k in (c.i || {})) { var e = c.i[k], x = o.i[k]; var n = x ? [Math.min(x[0], e[0]), Math.max(x[1], e[1])] : [e[0], e[1]]; if ((x && x[2]) || e[2]) n.push((x && x[2]) || e[2]); o.i[k] = n; }
      for (var k2 in (c.s || {})) o.s[k2] = 1;
      (c.d || []).forEach(function (d) { if (o.d.indexOf(d) < 0) o.d.push(d); });
    });
    o.d.sort(function (x, y) { return kd(x) - kd(y); }); o.d = o.d.slice(-60); return mergeExtra(o, a, b);
  }
  function saveGet(o) {
    return fetch(DOC + "/saves/" + o.uid, { headers: { Authorization: "Bearer " + o.it } }).then(function (r) {
      if (r.status === 404) return null; if (!r.ok) throw "READ";
      return r.json().then(function (j) { return j && j.fields && j.fields.d ? parse(j.fields.d.stringValue) : null; });
    });
  }
  function savePush(force) {
    var o0 = lbGet(); if (!o0 || !active()) return Promise.resolve();
    saveActive(); var d = JSON.stringify(snapshot()), h = sh(d);
    if (!force && o0.sv === h) return Promise.resolve();
    return lbToken().then(function (o) {
      return fetch(DOC + "/saves/" + o.uid, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + o.it }, body: JSON.stringify({ fields: { d: { stringValue: d }, ts: { integerValue: String(Date.now()) } } }) })
        .then(function (r) { if (!r.ok) throw "WRITE"; var o2 = lbGet() || o; o2.sv = h; lbPut(o2); });
    });
  }
  function pullApply(remoteWins) {                // merge the cloud copy into this device; resolves true if anything changed
    return lbToken().then(saveGet).then(function (rb) {
      if (!rb) return false;
      var lb = snapshot(), o2 = lbGet() || {}, nb = {}, changed = false;
      PK.forEach(function (k) { nb[k] = lb[k]; });
      var lc = parse(lb["sb-col"]), mc = JSON.stringify(mergeMax(lc, parse(rb["sb-col"])));
      if (mc !== JSON.stringify(mergeMax(lc, null))) changed = true;
      nb["sb-col"] = mc;
      if (remoteWins || (o2.sv != null && o2.sv === sh(JSON.stringify(lb)))) {
        PK.forEach(function (k) { if (k !== "sb-col" && rb[k] != null && rb[k] !== lb[k]) { nb[k] = rb[k]; changed = true; } });
      }
      if (changed) { applyBlob(nb); saveActive(); }
      return changed;
    });
  }
  function remoteLogin(name, pw) {                // no local profile: sign in online, then build one from the cloud save
    if (!validName(name) || pw.length < 6) return Promise.reject("No profile with that name here. Create one first.");
    return lbAuth("login", name, pw).then(function (o) { return saveGet(o); }, function (e) { throw /EMAIL_NOT_FOUND|INVALID_LOGIN|INVALID_PASSWORD|INVALID_EMAIL/.test(String(e)) ? "Wrong username or password." : lbErr(e); })
      .then(function (rb) {
        var salt = b64(crypto.getRandomValues(new Uint8Array(16))), l = name.toLowerCase();
        return hashPw(pw, salt, ITER).then(function (h) {
          var blob = rb || {}, merged = mergeCol(parse(blob["sb-col"]), parse(g("sb-col")));
          if (!merged.i.mack) merged.i.mack = [Date.now(), 1];
          blob["sb-col"] = JSON.stringify(merged); applyBlob(blob);
          var P = profiles(); P[l] = { n: name, s: salt, h: h, it: ITER, d: snapshot(), c: Date.now() }; putProfiles(P); s("sb-active", l);
          var go = function () { location.reload(); };
          Promise.race([lbSync(true).then(function () { return savePush(true); }), new Promise(function (r) { setTimeout(r, 2500); })]).then(go, go);
        });
      });
  }
  var lbCache = null;
  function lbTop(force) {
    if (!force && lbCache && Date.now() - lbCache.at < 180000) return Promise.resolve(lbCache.rows);
    return jpost(DOC + ":runQuery", { structuredQuery: { from: [{ collectionId: "scores" }], orderBy: [{ field: { fieldPath: "score" }, direction: "DESCENDING" }], limit: 50 } })
      .then(function (j) {
        var rows = j.filter(function (x) { return x.document; }).map(function (x) { var f = x.document.fields || {}; return { uid: x.document.name.split("/").pop(), name: (f.name || {}).stringValue || "?", score: +((f.score || {}).integerValue || 0), cards: +((f.cards || {}).integerValue || 0) }; });
        lbCache = { at: Date.now(), rows: rows }; return rows;
      });
  }
  function lbRank(score) {
    return jpost(DOC + ":runAggregationQuery", { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: "scores" }], where: { fieldFilter: { field: { fieldPath: "score" }, op: "GREATER_THAN", value: { integerValue: String(score) } } } }, aggregations: [{ alias: "n", count: {} }] } })
      .then(function (j) { return 1 + +(((j[0] || {}).result || {}).aggregateFields || {}).n.integerValue; });
  }
  function lbErr(e) {
    e = String(e);
    if (/EMAIL_EXISTS/.test(e)) return "That username is taken. If it's yours, use Log in.";
    if (/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(e)) return "Wrong username or password.";
    if (/WEAK_PASSWORD/.test(e)) return "Password needs at least 6 characters.";
    if (/TOO_MANY/.test(e)) return "Too many tries. Wait a few minutes.";
    return "Leaderboard unavailable right now. Try again later.";
  }
  function vLb(body) {
    body.appendChild(el("p", "pm-lead", "Your score is your cards added up by rarity: Common 1, Uncommon 3, Rare 8, Epic 20, Legendary 50, Mythic 150. Your profile name and score are public."));
    var me = el("div", "lb-me"), list = el("div", "lb-list");
    body.appendChild(me); body.appendChild(list);
    function drawList(force) {
      list.innerHTML = ""; list.appendChild(el("p", "pm-note", "Loading…"));
      var o = lbGet();
      lbTop(force).then(function (rows) {
        list.innerHTML = "";
        if (!rows.length) { list.appendChild(el("p", "pm-note", "No scores yet. Be the first.")); return; }
        rows.forEach(function (r, i) {
          var row = el("div", "lb-row" + (o && o.uid === r.uid ? " me" : "") + (i < 3 ? " top" + (i + 1) : ""));
          row.appendChild(el("span", "lb-rk", i < 3 ? ["🥇", "🥈", "🥉"][i] : "#" + (i + 1)));
          row.appendChild(el("span", "lb-nm", r.name)); row.appendChild(el("span", "lb-cd", r.cards + " cards")); row.appendChild(el("span", "lb-sc", String(r.score)));
          list.appendChild(row);
        });
        var rf = btn("Refresh", "pm-b ghost", function () { rf.disabled = true; drawList(true); }); list.appendChild(rf);
      }, function () { list.innerHTML = ""; list.appendChild(el("p", "pm-msg", "Leaderboard unavailable right now. The rest of the app is unaffected.")); });
    }
    function drawMe() {
      me.innerHTML = ""; var o = lbGet(), m = myScore();
      if (o) {
        me.appendChild(el("div", "pm-name", o.name)); me.appendChild(el("div", "pm-sub", m.score + " pts · " + m.cards + " cards"));
        var msg = msg2(me);
        lbSync().then(function () { return lbRank(m.score); }).then(function (rk) { msg("Your rank: #" + rk, true); drawList(true); }, function (e) { msg(e === "WRITE" ? "Couldn't upload your score right now." : lbErr(e)); });
      } else {
        var a = active(), P = profiles();
        if (!a) { me.appendChild(el("p", "pm-note", "Log in or create a profile and you're on the leaderboard automatically.")); me.appendChild(btn("Go to profile", "pm-b pri", function () { show("home"); })); return; }
        var pn = P[a].n;
        if (!/^[A-Za-z0-9_.\-]{3,16}$/.test(pn)) { me.appendChild(el("p", "pm-note", "This profile's name can't be used online. Make a new profile with letters, numbers, _ . - only.")); return; }
        me.appendChild(el("div", "pm-name", pn)); me.appendChild(el("div", "pm-sub", m.score + " pts · " + m.cards + " cards"));
        me.appendChild(el("p", "pm-note", "Enter your profile password once to put this profile on the leaderboard."));
        var pw = field("Password", "password", "current-password"), m2 = msg2(me), go = btn("Join leaderboard", "pm-b pri");
        me.appendChild(pw[0]); me.appendChild(go);
        go.onclick = function () {
          go.disabled = true; m2("One sec…", true);
          hashPw(pw[1].value, P[a].s, P[a].it || ITER).then(function (h) {
            if (h !== P[a].h) throw "BADPW";
            return lbJoin(pn, pw[1].value, true);
          }).then(function (ok) { if (!ok) throw "NET"; lbCache = null; drawMe(); }, function (e) { go.disabled = false; m2(e === "BADPW" ? "Wrong password." : "Leaderboard unavailable right now. Try again later."); });
        };
        pw[1].onkeydown = function (e) { if (e.key === "Enter") go.onclick(); };
      }
    }
    var msg2 = msg;
    drawMe(); if (!lbGet()) drawList(false);
  }

  // ---------- UI shell ----------
  var root = null, hist = [];
  function open(view, arg) {
    if (!root) {
      root = el("div", "pm"); root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
      root.addEventListener("click", function (e) { if (e.target === root) close(); });
      D.body.appendChild(root); D.body.classList.add("pm-open");
      requestAnimationFrame(function () { root.classList.add("in"); });
    }
    show(view || "home", arg);
  }
  function close() {
    if (!root) return; var r = root; root = null; D.body.classList.remove("pm-open");
    r.classList.remove("in"); setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 220);
    refreshBtn();
  }
  function show(view, arg) {
    root.innerHTML = "";
    var sheet = el("div", "pm-sheet"); root.appendChild(sheet); sheet.scrollTop = 0;
    var top = el("div", "pm-top");
    if (view !== "home") top.appendChild(btn("‹ Back", "pm-back", function () { show("home"); }));
    top.appendChild(el("h2", "pm-h", { home: "Profile", log: "Collection Log", lb: "Leaderboard", stats: "Stats" }[view] || ""));
    var x = btn("✕", "pm-x", close); x.setAttribute("aria-label", "Close"); top.appendChild(x);
    sheet.appendChild(top);
    var sy0 = null;                                  // swipe down on the title bar to close
    top.addEventListener("touchstart", function (e) { sy0 = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
    top.addEventListener("touchend", function (e) { if (sy0 != null && e.changedTouches[0].clientY - sy0 > 70) close(); sy0 = null; });
    var body = el("div", "pm-body"); sheet.appendChild(body);
    ({ home: vHome, log: vLog, lb: vLb, stats: vStats })[view](body, arg);
  }
  function msg(parent) { var m = el("p", "pm-msg"); parent.appendChild(m); return function (t, ok) { m.textContent = t || ""; m.className = "pm-msg" + (ok ? " ok" : ""); }; }
  function field(label, type, ac, val) {
    var w = el("label", "pm-f"); w.appendChild(el("span", null, label));
    var i = el("input"); i.type = type; i.autocomplete = ac; i.autocapitalize = "none"; i.spellcheck = false; if (val) i.value = val; w.appendChild(i); return [w, i];
  }
  function summary(parent) {
    var n = F.count(), t = F.total, box = el("div", "pm-sum");
    box.appendChild(el("div", "pm-sumn", n + " / " + t)); box.appendChild(el("div", "pm-suml", "cards collected"));
    var bar = el("div", "pm-pg"), fill = el("i"); fill.style.width = Math.round(n / t * 100) + "%"; bar.appendChild(fill); box.appendChild(bar);
    parent.appendChild(box);
  }

  // ---------- account stats ----------
  function today0() { var t = new Date(); t.setHours(0, 0, 0, 0); return t.getTime(); }
  function vStats(body) {
    var a = active(), P = profiles(), p = a && P[a], col = F.col(), days = col.d || [], D = 864e5;
    var fmt = function (t) { return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };
    days = days.slice().sort(function (a, b) { return F.keyDate(a) - F.keyDate(b); });
    var first = col.d0 ? F.keyDate(col.d0) : (days.length ? F.keyDate(days[0]) : null);
    if (days.length && (!first || F.keyDate(days[0]) < first)) first = F.keyDate(days[0]);
    var since = p && p.c ? (first ? Math.min(p.c, first) : p.c) : first;   // whichever came first: the profile or the first visit
    var sd = since ? new Date(since) : null; if (sd) sd.setHours(0, 0, 0, 0);
    var age = sd ? Math.max(1, Math.round((today0() - sd) / D) + 1) : 0;
    var cur = F.streak(days), last = days.length ? F.keyDate(days[days.length - 1]) : 0, today = new Date(); today.setHours(0, 0, 0, 0);
    if (last && today - last > D) cur = 0;                          // the streak only counts if it reaches yesterday or today
    var longest = Math.max(col.ls || 0, cur), opened = Math.max(col.dn || 0, days.length);
    var owned = 0, dupes = 0, byR = {}, firstC = null, lastC = null, holo = 0;
    F.CAT.forEach(function (c) {
      var e = col.i[c[0]]; if (!e) return; owned++; dupes += F.spare(c[0]); byR[c[2]] = (byR[c[2]] || 0) + 1;
      if (!firstC || e[0] < firstC[0]) firstC = [e[0], c]; if (!lastC || e[0] > lastC[0]) lastC = [e[0], c];
      if (c.h) holo++;
    });
    var sc = myScore(), cf = (window.SB && SB.config) || {}, fol = (cf.followed || []).length, ppl = (cf.fp || []).length;
    var wd = [0, 0, 0, 0, 0, 0, 0]; days.forEach(function (k) { wd[new Date(F.keyDate(k)).getDay()]++; });
    var favD = wd.indexOf(Math.max.apply(null, wd)), DN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var hd = el("div", "pm-who"); hd.appendChild(el("span", "pm-av", p ? p.n.charAt(0).toUpperCase() : "★"));
    var w = el("div"); w.appendChild(el("div", "pm-name", p ? p.n : "This device")); w.appendChild(el("div", "pm-sub", since ? (p && since === p.c ? "Profile made " : "First visit ") + fmt(since) : "No visits logged yet")); hd.appendChild(w); body.appendChild(hd);
    function grid(title, tiles) {
      body.appendChild(el("h3", "ac-h", title)); var gr = el("div", "ac-grid");
      tiles.forEach(function (t) { if (!t) return; if (t.nodeType) { gr.appendChild(t); return; } if (t[0] == null) return; var c = el("div", "ac" + (t[2] ? " " + t[2] : "")); c.appendChild(el("b", null, String(t[0]))); c.appendChild(el("span", null, t[1])); gr.appendChild(c); });
      body.appendChild(gr);
    }
    grid("Account", [
      [age, age === 1 ? "day old" : "days old"],
      [opened, opened === 1 ? "day opened" : "days opened"],
      [cur, "day streak" + (cur ? " 🔥" : ""), cur >= 7 ? "hot" : ""],
      [longest, "longest streak"],
      [opened && age ? Math.min(100, Math.round(opened / age * 100)) + "%" : null, "of days visited"],
      [days.length ? DN[favD] : null, "favorite day"],
    ]);
    // The card you chose to show off (★ Favorite on any card you own). None yet: a shortcut to pick one.
    var fc = col.fav && col.i[col.fav] && F.IDX[col.fav], ft = el("button", "ac ac-fav" + (fc ? " r" + fc[2] : " none")); ft.type = "button";
    if (fc) {
      ft.appendChild(F.art(fc, "ac-art", 56, true));
      var fw = el("span", "ac-fw"); fw.appendChild(el("b", null, fc[4])); fw.appendChild(el("span", null, "\u2605 favorite card \u00b7 " + F.RAR[fc[2]])); ft.appendChild(fw);
      ft.onclick = function () { detail(fc, [fc], "Favorite card"); };
    } else if (owned) {
      ft.appendChild(el("b", null, "\u2606")); var fw2 = el("span", "ac-fw"); fw2.appendChild(el("b", null, "Pick a favorite")); fw2.appendChild(el("span", null, "Open any card you own and tap \u2605 Favorite")); ft.appendChild(fw2);
      ft.onclick = function () { show("log"); };
    } else ft = null;
    grid("Cards", [
      ft,
      [owned + " / " + F.total, "cards found"],
      [col.po || 0, (col.po === 1 ? "pack" : "packs") + " opened"],
      [F.packs ? F.packs().n : 0, "packs waiting"],
      [dupes, "duplicates"],
      [holo || null, "holiday cards"],
      [sc.score, "leaderboard score"],
      [firstC ? fmt(firstC[0]) : null, firstC ? "first card: " + firstC[1][4] : ""],
      [lastC ? fmt(lastC[0]) : null, lastC ? "latest: " + lastC[1][4] : ""],
    ]);
    var rr = el("div", "ac-rar"); ["C", "U", "R", "E", "L", "M", "S"].forEach(function (k) { var tot = F.CAT.filter(function (c) { return c[2] === k; }).length; if (!tot) return; var r = el("div", "ac-rr r" + k); r.appendChild(el("i", null, k)); r.appendChild(el("span", null, F.RAR[k])); var bar = el("div", "ac-bar"), fl = el("u"); fl.style.width = Math.round((byR[k] || 0) / tot * 100) + "%"; bar.appendChild(fl); r.appendChild(bar); r.appendChild(el("em", null, (byR[k] || 0) + "/" + tot)); rr.appendChild(r); });
    body.appendChild(rr);
    grid("Scoreboard", [
      [col.gv || 0, (col.gv === 1 ? "game" : "games") + " opened"],
      [col.tp || 0, col.tp === 1 ? "tap" : "taps"],
      [fol, fol === 1 ? "team followed" : "teams followed"],
      [ppl || null, ppl === 1 ? "person followed" : "people followed"],
    ]);
    if (lbGet()) {
      var rk = el("p", "pm-note", "Rank: …"); body.appendChild(rk);
      lbRank(sc.score).then(function (r) { rk.textContent = "Leaderboard rank: #" + r; }, function () { rk.textContent = ""; });
    }
    body.appendChild(el("p", "pm-note", "Days and streaks count from when this device first opened the app" + (p ? " (or the profile's own history once it syncs)" : "") + "."));
  }

  // ---------- home ----------
  function openSet() { close(); if (window.SB_SET) SB_SET(); }
  function vHome(body, arg) {
    var a = active(), P = profiles(), p = a && P[a];
    if (p) {
      if (!F.col().i.mack) F.disc("mack");
      var hd = el("div", "pm-who"); hd.appendChild(el("span", "pm-av", p.n.charAt(0).toUpperCase()));
      var w = el("div"); w.appendChild(el("div", "pm-name", p.n)); w.appendChild(el("div", "pm-sub", "Signed in on this device")); hd.appendChild(w); body.appendChild(hd);
      summary(body);
      var pk1 = F.packs ? F.packs() : { n: 0 };
      if (pk1.n) body.appendChild(btn("\uD83C\uDF81 Open pack (" + pk1.n + ")", "pm-b pri", function () { close(); F.openPacks(); }));
      body.appendChild(btn("Open Collection Log", pk1.n ? "pm-b" : "pm-b pri", function () { show("log"); }));
      body.appendChild(btn("Leaderboard", "pm-b", function () { show("lb"); }));
      body.appendChild(btn("Stats", "pm-b", function () { show("stats"); }));
      body.appendChild(btn("Settings", "pm-b", openSet));
      body.appendChild(btn("Log out", "pm-b", logout));

      return;
    }
    body.appendChild(el("p", "pm-lead", "Make a profile to keep your teams, settings and Collection Log saved online, and to join the leaderboard. Log in on any device to get it all back."));
    summary(body);
    var pk2 = F.packs ? F.packs() : { n: 0 };
    if (pk2.n) body.appendChild(btn("\uD83C\uDF81 Open pack (" + pk2.n + ")", "pm-b pri", function () { close(); F.openPacks(); }));
    body.appendChild(btn("Open Collection Log", "pm-b", function () { show("log"); }));
    body.appendChild(btn("Leaderboard", "pm-b", function () { show("lb"); }));
    body.appendChild(btn("Stats", "pm-b", function () { show("stats"); }));
    body.appendChild(btn("Settings", "pm-b", openSet));
    var tabs = el("div", "pm-seg"), mode = "login", form = el("div", "pm-form");
    var bl = btn("Log in", "on"), bc = btn("Create profile", "");
    tabs.appendChild(bl); tabs.appendChild(bc); body.appendChild(tabs); body.appendChild(form);
    var hasAny = Object.keys(P).length > 0;
    function draw() {
      form.innerHTML = ""; bl.className = mode === "login" ? "on" : ""; bc.className = mode === "create" ? "on" : "";
      var u = field("Username", "text", "username", arg && arg.name), pw = field("Password", "password", mode === "login" ? "current-password" : "new-password");
      form.appendChild(u[0]); form.appendChild(pw[0]);
      var m = msg(form), go = btn(mode === "login" ? "Log in" : "Create profile", "pm-b pri");
      go.onclick = function () {
        if (!u[1].value.trim() || !pw[1].value) { m("Enter a username and password."); return; }
        if (!window.crypto || !crypto.subtle) { m("This browser can't do secure login here."); return; }
        go.disabled = true; m("One sec…", true);
        (mode === "login" ? login : create)(u[1].value.trim(), pw[1].value).then(function () { show("home"); refreshBtn(); }, function (e) { go.disabled = false; m(typeof e === "string" ? e : "Something went wrong."); });
      };
      pw[1].onkeydown = function (e) { if (e.key === "Enter") go.onclick(); };
      form.appendChild(go);
      if (mode === "create") form.appendChild(el("p", "pm-note", "Username: letters, numbers, _ . - (3 to 16), and it's yours alone: no two people can have the same name. Password 6+. Your current teams, settings and cards become this profile's starting point, and it joins the online leaderboard."));
      if (mode === "login" && !hasAny) form.appendChild(el("p", "pm-note", "No profiles on this device yet. Log in with an existing account, or create one."));
    }
    bl.onclick = function () { mode = "login"; draw(); }; bc.onclick = function () { mode = "create"; draw(); };
    if (arg && arg.name) mode = "login"; else if (!hasAny) mode = "create";
    draw();
  }

  // ---------- collection log ----------
  var filter = "all", lq = "", lst = "all", lr = {}, srt = false, logRefresh = null, fOv = null, RL = { C: "C", U: "U", R: "R", E: "E", L: "L", M: "M", S: "S" };
  function pad(n) { return ("00" + n).slice(-3); }
  function vLog(body, arg) {
    var col = F.col(), RK = ["C", "U", "R", "E", "L", "M", "S"];
    summary(body);
    (function () {
      var u = F.upcoming(), t = [];
      if (u.on.length) t.push("<b>Dropping now:</b> " + u.on.map(function (x) { return x.name + " until " + x.end; }).join(", "));
      if (u.next) t.push("<b>Next:</b> " + u.next.name + ", " + u.next.start + " to " + u.next.end);
      if (t.length) { var h = el("p", "pm-hol"); h.innerHTML = t.join("<span>·</span>"); body.appendChild(h); }
    })();
    var grid = el("div", "pm-grid");
    function fresh() { return F.CAT.filter(function (c) { return col.i[c[0]] && !col.s[c[0]]; }); }
    var nw = fresh(); if (lst === "new" && !nw.length) lst = "all";
    // New cards and trade-in sit side by side; each hides when there's nothing to do, the other takes the full row.
    var acts = el("div", "pm-acts");
    var rv = btn("", "pm-b pri pm-rv", function () { if (nw.length) detail(nw[0], nw, "New cards"); });
    var trb = btn("♻ Trade in dupes", "pm-b", function () { tradeSheet(function (full) { if (logRefresh) logRefresh(full); }); });
    acts.appendChild(rv); acts.appendChild(trb); body.appendChild(acts);
    function actShow() {
      rv.hidden = !nw.length; rv.textContent = "✨ " + nw.length + " new card" + (nw.length > 1 ? "s" : "");
      trb.hidden = !Object.keys(F.spareBy().r).length; acts.hidden = rv.hidden && trb.hidden;
      acts.classList.toggle("two", !rv.hidden && !trb.hidden);
    }
    actShow();
    // Search, the Show switch (always one row, no sideways scrolling) and a Filters button for set, rarity and sort.
    var qi = el("input", "pm-q"); qi.type = "search"; qi.placeholder = "Search cards, teams, moments"; qi.value = lq; qi.autocomplete = "off"; qi.spellcheck = false; qi.setAttribute("aria-label", "Search cards");
    qi.onkeydown = function (e) { if (e.key === "Escape") { e.stopPropagation(); if (qi.value) { qi.value = ""; qi.dispatchEvent(new Event("input")); } else qi.blur(); } else if (e.key === "Enter") qi.blur(); };
    var qt = 0; qi.oninput = function () { lq = qi.value; clearTimeout(qt); qt = setTimeout(function () { drawPills(); drawGrid(); }, 70); };
    var fbtn = el("button", "pm-fb"); fbtn.type = "button"; fbtn.setAttribute("aria-label", "Filters");
    fbtn.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M8.5 15h3"/></svg><span>Filters</span><b></b>';
    fbtn.onclick = function () { filterSheet(); };
    var srow = el("div", "pm-srow"); srow.appendChild(window.SB && SB.clearable ? SB.clearable(qi) : qi); srow.appendChild(fbtn);
    var seg = el("div", "pm-show"), pills = el("div", "pm-pills"), cnt = el("p", "pm-note pm-cnt");
    function nExtra() { return (filter !== "all" ? 1 : 0) + Object.keys(lr).length + (srt ? 1 : 0); }
    function active2() { return !!(lq.trim() || lst !== "all" || nExtra()); }
    function reset() { lq = ""; qi.value = ""; lst = "all"; lr = {}; srt = false; filter = "all"; }
    function drawSeg() {
      seg.innerHTML = "";
      var opts = [["all", "All"], ["new", "New"], ["got", "Found"], ["miss", "Missing"], ["dup", "Dupes"]];
      opts.forEach(function (x) {
        if (x[0] === "new" && !nw.length) return;
        var b = btn("", lst === x[0] ? "on" : "", function () { if (lst === x[0]) return; lst = x[0]; drawSeg(); drawPills(); drawGrid(); });
        b.appendChild(D.createTextNode(x[1])); if (x[0] === "new") b.appendChild(el("i", null, String(nw.length)));
        b.setAttribute("aria-pressed", lst === x[0] ? "true" : "false"); seg.appendChild(b);
      });
      seg.style.setProperty("--n", seg.children.length);
    }
    function pill(label, cls, fn) { var b = btn(label, "pm-pill" + (cls ? " " + cls : ""), fn); pills.appendChild(b); return b; }
    function drawPills() {
      pills.innerHTML = ""; var n = nExtra(), fb = fbtn.querySelector("b"); fb.textContent = n || ""; fbtn.classList.toggle("on", n > 0);
      if (filter !== "all") pill(F.CATS[filter] + " ✕", null, function () { filter = "all"; drawPills(); drawGrid(); });
      RK.forEach(function (k) { if (lr[k]) { var p = pill("", "r" + k, function () { delete lr[k]; drawPills(); drawGrid(); }); p.appendChild(el("i", null, k)); p.appendChild(D.createTextNode(F.RAR[k] + " ✕")); } });
      if (srt) pill("Newest first ✕", null, function () { srt = false; drawPills(); drawGrid(); });
      if (lst === "new" && nw.length) pill("✓ Mark all seen", "ok", function () { nw.forEach(function (c) { F.seen(c[0]); }); logRefresh(true); });
      if (n > 1 || (n && (lq.trim() || lst !== "all"))) pill("Clear all", "clr", function () { reset(); draw(); });
      pills.hidden = !pills.children.length;
    }
    function vis(c, ign) {
      var id = c[0], got = !!col.i[id];
      if (ign !== "set" && filter !== "all" && c[1] !== filter) return false;
      if (lst === "new" && !(got && !col.s[id])) return false;
      if (lst === "got" && !got) return false; if (lst === "miss" && got) return false; if (lst === "dup" && !(got && F.spare(id) > 0)) return false;
      if (ign !== "rar" && Object.keys(lr).length && !lr[c[2]]) return false;
      var q = lq.trim().toLowerCase();
      if (q) {
        var hay = (c[4] + " " + F.CATS[c[1]] + " " + F.RAR[c[2]] + " " + (F.KW[id] || []).join(" ") + (got || id.indexOf("mo_") === 0 ? " " + c[5] : "")).toLowerCase();
        if (!q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
      }
      return true;
    }
    function draw() { drawSeg(); drawPills(); drawGrid(); }
    // ---------- the Filters sheet: sort, set, rarity; the grid behind redraws once, when it closes ----------
    function filterSheet() {
      if (fOv) return;
      var ov = el("div", "tcd fsh"), box = el("div", "flt"); ov.appendChild(box); fOv = ov;
      var s0 = JSON.stringify([filter, lr, srt]);
      function shut() { if (fOv !== ov) return; fOv = null; ov.classList.remove("in"); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200); drawPills(); if (JSON.stringify([filter, lr, srt]) !== s0) drawGrid(); try { fbtn.focus({ preventScroll: true }); } catch (e) {} }
      ov.shut = shut; ov.onclick = function (e) { if (e.target === ov) shut(); };
      var sy = null; box.addEventListener("touchstart", function (e) { sy = box.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
      box.addEventListener("touchend", function (e) { if (sy != null && e.changedTouches[0].clientY - sy > 70) shut(); sy = null; });
      function sec(t, aside) { var h = el("div", "flt-h"); h.appendChild(el("span", null, t)); if (aside) h.appendChild(aside); box.appendChild(h); }
      var go;
      function paint() {
        var y = box.scrollTop; box.innerHTML = "";
        box.appendChild(el("i", "flt-grab"));
        var hd = el("div", "flt-top"); hd.appendChild(el("h3", null, "Filters"));
        hd.appendChild(btn("Reset", "flt-rs", function () { filter = "all"; lr = {}; srt = false; paint(); })); box.appendChild(hd);
        sec("Sort");
        var so = el("div", "pm-seg flt-so");
        [[false, "Card number"], [true, "Newest found"]].forEach(function (x) { so.appendChild(btn(x[1], srt === x[0] ? "on" : "", function () { srt = x[0]; paint(); })); });
        box.appendChild(so);
        sec("Set");
        var sets = el("div", "flt-sets");
        var keys = ["all"].concat(Object.keys(F.CATS));
        keys.forEach(function (k) {
          var tot = 0, fnd = 0; F.CAT.forEach(function (c) { if (k === "all" || c[1] === k) { tot++; if (col.i[c[0]]) fnd++; } });
          var b = el("button", "flt-set" + (filter === k ? " on" : "") + (fnd >= tot ? " done" : "")); b.type = "button";
          b.appendChild(el("span", "flt-sn", k === "all" ? "All sets" : F.CATS[k]));
          b.appendChild(el("span", "flt-sc", fnd + "/" + tot + (fnd >= tot ? " ✓" : "")));
          var pg = el("i", "flt-pg"); pg.style.setProperty("--p", (fnd / tot * 100).toFixed(1) + "%"); b.appendChild(pg);
          b.onclick = function () { filter = k; paint(); }; sets.appendChild(b);
        });
        box.appendChild(sets);
        var anyR = Object.keys(lr).length;
        sec("Rarity", anyR ? btn("Any", "flt-rs", function () { lr = {}; paint(); }) : null);
        var rr = el("div", "flt-rar");
        RK.forEach(function (k) {
          var tot = 0, fnd = 0; F.CAT.forEach(function (c) { if (c[2] === k && (filter === "all" || c[1] === filter)) { tot++; if (col.i[c[0]]) fnd++; } });
          if (!tot) return;
          var b = el("button", "flt-r r" + k + (lr[k] ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", lr[k] ? "true" : "false");
          b.appendChild(el("i", null, k)); b.appendChild(el("span", null, F.RAR[k])); b.appendChild(el("em", null, fnd + "/" + tot));
          b.onclick = function () { if (lr[k]) delete lr[k]; else lr[k] = 1; paint(); }; rr.appendChild(b);
        });
        box.appendChild(rr);
        var n = F.CAT.filter(function (c) { return vis(c); }).length;
        var ft = el("div", "flt-ft"); go = btn(n ? "Show " + n + " card" + (n > 1 ? "s" : "") : "No cards match", "pm-b pri", shut); go.disabled = !n; ft.appendChild(go); box.appendChild(ft);
        box.scrollTop = y;
      }
      paint();
      (root || D.body).appendChild(ov); requestAnimationFrame(function () { ov.classList.add("in"); });
      try { go.focus({ preventScroll: true }); } catch (e) {}
    }
    var gtok = 0, last = null;
    function tile(c, vl, lb, sub, n) {
      var got = !!col.i[c[0]], b = el("button", "tcm r" + c[2] + (got ? " got" : " lock")); b.type = "button"; b.dataset.id = c[0];
      b.setAttribute("aria-label", c[4] + ", " + F.RAR[c[2]] + (got ? (F.owned(c[0]) > 1 ? ", " + F.owned(c[0]) + " copies" : ", found") : ", not found yet"));
      b.style.setProperty("--i", Math.min(n, 11));
      b.appendChild(el("span", "tcm-no", "#" + pad(c.n)));
      b.appendChild(F.art(c, "tcm-art", 84, got));
      b.appendChild(el("span", "tcm-n", c[4]));
      b.appendChild(el("i", "tcm-r", RAR(c[2])));
      if (got && !col.s[c[0]]) b.appendChild(el("u", "tcm-new", "NEW"));
      if (got && F.owned(c[0]) > 1) b.appendChild(el("span", "tcm-x", "×" + F.owned(c[0])));
      b.onclick = function () { detail(c, sub ? vl : null, lb); };
      return b;
    }
    function drawGrid() {
      var my = ++gtok; grid.innerHTML = ""; var vl = F.CAT.filter(function (c) { return vis(c); }), lb = lst === "new" ? "New cards" : "Results", sub = active2();
      last = [vl, lb, sub];
      if (srt) vl.sort(function (x, y) { var ex = col.i[x[0]], ey = col.i[y[0]]; return (ey ? ey[0] : 0) - (ex ? ex[0] : 0) || x.n - y.n; });
      cnt.textContent = sub ? vl.length + " of " + F.CAT.length + " cards" + (srt ? " · newest first" : "") : ""; cnt.hidden = !sub;
      if (!vl.length) {
        var none = el("div", "pm-none"); none.appendChild(el("p", "pm-note", "No cards match."));
        if (sub) none.appendChild(btn("Clear filters", "pm-b", function () { reset(); draw(); }));
        grid.appendChild(none); return;
      }
      // The first screenful goes in at once, the rest a slice per frame (the log can hold 470+ cards).
      var i = 0;
      function add(n) { var end = Math.min(vl.length, i + n), fr = D.createDocumentFragment(); for (; i < end; i++) fr.appendChild(tile(vl[i], vl, lb, sub, i)); grid.appendChild(fr); }
      add(36);
      if (i < vl.length) requestAnimationFrame(function more() { if (my !== gtok || !grid.isConnected) return; add(120); if (i < vl.length) requestAnimationFrame(more); });
    }
    // A card was viewed (or one arrived while the log is open): update in place, keeping the scroll position.
    logRefresh = function (full) {
      var had = nw.length; nw = fresh(); var gone = lst === "new" && !nw.length; if (gone) lst = "all";
      actShow(); if (!!had !== !!nw.length || gone) drawSeg(); else { var ni = seg.querySelector("i"); if (ni) ni.textContent = nw.length; }
      drawPills();
      if (full || gone || lst === "new") { drawGrid(); return; }
      if (nw.length > had && last) nw.forEach(function (c) { var t0 = grid.querySelector('.tcm[data-id="' + c[0] + '"]'); if (t0 && !t0.querySelector(".tcm-new")) t0.replaceWith(tile(c, last[0], last[1], last[2], 0)); });   // a card arrived: swap just its tile
      var us = grid.querySelectorAll(".tcm-new");
      for (var k = 0; k < us.length; k++) if (col.s[us[k].parentNode.dataset.id]) us[k].remove();
    };
    function RAR(k) { return RL[k]; }
    var stk = el("div", "pm-stk"); stk.appendChild(srow); stk.appendChild(seg); stk.appendChild(pills); body.appendChild(stk); body.appendChild(cnt); body.appendChild(grid); draw();
    if (arg && arg.card && F.IDX[arg.card]) detail(F.IDX[arg.card], null);
    var lg = el("div", "pm-key");
    RK.forEach(function (k) { var s2 = el("span", "r" + k); s2.appendChild(el("i", null, k)); s2.appendChild(D.createTextNode(F.RAR[k])); lg.appendChild(s2); });
    body.appendChild(lg);
    body.dataset.keep = "1";
  }

  // ---------- trade in dupes: spare copies for packs; what each is worth is never shown ----------
  // The sheet remembers its last filters while the page is open. Rarities, a group (teams / moments / holidays /
  // effects) and how many copies to keep of each card narrow what "Trade in" takes.
  var trOv = null, trS = { r: { C: 1, U: 1, R: 1, E: 1 }, g: null, keep: 1 };
  var TRG = { t: "Teams", m: "Moments", h: "Holidays", e: "Effects" };
  function tradeSheet(done) {
    if (trOv) return;
    var ov = el("div", "tcd"), box = el("div", "trd"); ov.appendChild(box); trOv = ov;
    function shut() { if (trOv !== ov) return; trOv = null; ov.classList.remove("in"); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 180); }
    ov.shut = shut; ov.onclick = function (e) { if (e.target === ov) shut(); };
    var plural = function (n, w) { return n + " " + w + (n > 1 ? "s" : ""); }, RK = ["C", "U", "R", "E", "L", "M"];
    function same(r) { return RK.every(function (k) { return !!trS.r[k] === !!r[k]; }); }
    function draw() {
      var keepY = box.scrollTop; box.innerHTML = "";
      var cnt = F.spareBy({ g: trS.g, keep: trS.keep });
      if (trS.g && !Object.keys(cnt.r).length) { trS.g = null; cnt = F.spareBy({ keep: trS.keep }); }   // a group with nothing spare under this keep setting
      box.appendChild(el("h3", "trd-h", "Trade in dupes"));
      box.appendChild(el("p", "trd-n", "Spare copies only. The rarer the card, the more it counts."));
      var pre = el("div", "pm-chips trd-ch");
      [["Commons", { C: 1 }], ["Up to Rare", { C: 1, U: 1, R: 1 }], ["Everything", { C: 1, U: 1, R: 1, E: 1, L: 1, M: 1 }], ["None", {}]].forEach(function (x) {
        pre.appendChild(btn(x[0], "pm-chip" + (same(x[1]) ? " on" : ""), function () { trS.r = Object.assign({}, x[1]); draw(); }));
      });
      box.appendChild(pre);
      var rows = el("div", "trd-rows");
      RK.forEach(function (k) {
        if (!cnt.r[k]) return;
        var b = el("button", "trd-r r" + k + (trS.r[k] ? " on" : "")); b.type = "button"; b.setAttribute("aria-pressed", trS.r[k] ? "true" : "false");
        b.appendChild(el("i", null, k)); b.appendChild(el("span", null, F.RAR[k])); b.appendChild(el("b", null, "\u00d7" + cnt.r[k]));
        b.onclick = function () { if (trS.r[k]) delete trS.r[k]; else trS.r[k] = 1; draw(); }; rows.appendChild(b);
      });
      box.appendChild(rows);
      var gs = Object.keys(cnt.g);
      if (gs.length > 1 || trS.g) {
        var gc = el("div", "pm-chips trd-ch"); gc.appendChild(btn("Everything", "pm-chip" + (!trS.g ? " on" : ""), function () { trS.g = null; draw(); }));
        ["t", "m", "h", "e"].forEach(function (k) { if (cnt.g[k]) gc.appendChild(btn(TRG[k] + " \u00d7" + cnt.g[k], "pm-chip" + (trS.g === k ? " on" : ""), function () { trS.g = trS.g === k ? null : k; draw(); })); });
        box.appendChild(gc);
      }
      var kp = el("div", "trd-keep"); kp.appendChild(el("span", null, "Keep"));
      var seg = el("div", "pm-seg"); [1, 2, 3].forEach(function (n) { seg.appendChild(btn(n + (n > 1 ? " copies" : " copy"), n === trS.keep ? "on" : "", function () { trS.keep = n; draw(); })); }); kp.appendChild(seg); box.appendChild(kp);
      var q = F.tradeQuote({ r: trS.r, g: trS.g, keep: trS.keep }), big = q.cards && (trS.r.L || trS.r.M) && (cnt.r.L || cnt.r.M);
      box.appendChild(el("p", "trd-q" + (q.packs ? " ok" : ""), q.packs ? "Trade " + plural(q.cards, "spare card") + " for " + plural(q.packs, "card pack") + "." : (q.cards ? "That's not enough for a pack yet." : "Nothing picked to trade in.")));
      if (big) box.appendChild(el("p", "trd-w", "This includes Legendary or Mythic cards."));
      var row = el("div", "tcd-c");
      var go = btn(q.packs ? "Trade in" : "Not yet", "pm-b pri", function () { var res = F.tradeIn({ r: trS.r, g: trS.g, keep: trS.keep }); if (!res) return; if (done) done(true); result(res); }); go.disabled = !q.packs;
      row.appendChild(go); row.appendChild(btn("Cancel", "pm-b", shut)); box.appendChild(row);
      box.scrollTop = keepY;
    }
    function result(res) {
      box.innerHTML = ""; box.appendChild(el("div", "trd-i", "\uD83C\uDF81")); box.appendChild(el("h3", "trd-h", plural(res.packs, "card pack") + " added"));
      box.appendChild(el("p", "trd-n", "Traded in " + plural(res.cards, "spare card") + "."));
      var row = el("div", "tcd-c"); row.appendChild(btn("Open now", "pm-b pri", function () { shut(); close(); F.openPacks(); })); row.appendChild(btn("Later", "pm-b", shut)); box.appendChild(row);
    }
    draw(); (root || D.body).appendChild(ov); requestAnimationFrame(function () { ov.classList.add("in"); });
  }

  var dRoot = null, dCur = null, dList = null, dLbl = "New cards", dFrom = null;
  function detail(c, list, lbl, dir) {
    if (list !== undefined) { dList = list; dLbl = lbl || "Results"; }
    var col = F.col(), got = !!col.i[c[0]], L = dList || F.CAT, idx = L.indexOf(c);
    if (got) F.seen(c[0]);
    // Moving between cards keeps the backdrop and slides the card in from the side you're heading.
    var ov = dRoot && dRoot.parentNode ? dRoot : null, reuse = !!ov;
    if (!ov) { ov = el("div", "tcd"); dRoot = ov; ov.onclick = function (e) { if (e.target === ov) closeD(); }; dFrom = D.activeElement && D.activeElement.classList && D.activeElement.classList.contains("tcm") ? D.activeElement : null; }
    var wrap = el("div", "tcd-w" + (reuse && dir ? (dir > 0 ? " from-r" : " from-l") : "")), card = el("div", "tc r" + c[2] + (got ? " got" : " lock"));
    var head = el("div", "tc-h"); head.appendChild(el("span", null, "No. " + pad(c.n) + " / " + pad(F.total))); var cf = 0, ct = 0; F.CAT.forEach(function (x) { if (x[1] === c[1]) { ct++; if (col.i[x[0]]) cf++; } });
    head.appendChild(el("span", null, F.CATS[c[1]] + " \u00b7 " + cf + "/" + ct)); card.appendChild(head);
    var art = el("div", "tc-art"); art.appendChild(F.art(c, "tc-em", 200, got)); card.appendChild(art);
    card.appendChild(el("h3", "tc-n", c[4]));
    var rb = el("div", "tc-rar"); rb.appendChild(el("i", null, c[2])); rb.appendChild(D.createTextNode(F.RAR[c[2]])); card.appendChild(rb);
    var dsc = el("p", "tc-d", c[5]); card.appendChild(dsc); if (c[5].length > 140) card.classList.add("story");
    if (got) {
      var e = col.i[c[0]]; card.appendChild(el("p", "tc-f", "First found " + new Date(e[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + (F.owned(c[0]) > 1 ? " \u00b7 \u00d7" + F.owned(c[0]) + " (" + (F.owned(c[0]) - 1) + (F.owned(c[0]) > 2 ? " dupes)" : " dupe)") : "")));
    } else card.appendChild(el("p", "tc-f", "Not found yet."));
    card.appendChild(el("span", "tc-foil"));
    if (!F.reduced) {
      card.addEventListener("pointermove", function (ev) {
        var r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        card.style.setProperty("--ry", ((x - .5) * 16).toFixed(1) + "deg"); card.style.setProperty("--rx", ((.5 - y) * 16).toFixed(1) + "deg");
        card.style.setProperty("--mx", (x * 100).toFixed(0) + "%"); card.style.setProperty("--my", (y * 100).toFixed(0) + "%");
      });
      card.addEventListener("pointerleave", function () { card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg"); });
    }
    var sx = null;
    ov.addEventListener("touchstart", function (ev) { sx = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
    ov.addEventListener("touchend", function (ev) { if (sx == null) return; var dx = ev.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) nav(dx < 0 ? 1 : -1); }, { passive: true });
    if (dList) {
      var q = el("div", "tcd-q"); q.appendChild(el("span", null, dLbl + " \u00b7 " + (idx + 1) + " of " + L.length));
      var pg = el("div", "tcd-pg"), pf = el("i"); pf.style.width = Math.round((idx + 1) / L.length * 100) + "%"; pg.appendChild(pf); q.appendChild(pg); wrap.appendChild(q);
    }
    wrap.appendChild(card);
    var ctl = el("div", "tcd-c");
    function nav(d) {
      if (dList) { var n2 = idx + d; if (n2 < 0) return; if (n2 >= L.length) { closeD(); return; } detail(L[n2], undefined, undefined, d); return; }
      var n = (idx + d + F.CAT.length) % F.CAT.length; detail(F.CAT[n], undefined, undefined, d);
    }
    dCur = nav;
    var pb = btn("\u2039", "pm-b tcd-n", function () { nav(-1); }); if (dList && idx === 0) pb.disabled = true; pb.setAttribute("aria-label", "Previous card"); ctl.appendChild(pb);
    var pl = /^[wlcb]_/.test(c[0]);
    if (got && pl) ctl.appendChild(btn("▶ Replay", "pm-b", function () { F.play(c[0], card); }));
    if (got && /^[RELMS]$/.test(c[2])) ctl.appendChild(btn("✨ Reveal", "pm-b", function () { F.reveal(c); }));
    if (got) {   // the favorite card is what the stats page shows off
      var isFav = function () { return F.col().fav === c[0]; };
      var fb = btn(isFav() ? "\u2605 Favorite" : "\u2606 Favorite", "pm-b tcd-fav" + (isFav() ? " on" : ""), function () {
        var cl = F.col(); if (isFav()) delete cl.fav; else cl.fav = c[0]; F.saveCol();
        fb.textContent = isFav() ? "\u2605 Favorite" : "\u2606 Favorite"; fb.classList.toggle("on", isFav());
        if (window.SB && SB.toast) SB.toast(isFav() ? c[4] + " is your favorite card" : "Favorite cleared");
        if (root && root.querySelector(".ac-grid")) show("stats");   // opened from the stats page: refresh the tile behind
      });
      fb.setAttribute("aria-pressed", isFav() ? "true" : "false"); ctl.appendChild(fb);
    }
    ctl.appendChild(btn("Close", "pm-b", closeD));
    var last = dList && idx === L.length - 1, nb = btn(last ? "\u2713" : "\u203a", "pm-b tcd-n" + (last ? " done" : ""), function () { nav(1); }); nb.setAttribute("aria-label", last ? "Done" : "Next card"); ctl.appendChild(nb);
    wrap.appendChild(ctl);
    if (reuse) { var old = ov.querySelector(".tcd-w"); if (old) ov.replaceChild(wrap, old); else ov.appendChild(wrap); }
    else { ov.appendChild(wrap); (root || D.body).appendChild(ov); requestAnimationFrame(function () { ov.classList.add("in"); }); }
    if (dList) try { nb.focus({ preventScroll: true }); } catch (e) {}
    if (got && (c[2] === "L" || c[2] === "M" || c[2] === "S") && !F.reduced) F.confetti(24, ["✨", "⭐"]);
  }
  function closeD() { if (!dRoot) return; var d = dRoot, back = dFrom; dRoot = null; dList = null; dFrom = null; d.classList.remove("in"); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 180);
    if (root && root.querySelector(".pm-grid") && logRefresh) { logRefresh(); if (back) { var again = root.querySelector('.tcm[data-id="' + back.dataset.id + '"]'); if (again) try { again.focus({ preventScroll: true }); } catch (e) {} } } }

  // ---------- header button ----------
  function refreshBtn() {
    var b = D.getElementById("prof"); if (!b) return;
    var a = active(), p = a && profiles()[a];
    b.textContent = p ? p.n.charAt(0).toUpperCase() : "👤"; b.className = p ? "on" : "";
    b.setAttribute("aria-label", p ? "Profile: " + p.n : "Profile and Collection Log");
    var w = D.getElementById("who"); if (w) { w.hidden = !p; if (p) { w.textContent = p.n; w.className = g("sb-lb") ? "on" : ""; } }
  }
  D.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (trOv) trOv.shut(); else if (fOv) fOv.shut(); else if (dRoot) closeD(); else close(); } else if (dRoot && dCur && (e.key === "ArrowRight" || e.key === "ArrowLeft")) dCur(e.key === "ArrowRight" ? 1 : -1); });
  D.addEventListener("visibilitychange", function () { if (D.hidden && lbGet() && active()) savePush().catch(function () {}); });
  window.PROF = {
    open: function (v, a) {
      open(v, a);
    },
    changed: function () { if (root && logRefresh && root.querySelector(".pm-grid")) logRefresh(); },
    refresh: refreshBtn, sync: function () { return lbSync().catch(function () {}).then(function () { return savePush(); }).catch(function () {}); },
    pull: function () { if (!lbGet() || !active()) return; pullApply().then(function (c) { if (c && !D.body.classList.contains("rv-on")) location.reload(); else return PROF.sync(); }, function () {}); }
  };
  refreshBtn();
})();
