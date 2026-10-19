/* Profiles + Collection Log. Loaded only when the profile button is tapped. */
(function () {
  "use strict";
  var D = document, F = window.FUN, LS = localStorage;
  var PK = ["sb-followed", "sb-theme", "sb-pins", "sb-tab", "sb-ysub", "sb-col"];   // data that belongs to a profile
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
  function mergeCol(a, b) {                       // union of two collections: earliest find, summed counts
    var o = { i: {}, s: {}, d: [] };
    [a, b].forEach(function (c) {
      if (!c) return;
      for (var k in (c.i || {})) { var e = c.i[k], x = o.i[k]; var n = x ? [Math.min(x[0], e[0]), x[1] + e[1]] : [e[0], e[1]]; if ((x && x[2]) || e[2]) n.push((x && x[2]) || e[2]); o.i[k] = n; }
      for (var k2 in (c.s || {})) o.s[k2] = 1;
      (c.d || []).forEach(function (d) { if (o.d.indexOf(d) < 0) o.d.push(d); });
    });
    o.d = o.d.slice(-60); return o;
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
    var salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    return hashPw(pw, salt, ITER).then(function (h) {
      P[l] = { n: name, s: salt, h: h, it: ITER, d: snapshot(), c: Date.now() };
      putProfiles(P); s("sb-active", l);
      F.disc("mack");
      lbJoin.changed = false;
      return Promise.race([lbJoin(name, pw, true, true), new Promise(function (r) { setTimeout(r, 2500); })]).then(function () { if (lbJoin.changed) location.reload(); });
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
    o.d.sort(); o.d = o.d.slice(-60); return o;
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
    top.appendChild(el("h2", "pm-h", { home: "Profile", log: "Collection Log", lb: "Leaderboard" }[view] || ""));
    var x = btn("✕", "pm-x", close); x.setAttribute("aria-label", "Close"); top.appendChild(x);
    sheet.appendChild(top);
    var body = el("div", "pm-body"); sheet.appendChild(body);
    ({ home: vHome, log: vLog, lb: vLb })[view](body, arg);
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

  // ---------- home ----------
  function openSet() { close(); if (window.SB_SET) SB_SET(); }
  function vHome(body, arg) {
    var a = active(), P = profiles(), p = a && P[a];
    if (p) {
      if (!F.col().i.mack) F.disc("mack");
      var hd = el("div", "pm-who"); hd.appendChild(el("span", "pm-av", p.n.charAt(0).toUpperCase()));
      var w = el("div"); w.appendChild(el("div", "pm-name", p.n)); w.appendChild(el("div", "pm-sub", "Signed in on this device")); hd.appendChild(w); body.appendChild(hd);
      summary(body);
      body.appendChild(btn("Open Collection Log", "pm-b pri", function () { show("log"); }));
      body.appendChild(btn("Leaderboard", "pm-b", function () { show("lb"); }));
      body.appendChild(btn("Settings", "pm-b", openSet));
      body.appendChild(btn("Log out", "pm-b", logout));

      return;
    }
    body.appendChild(el("p", "pm-lead", "Make a profile to keep your teams, settings and Collection Log saved online, and to join the leaderboard. Log in on any device to get it all back."));
    summary(body);
    body.appendChild(btn("Open Collection Log", "pm-b", function () { show("log"); }));
    body.appendChild(btn("Leaderboard", "pm-b", function () { show("lb"); }));
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
      if (mode === "create") form.appendChild(el("p", "pm-note", "Username: letters, numbers, _ . - (3 to 16). Password 6+. Your current teams, settings and cards become this profile's starting point, and it joins the online leaderboard."));
      if (mode === "login" && !hasAny) form.appendChild(el("p", "pm-note", "No profiles on this device yet. Log in with an existing account, or create one."));
    }
    bl.onclick = function () { mode = "login"; draw(); }; bc.onclick = function () { mode = "create"; draw(); };
    if (arg && arg.name) mode = "login"; else if (!hasAny) mode = "create";
    draw();
  }

  // ---------- collection log ----------
  var filter = "all", lq = "", lst = "all", lr = {}, RL = { C: "C", U: "U", R: "R", E: "E", L: "L", M: "M", S: "S" };
  function pad(n) { return ("00" + n).slice(-3); }
  function vLog(body, arg) {
    var col = F.col(), found = F.count(), t = F.total;
    summary(body);
    (function () { var u = F.upcoming(), t = []; if (u.on.length) t.push("Dropping now: " + u.on.map(function (x) { return x.name + " (until " + x.end + ")"; }).join(", ") + "."); if (u.next) t.push("Next release: " + u.next.name + ", " + u.next.start + " to " + u.next.end + "."); if (t.length) body.appendChild(el("p", "pm-note pm-hol", "🎉 " + t.join(" "))); })();
    var chips = el("div", "pm-chips"), grid = el("div", "pm-grid");
    function fresh() { return F.CAT.filter(function (c) { return col.i[c[0]] && !col.s[c[0]]; }); }
    var nw = fresh(); if (filter === "new" && !nw.length) filter = "all";
    if (nw.length) body.appendChild(btn("✨ Review " + nw.length + " new card" + (nw.length > 1 ? "s" : ""), "pm-b pri", function () { detail(nw[0], nw, "New cards"); }));
    function chip(k, label) { var b = btn(label, "pm-chip" + (filter === k ? " on" : ""), function () { filter = k; draw(); }); chips.appendChild(b); }
    var qi = el("input", "pm-q"); qi.type = "search"; qi.placeholder = "Search cards, teams, moments"; qi.value = lq; qi.autocomplete = "off"; qi.spellcheck = false; qi.setAttribute("aria-label", "Search cards");
    var fl = el("div", "pm-chips pm-fl"), cnt = el("p", "pm-note pm-cnt"), qt = 0;
    qi.oninput = function () { lq = qi.value; clearTimeout(qt); qt = setTimeout(function () { drawFl(); drawGrid(); }, 70); };
    function active2() { return !!(lq.trim() || lst !== "all" || Object.keys(lr).length); }
    function drawFl() {
      fl.innerHTML = "";
      [["all", "All"], ["got", "Found"], ["miss", "Missing"]].forEach(function (x) { fl.appendChild(btn(x[1], "pm-chip" + (lst === x[0] ? " on" : ""), function () { lst = x[0]; drawFl(); drawGrid(); })); });
      ["C", "U", "R", "E", "L", "M", "S"].forEach(function (k) {
        var b = el("button", "pm-chip pm-rc r" + k + (lr[k] ? " on" : "")); b.type = "button"; b.appendChild(el("i", null, k)); b.appendChild(D.createTextNode(F.RAR[k]));
        b.onclick = function () { if (lr[k]) delete lr[k]; else lr[k] = 1; drawFl(); drawGrid(); }; fl.appendChild(b);
      });
      if (active2()) fl.appendChild(btn("Clear", "pm-chip", function () { lq = ""; qi.value = ""; lst = "all"; lr = {}; drawFl(); drawGrid(); }));
    }
    function vis(c) {
      var id = c[0], got = !!col.i[id];
      if (filter === "new") { if (!(got && !col.s[id])) return false; }
      else if (filter !== "all" && c[1] !== filter) return false;
      if (lst === "got" && !got) return false; if (lst === "miss" && got) return false;
      if (Object.keys(lr).length && !lr[c[2]]) return false;
      var q = lq.trim().toLowerCase();
      if (q) {
        var hay = (c[4] + " " + F.CATS[c[1]] + " " + F.RAR[c[2]] + " " + (F.KW[id] || []).join(" ") + (got || id.indexOf("mo_") === 0 ? " " + c[5] : "")).toLowerCase();
        if (!q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
      }
      return true;
    }
    function draw() { drawChips(); drawFl(); drawGrid(); }
    function drawChips() {
      chips.innerHTML = "";
      var all = F.CAT.length; chip("all", "All " + found + "/" + all);
      if (nw.length) chip("new", "New " + nw.length);
      Object.keys(F.CATS).forEach(function (k) {
        var tot = 0, fnd = 0; F.CAT.forEach(function (c) { if (c[1] === k) { tot++; if (col.i[c[0]]) fnd++; } });
        chip(k, F.CATS[k] + " " + fnd + "/" + tot);
      });
    }
    function drawGrid() {
      grid.innerHTML = ""; var vl = F.CAT.filter(vis), lb = filter === "new" ? "New cards" : "Results", sub = active2() || filter !== "all";
      cnt.textContent = sub ? vl.length + " of " + F.CAT.length + " cards" : ""; cnt.hidden = !sub;
      if (!vl.length) { grid.appendChild(el("p", "pm-note pm-none", "No cards match.")); return; }
      vl.forEach(function (c) {
        var got = !!col.i[c[0]], b = el("button", "tcm r" + c[2] + (got ? " got" : " lock")); b.type = "button";
        b.appendChild(el("span", "tcm-no", "#" + pad(c.n)));
        b.appendChild(F.art(c, "tcm-art", 84, got));
        b.appendChild(el("span", "tcm-n", c[4]));
        b.appendChild(el("i", "tcm-r", RAR(c[2])));
        if (got && !col.s[c[0]]) b.appendChild(el("u", "tcm-new", "NEW"));
        b.onclick = function () { detail(c, sub ? vl : null, lb); };
        grid.appendChild(b);
      });
    }
    function RAR(k) { return RL[k]; }
    body.appendChild(qi); body.appendChild(fl); body.appendChild(chips); body.appendChild(cnt); body.appendChild(grid); draw();
    if (arg && arg.card && F.IDX[arg.card]) detail(F.IDX[arg.card], null);
    var lg = el("div", "pm-key");
    ["C", "U", "R", "E", "L", "M", "S"].forEach(function (k) { var s2 = el("span", "r" + k); s2.appendChild(el("i", null, k)); s2.appendChild(D.createTextNode(F.RAR[k])); lg.appendChild(s2); });
    body.appendChild(lg);
    body.dataset.keep = "1";
  }

  var dRoot = null, dCur = null, dList = null, dLbl = "New cards";
  function detail(c, list, lbl) {
    if (list !== undefined) { dList = list; dLbl = lbl || "Results"; }
    var col = F.col(), got = !!col.i[c[0]], L = dList || F.CAT, idx = L.indexOf(c);
    if (got) F.seen(c[0]);
    if (dRoot && dRoot.parentNode) dRoot.parentNode.removeChild(dRoot);
    var ov = el("div", "tcd"); dRoot = ov;
    ov.onclick = function (e) { if (e.target === ov) closeD(); };
    var wrap = el("div", "tcd-w"), card = el("div", "tc r" + c[2] + (got ? " got" : " lock"));
    var head = el("div", "tc-h"); head.appendChild(el("span", null, "No. " + pad(c.n) + " / " + pad(F.total))); head.appendChild(el("span", null, F.CATS[c[1]])); card.appendChild(head);
    var art = el("div", "tc-art"); art.appendChild(F.art(c, "tc-em", 200, got)); card.appendChild(art);
    card.appendChild(el("h3", "tc-n", c[4]));
    var rb = el("div", "tc-rar"); rb.appendChild(el("i", null, c[2])); rb.appendChild(D.createTextNode(F.RAR[c[2]])); card.appendChild(rb);
    card.appendChild(el("p", "tc-d", got ? c[5] : "Not found yet."));
    if (got) {
      var e = col.i[c[0]]; card.appendChild(el("p", "tc-f", "First found " + new Date(e[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + (e[1] > 1 ? " · seen ×" + e[1] : "")));
    } else card.appendChild(el("p", "tc-f", "How to find it: " + c[6]));
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
    if (dList) wrap.appendChild(el("div", "tcd-q", dLbl + " · " + (idx + 1) + " of " + L.length));
    wrap.appendChild(card);
    var ctl = el("div", "tcd-c");
    function nav(d) {
      if (dList) { var n2 = idx + d; if (n2 < 0) return; if (n2 >= L.length) { closeD(); return; } detail(L[n2]); return; }
      var n = (idx + d + F.CAT.length) % F.CAT.length; detail(F.CAT[n]);
    }
    dCur = nav;
    var pb = btn("‹", "pm-b tcd-n", function () { nav(-1); }); if (dList && idx === 0) pb.disabled = true; pb.setAttribute("aria-label", "Previous card"); ctl.appendChild(pb);
    var pl = /^[wlcb]_/.test(c[0]);
    if (got && pl) ctl.appendChild(btn("▶ Replay", "pm-b", function () { F.play(c[0], card); }));
    if (got && /^[RELMS]$/.test(c[2])) ctl.appendChild(btn("✨ Reveal", "pm-b", function () { F.reveal(c); }));
    ctl.appendChild(btn("Close", "pm-b", closeD));
    var nb = btn(dList && idx === L.length - 1 ? "✓" : "›", "pm-b tcd-n", function () { nav(1); }); nb.setAttribute("aria-label", dList && idx === L.length - 1 ? "Done" : "Next card"); ctl.appendChild(nb);
    wrap.appendChild(ctl); ov.appendChild(wrap); (root || D.body).appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("in"); });
    if (got && (c[2] === "L" || c[2] === "M" || c[2] === "S") && !F.reduced) F.confetti(24, ["✨", "⭐"]);
  }
  function closeD() { if (!dRoot) return; var d = dRoot; dRoot = null; dList = null; d.classList.remove("in"); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 180);
    if (root) { var v = root.querySelector(".pm-grid"); if (v) { var sc = root.querySelector(".pm-sheet").scrollTop; show("log"); root.querySelector(".pm-sheet").scrollTop = sc; } } }

  // ---------- header button ----------
  function refreshBtn() {
    var b = D.getElementById("prof"); if (!b) return;
    var a = active(), p = a && profiles()[a];
    b.textContent = p ? p.n.charAt(0).toUpperCase() : "👤"; b.className = p ? "on" : "";
    b.setAttribute("aria-label", p ? "Profile: " + p.n : "Profile and Collection Log");
    var w = D.getElementById("who"); if (w) { w.hidden = !p; if (p) { w.textContent = p.n; w.className = g("sb-lb") ? "on" : ""; } }
  }
  D.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (dRoot) closeD(); else close(); } else if (dRoot && dCur && (e.key === "ArrowRight" || e.key === "ArrowLeft")) dCur(e.key === "ArrowRight" ? 1 : -1); });
  D.addEventListener("visibilitychange", function () { if (D.hidden && lbGet() && active()) savePush().catch(function () {}); });
  window.PROF = {
    open: function (v, a) {
      open(v, a);
    },
    refresh: refreshBtn, sync: function () { return lbSync().catch(function () {}).then(function () { return savePush(); }).catch(function () {}); },
    pull: function () { if (!lbGet() || !active()) return; pullApply().then(function (c) { if (c && !D.body.classList.contains("rv-on")) location.reload(); else return PROF.sync(); }, function () {}); }
  };
  refreshBtn();
})();
