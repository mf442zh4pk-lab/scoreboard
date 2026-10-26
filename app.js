// UI: state, rendering and routing. No ESPN-specific knowledge lives here (see espn.js).
(function () {
  "use strict";
  var C = window.CONFIG, LG = C.leagues, DAY = ESPN.DAY;
  var D0 = document, $ = function (id) { return document.getElementById(id); };
  // The build number comes from this script's own ?v= in index.html, so there is exactly one place to bump it.
  var FV = ((D0.currentScript || {}).src || "").split("?")[1] || "";
  // Reduced motion comes from the phone's setting or the Animations switch in Settings; either one turns every move off.
  var RM0 = false; try { RM0 = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var RM = RM0;
  // Preferences (Settings). Defaults here; anything the person changes is saved under sb-pref.
  var PREF = { tab0: "last", compact: false, h24: false, haptic: true, alerts: true, upwin: "3", splash: true, text: "n", logos: true, notify: false, hideL: [], motion: true };
  try { var pf = JSON.parse(localStorage.getItem("sb-pref") || "{}"); for (var pk in pf) if (pk in PREF) PREF[pk] = pf[pk]; } catch (e) {}
  function setPref(k, v) { PREF[k] = v; try { localStorage.setItem("sb-pref", JSON.stringify(PREF)); } catch (e) {} applyPref(); }
  function applyPref() {
    document.body.classList.toggle("cmp", !!PREF.compact);
    document.body.classList.toggle("nolg", !PREF.logos);
    document.documentElement.classList.toggle("txl", PREF.text === "l");
    RM = RM0 || !PREF.motion; document.documentElement.classList.toggle("rm", !PREF.motion);
    try { if (PREF.splash) localStorage.removeItem("sb-splash"); else localStorage.setItem("sb-splash", "0"); } catch (e) {}
  }
  applyPref();
  function buzz(ms) { if (!PREF.haptic) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  // Tiny event bus + extension points for future features (see README.md): SB.on("render"|"data"|"view", fn).
  var HOOKS = {};
  function on(ev, fn) { (HOOKS[ev] = HOOKS[ev] || []).push(fn); return function () { HOOKS[ev] = (HOOKS[ev] || []).filter(function (f) { return f !== fn; }); }; }
  function emit(ev, a, b) { (HOOKS[ev] || []).forEach(function (f) { try { f(a, b); } catch (e) {} }); }
  // Async arrivals (team pages, box scores, lazy leagues) ask for a render; several in one frame become one render.
  var RQ = 0;
  function renderSoon() { if (RQ) return; RQ = requestAnimationFrame(function () { RQ = 0; render(); }); }
  // Page-level swaps (opening or leaving a game) crossfade when the browser can do it for free.
  // Screen changes. A tap in the app (open a game, the Back button) gets the cross-fade; a gesture (the app's edge swipe,
  // iOS's own back swipe, the browser Back button) swaps at once, since the finger already animated it and a
  // transition started mid-gesture can stall Safari with the page untappable. While a screen swaps in, taps on the
  // list are held for a moment so a finger still moving can't land on the wrong game; and any transition still running
  // is cut short the moment the screen is touched.
  var GEST = false, NAV = 0;
  // Tab and view changes swap in place (the entrance animations in render() give the polish). A root view transition
  // snapshots the whole tall page, and on iOS Safari that showed up as a zoomed-out flash that snapped down.
  function swap(fn) { lockTaps(); fn(); }
  function lockTaps() { var b = document.body; if (!b) return; b.classList.add("nav-lock"); clearTimeout(lockTaps.t); lockTaps.t = setTimeout(function () { b.classList.remove("nav-lock"); }, 280); }

  var S = { tab: "pinned", games: {}, yesterday: null, ready: false, loading: false, last: 0, failed: [], view: null, depth: 0, settings: false, teams: {}, leaders: {}, lgState: {}, more: false, yf: {}, ysub: "teams", ymore: {} };
  var openState = {};   // remembers which detail sections you opened or closed
  var PINS = [], TC = {}, EAGER = [], RK = "", RT = 0;
  try { EAGER = JSON.parse(localStorage.getItem("sb-eager") || "[]") || []; } catch (e) {}
  function addEager(k) { if (EAGER.indexOf(k) < 0) { EAGER.push(k); try { localStorage.setItem("sb-eager", JSON.stringify(EAGER)); } catch (e) {} } }
  try { PINS = JSON.parse(localStorage.getItem("sb-pins") || "[]") || []; } catch (e) {}
  try { TC = JSON.parse(localStorage.getItem("sb-tcache") || "{}") || {}; } catch (e) {}
  // Trim the team cache to the teams you follow (teams browsed once live only in memory).
  try { var tcN = 0; Object.keys(TC).forEach(function (n) { if ((JSON.parse(localStorage.getItem("sb-followed") || "null") || C.followed).indexOf(n) < 0) { delete TC[n]; tcN++; } }); if (tcN) localStorage.setItem("sb-tcache", JSON.stringify(TC)); } catch (e) {}
  function savePins() { try { localStorage.setItem("sb-pins", JSON.stringify(PINS)); } catch (e) {} }
  function pinKey(x) { return x.lk + "_" + x.g.id; }
  function isPinned(x) { return PINS.indexOf(pinKey(x)) >= 0; }
  LG.forEach(function (l) { S.games[l.key] = []; });
  var DEFAULT_FOLLOWED = C.followed.slice();
  try { var saved = localStorage.getItem("sb-tab"); if (saved) S.tab = saved; } catch (e) {}
  if (PREF.tab0 !== "last") S.tab = PREF.tab0;
  try { var sy = localStorage.getItem("sb-ysub"); if (sy === "news") sy = "recap"; if (sy === "tomorrow") sy = "week"; if (sy === "recap" || sy === "teams" || sy === "week") S.ysub = sy; } catch (e) {}
  try { var sf = JSON.parse(localStorage.getItem("sb-followed") || "null"); if (sf && sf.length) C.followed = sf; } catch (e) {}
  // People you follow (fighters, drivers, golfers), matched by name against each event's entrants.
  var FIRST = false; try { FIRST = !localStorage.getItem("sb-cache") && !localStorage.getItem("sb-followed") && !localStorage.getItem("sb-onb"); } catch (e) {}   // a brand-new visitor (see pickTeams)
  C.fp = []; try { var sfp = JSON.parse(localStorage.getItem("sb-fp") || "[]"); if (sfp && sfp.length) C.fp = sfp; } catch (e) {}
  var FPS = {};
  function fpIdx() { FPS = {}; C.fp.forEach(function (n) { FPS[String(n).toLowerCase()] = 1; }); }
  fpIdx();
  function fpHas(n) { return !!FPS[String(n).toLowerCase()]; }
  function fpIn(g) { return C.fp.length && g.pp ? g.pp.filter(fpHas) : []; }
  try { localStorage.removeItem("sb-theme"); } catch (e) {}   // dark only now; drop the old Light/Auto choice
  // toast(msg) shows for six seconds; toast(msg, ms, fn) stays longer and runs fn when tapped.
  function toast(msg, ms, fn) {
    var t = $("toast"); t.textContent = msg; t.className = "show" + (fn ? " act" : ""); t.onclick = fn ? function () { t.className = ""; fn(); } : null;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = ""; }, ms || 6000);
  }

  // ---------- helpers ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  // A search box with its own clear button (×), shown only while there's text. Clearing fires "input", so every
  // box's own handler redraws as if the text had been deleted by hand; the keyboard stays up.
  // Every search box: a drawn magnifier, our own centered × (only with text), and a <form role=search> so the phone's
  // Search/Go key always arrives (iOS sends it as a submit). On a touch screen, Enter/Search just puts the keyboard
  // away so the results are in view; with a real keyboard, the box's own Enter handler runs (open the top result).
  // inForm: the box already sits in a form (the people box), so no second one.
  var TOUCH = false; try { TOUCH = matchMedia("(hover: none), (pointer: coarse)").matches; } catch (e) {}
  function clearable(inp, inForm) {
    var w = el(inForm ? "span" : "form", "tq ic"), x = el("button", "tq-x");
    w.appendChild(el("span", "tq-i"));
    if (!inForm) {
      w.setAttribute("role", "search"); w.noValidate = true; w.setAttribute("action", "#");
      w.addEventListener("submit", function (e) { e.preventDefault(); if (TOUCH) inp.blur(); });
      w.addEventListener("keydown", function (e) { if (e.key === "Enter" && TOUCH && e.target === inp) { e.preventDefault(); e.stopPropagation(); inp.blur(); } }, true);
    }
    x.type = "button"; x.tabIndex = -1; x.setAttribute("aria-label", "Clear search");
    var sync = function () { w.classList.toggle("has", !!inp.value); };
    inp.addEventListener("input", sync);
    x.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // don't steal focus (keeps the phone keyboard open)
    x.onclick = function (e) { e.preventDefault(); e.stopPropagation(); buzz(4); inp.value = ""; inp.dispatchEvent(new Event("input", { bubbles: true })); try { inp.focus(); } catch (er) {} };
    w.appendChild(inp); w.appendChild(x); sync(); setTimeout(sync, 0);
    return w;
  }
  // Team name with its top-25 ranking in front ("#5 Georgia Bulldogs"), for text lines; rankedName() does the same for card rows.
  function tn(t) { return (t[6] ? "#" + t[6] + " " : "") + t[0]; }
  function rankedName(t) {
    var s = el("span", "nm");
    if (t[6]) s.appendChild(el("span", "rk", String(t[6])));
    s.appendChild(document.createTextNode(t[0])); return s;
  }
  function isFollowed(g) { return C.followed.indexOf(g.h[0]) >= 0 || C.followed.indexOf(g.a[0]) >= 0 || (C.fp.length > 0 && !!g.pp && fpIn(g).length > 0); }
  var LGM = {}; LG.forEach(function (l) { LGM[l.key] = l; });   // key → league, looked up constantly while rendering
  function leagueOf(lk) { return LGM[lk]; }
  var DYN = {}; try { DYN = JSON.parse(localStorage.getItem("sb-dyn") || "{}") || {}; } catch (e) {}
  Object.keys(DYN).forEach(function (k) { if (DYN[k] && DYN[k][0]) addLeague(k, DYN[k][0], DYN[k][1]); });
  try { localStorage.removeItem("sb-tm2"); localStorage.removeItem("sb-teams2"); } catch (e) {}   // the old every-league team sweep
  function allGames() {
    var out = [];
    LG.forEach(function (l) { S.games[l.key].forEach(function (g) { out.push({ g: g, lk: l.key, ll: l.label }); }); });
    return out;
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    // ESPN dates some events (golf tournaments) with no start time, which reads as exactly midnight: show the day only.
    if (!d.getHours() && !d.getMinutes()) return ESPN.dayKey(d) === ESPN.dayKey(new Date()) ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    var t = d.toLocaleTimeString(undefined, { hour: PREF.h24 ? "2-digit" : "numeric", minute: "2-digit", hour12: !PREF.h24 });
    if (ESPN.dayKey(d) === ESPN.dayKey(new Date())) return t;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " · " + t;
  }
  function byTime(a, b) { return Date.parse(a.t) - Date.parse(b.t); }
  // "in 3h 12m" for a start time; long=true also counts days. Empty when out of range.
  function countdown(iso, long) {
    var ms = new Date(iso) - Date.now();
    if (isNaN(ms)) return "";
    if (ms <= 0) return "starting";
    var d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
    if (d) return long ? "in " + d + "d " + h + "h" : "in " + d + "d";
    return h ? "in " + h + "h " + m + "m" : "in " + Math.max(1, m) + "m";
  }
  // Is this live game close and late? Rules per sport, read from the feed's status text ("2:10 - 4th", "Bot 8th", "78'").
  var CLOSE = { nfl: [3, 8], ncaafb: [3, 8], nba: [3, 7], nhl: [2, 1], mlb: [6, 2], afl: [3, 12],
    wnba: [3, 7], gleague: [3, 7], ncaamb: [2, 6], ncaawb: [3, 7], ufl: [3, 8], ncaah: [2, 1], ncaawh: [2, 1], ncaabsb: [6, 2], ncaasb: [5, 2], nll: [3, 3], pll: [3, 3], ncaaml: [3, 3] };
  function isClose(x) {
    var g = x.g, c = g.c || "", lg = leagueOf(x.lk);
    if (g.s !== "live" || g.h[2] == null || g.a[2] == null) return false;
    var diff = Math.abs(g.h[2] - g.a[2]);
    if (lg && lg.soccer) { var mm = /(\d+)'/.exec(c); return diff <= 1 && (/ET|Extra/i.test(c) || (mm && +mm[1] >= 60)); }
    var r = CLOSE[x.lk]; if (!r) return false;
    var p = /OT|SO\b|ET\b|Extra/i.test(c) ? 99 : 0, m;
    if (!p && (m = /(\d+)(?:st|nd|rd|th)/i.exec(c))) p = +m[1];
    if (!p && (m = /\bQ(\d)/i.exec(c))) p = +m[1];
    return p >= r[0] && diff <= r[1];
  }

  // Everything that finished yesterday (or, for races, this past weekend), kept apart from trim() so the daily recap can cover every game.
  function keepY(lk, list) {
    var yk = ESPN.dayKey(new Date(Date.now() - DAY)), lg = leagueOf(lk), now = Date.now();
    S.yf[lk] = list.filter(function (g) {
      if (g.s !== "final") return false;
      if (lg && (lg.kind === "race" || lg.kind === "golf")) return now - new Date(g.t) < 4 * DAY;
      return ESPN.dayKey(new Date(g.t)) === yk;
    }).sort(function (p, q) { return byTime(q, p); }).slice(0, 80);
  }
  // Keep every followed game, every live game, the latest 8 finals and next 8 upcoming.
  function trim(games) {
    var fol = games.filter(isFollowed), rest = games.filter(function (g) { return !isFollowed(g); });
    var live = rest.filter(function (g) { return g.s === "live"; });
    var fin = rest.filter(function (g) { return g.s === "final"; }).sort(function (a, b) { return byTime(b, a); }).slice(0, 8);
    var up = rest.filter(function (g) { return g.s === "up"; }).sort(byTime).slice(0, 8);
    var seen = {};
    return fol.concat(live, fin, up).filter(function (g) { if (seen[g.id]) return false; seen[g.id] = 1; return true; });
  }

  // ---------- "What happened yesterday" (built from final scores) ----------
  function nextUp(all, name) {
    var n = all.filter(function (x) { return x.g.s === "up" && (x.g.h[0] === name || x.g.a[0] === name); })
      .sort(function (a, b) { return byTime(a.g, b.g); })[0];
    return n ? " Next up: " + (n.g.h[0] === name ? "vs " + n.g.a[0] : "at " + n.g.h[0]) + "." : "";
  }
  function buildYesterday(now) {
    var all = allGames();
    var yd = new Date(now.getTime() - DAY), key = ESPN.dayKey(yd);
    var label = new Intl.DateTimeFormat("en-US", { timeZone: C.timezone, weekday: "long", month: "long", day: "numeric" }).format(yd);
    var teams = C.followed.map(function (name) {
      var x = all.filter(function (q) {
        return q.g.s === "final" && ESPN.dayKey(new Date(q.g.t)) === key && (q.g.h[0] === name || q.g.a[0] === name);
      })[0];
      if (!x) return { name: name, played: false };
      var g = x.g, home = g.h[0] === name, mine = home ? g.h : g.a, opp = home ? g.a : g.h;
      var res = mine[2] > opp[2] ? "W" : mine[2] < opp[2] ? "L" : "T";
      var hi = mine[2] >= opp[2] ? [mine, opp] : [opp, mine];
      return {
        name: name, played: true, result: res, gid: g.id, lk: x.lk, abbr: mine[1], my: mine[2], op: opp[2], ot: !!g.o, opp: opp[0], home: home,
        line: hi[0][0] + " " + hi[0][2] + ", " + hi[1][0] + " " + hi[1][2],
        body: (home ? "At home" : "On the road") + (g.o ? ", in overtime." : ".") + nextUp(all, name),
      };
    });
    return { date: label, teams: teams };
  }

  // ---------- list view ----------
  // Team badge: the logo when we have one (lazy, fixed size so nothing jumps), else the abbreviation.
  var IMGN = 0;   // logos drawn so far in this render: the first screenful loads at once, the rest wait until scrolled near
  function logoImg(u, ab) {
    var i = new Image(); i.src = u; i.alt = ""; i.width = 28; i.height = 28; i.loading = IMGN++ < 16 ? "eager" : "lazy"; i.decoding = "async";
    i.onerror = function () { var p = i.parentNode; if (p) { p.classList.remove("lg"); p.textContent = ab || ""; } };   // keep .tbtn etc.
    return i;
  }
  function badge(t, lk) {
    var b;
    if (!t[5] || !PREF.logos) b = el("span", "ab", t[1]); else { b = el("span", "ab lg"); b.appendChild(logoImg(t[5], t[1])); }
    if (lk && t[4]) { b.classList.add("tbtn"); b._t = teamOfSide(lk, t); b.title = "Open " + t[0]; }   // tap the badge: the team's page
    return b;
  }
  function teamOfSide(lk, t) { return { lk: lk, id: String(t[4]), name: t[0], ab: t[1], lg: t[5] || "" }; }
  // Small inline logo for table rows and section titles.
  function mini(u) {
    var i = new Image(); i.src = u; i.alt = ""; i.width = 18; i.height = 18; i.loading = "lazy"; i.decoding = "async"; i.className = "mini";
    i.onerror = function () { i.remove(); };
    return i;
  }
  // Logo for a team name, taken from any game already loaded (no extra requests).
  function logoFor(name) {
    for (var k in S.games) for (var j = 0; j < S.games[k].length; j++) {
      var g = S.games[k][j];
      if (g.h[0] === name && g.h[5]) return g.h[5];
      if (g.a[0] === name && g.a[5]) return g.a[5];
    }
    return "";
  }
  // The small M mark that means "you follow this" (cloned from the header logo; the gradients stay defined there).
  function markIcon() {
    var s = $("mark").cloneNode(true), d = s.querySelector("defs"); if (d) d.parentNode.removeChild(d);
    s.removeAttribute("id"); s.removeAttribute("role"); s.removeAttribute("aria-label"); s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "mki");
    return s;
  }
  function folTag(txt) { var t = el("span", "tag fol"); t.appendChild(markIcon()); t.appendChild(document.createTextNode(txt)); t.setAttribute("aria-label", "Following · " + txt); return t; }
  function statusPill(g, txt, cls) {
    var p = el("span", "pill " + g.s + (cls || ""), txt);
    if (g.s === "live") p.insertBefore(el("i", "pulse"), p.firstChild);
    return p;
  }
  var LASTSC = {};   // last score shown per game, so a live score that moves gets a little pop
  // Card for an event sport (UFC card, race weekend): title, the main fight or the podium, and a short note.
  function evCard(x) {
    var g = x.g, c = el("div", "card"), top = el("div", "top"), P = g.x || {};
    top.appendChild(statusPill(g, g.s === "live" ? (g.c || "Live") : g.s === "final" ? "Final" : when(g.t)));
    var fi = isFollowed(g); if (fi) c.className += " followed";
    top.appendChild(fi ? folTag(x.ll) : el("span", "tag", x.ll));
    c.appendChild(top);
    c.appendChild(el("div", "evt", g.h[0]));
    var row = function (name, rec, right, lose) {
      var r = el("div", "row" + (lose ? " lose" : "")), tm = el("div", "tm"), nw = el("span", "nmw");
      nw.appendChild(el("span", "nm", name)); if (rec) nw.appendChild(el("span", "rec", rec));
      tm.appendChild(nw); r.appendChild(tm); r.appendChild(el("span", "sc sm", right)); return r;
    };
    if (g.ev === "mma") {
      var f = (P.fights || [])[0];
      if (f) {
        var done = f.s === "post" && f.win >= 0;
        [0, 1].forEach(function (i) { c.appendChild(row(f.n[i] || "–", f.r[i], done && f.win === i ? "W" : "", done && f.win !== i)); });
        var info = [f.w, done ? [f.m, f.rd ? "R" + f.rd : "", f.tm].filter(Boolean).join(" ") : f.s === "in" ? f.live : ""].filter(Boolean).join(" · ");
        c.appendChild(el("div", "evs", "Main event · " + info));
      }
      if (P.fights && P.fights.length > 1) c.appendChild(el("div", "evs", "+" + (P.fights.length - 1) + " more fights" + (P.venue ? " · " + P.venue : "")));
    } else if (g.ev === "golf") {
      var GR = P.rows || [], gdone = {};
      if (!GR.length) c.appendChild(el("div", "evs", (g.s === "up" ? "Starts " + when(g.t) : "Field not posted yet") + (P.venue ? " \u00b7 " + P.venue : "")));
      else {
        var gline = function (r, lose) { var th = r[5] ? "thru " + r[5] : ""; gdone[r[0]] = 1; return row(r[0], [r[1], th].filter(Boolean).join(" \u00b7 "), r[2], lose); };
        GR.slice(0, 3).forEach(function (r) { c.appendChild(gline(r)); });
        GR.filter(function (r) { return !gdone[r[0]] && fpHas(r[0]); }).slice(0, 3).forEach(function (r) { c.appendChild(gline(r)); });
        c.appendChild(el("div", "evs", (g.s === "live" ? g.c || "Live" : g.s === "final" ? "Final" : "") + (P.venue ? (g.s === "up" ? "" : " \u00b7 ") + P.venue : "")));
      }
    } else {
      var ses = P.sess || [], race = ses.filter(function (s) { return /^race$/i.test(s.n); })[0] || ses[ses.length - 1];
      if (g.s !== "up" && race && race.rows.length) race.rows.slice(0, 3).forEach(function (r) { c.appendChild(row(r[1], "", String(r[0]), false)); });
      else {
        var nx = ses.filter(function (s) { return s.s === "pre"; })[0];
        c.appendChild(el("div", "evs", (nx ? "Next: " + sessName(nx.n) + " · " + when(nx.t) : "") + (P.venue ? (nx ? " · " : "") + P.venue : "")));
      }
    }
    if (fi && g.ev !== "golf") { var fl = fpIn(g).slice(0, 3); if (fl.length) c.appendChild(el("div", "evs fpl", "\u2605 " + fl.join(", "))); }
    return c;
  }
  var SESS = { FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3", SS: "Sprint qualifying", SR: "Sprint race", Qual: "Qualifying", Race: "Race" };
  function sessName(n) { return SESS[n] || n; }
  function card(x) {
    if (x.g.ev) { var ec = evCard(x); lpCopy(ec, x); return ec; }
    var g = x.g, c = el("div", "card" + (isFollowed(g) ? " followed" : "") + (isFollowed(g) ? strCls(streakOf(C.followed.indexOf(g.h[0]) >= 0 ? g.h[0] : g.a[0])) : ""));
    var top = el("div", "top");
    var ptxt = g.s === "live" ? (g.c || "Live") : g.s === "final" ? "Final" : when(g.t) + (g.b ? " · " + g.b : ""), pcls = "";
    if (g.s === "final" && g.h[2] != null && g.a[2] != null) {
      var fh = C.followed.indexOf(g.h[0]) >= 0, fa = C.followed.indexOf(g.a[0]) >= 0;
      if (fh !== fa) {
        var me = fh ? g.h : g.a, op = fh ? g.a : g.h, wl = me[2] > op[2] ? "W" : me[2] < op[2] ? "L" : "T";
        ptxt = "Final · " + wl; pcls = wl === "W" ? " w" : wl === "L" ? " l" : "";
      }
    }
    var pill = statusPill(g, ptxt, pcls);
    if (g.s === "up") {
      var cdv = countdown(g.t);
      if (cdv) { var cs = el("span", "cd", " · " + cdv); cs.setAttribute("data-cd", g.t); pill.appendChild(cs); }
      if (x.lk === "afl") { try { pill.appendChild(el("span", "cd", " (" + new Date(g.t).toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit" }) + " Brisbane)")); } catch (e) {} }
    }
    top.appendChild(pill);
    top.appendChild(isFollowed(g) ? folTag(x.ll) : el("span", "tag", x.ll + (g.n ? " · " + g.n : "")));
    c.appendChild(top);
    var hs = g.h[2], as = g.a[2], has = g.s !== "up" && hs != null && as != null;
    var ps = LASTSC[g.id], live = g.s === "live", bA = live && ps && ps[0] !== as, bH = live && ps && ps[1] !== hs;
    if (has) LASTSC[g.id] = [as, hs];
    [[g.a, as, hs, bA], [g.h, hs, as, bH]].forEach(function (r) {
      var row = el("div", "row" + (has && r[1] < r[2] && g.s === "final" ? " lose" : ""));
      var tm = el("div", "tm");
      tm.appendChild(badge(r[0], x.lk));
      var nmw = el("span", "nmw"); nmw.appendChild(rankedName(r[0]));
      if (r[0][3] && !/^0(-0)+$/.test(r[0][3])) nmw.appendChild(el("span", "rec", r[0][3]));
      tm.appendChild(nmw);
      row.appendChild(tm);
      if (has) row.appendChild(el("span", "sc" + (r[3] ? " bump" : ""), String(r[1])));
      c.appendChild(row);
    });
    lpCopy(c, x);
    return c;
  }
  // Cards only carry a marker class and their game; one set of listeners on #out (below) handles press-and-hold,
  // prefetch and the context menu for all of them, so a page of 60 cards adds no listeners at all.
  function lpCopy(c, x) { c._x = x; c.classList.add("lpx"); }
  (function () {
    var out = $("out"), t = 0, pt = 0, sx = 0, sy = 0, fired = false, cur = null;
    function cardOf(e) { var n = e.target && e.target.closest && e.target.closest(".lpx,.pfx"); return n && n._x ? n : null; }
    function cancel() { clearTimeout(t); clearTimeout(pt); cur = null; }
    out.addEventListener("pointerdown", function (e) {
      var c = cardOf(e); if (!c || !c.classList.contains("lpx") || e.button > 0) return;
      cur = c; sx = e.clientX; sy = e.clientY; fired = false; clearTimeout(t);
      // A finger that settles for 60ms is about to tap: start the box score now so the page opens with it (a scroll cancels this).
      if (c.classList.contains("pfx")) { clearTimeout(pt); pt = setTimeout(function () { ESPN.fetchGame(c._x.lk, c._x.g.id).catch(function () {}); }, 60); }
      t = setTimeout(function () { fired = true; cur = null; c.classList.add("lp"); setTimeout(function () { c.classList.remove("lp"); }, 480); buzz(18); lpMenu(c._x); setTimeout(function () { fired = false; }, 700); }, 520);
    });
    out.addEventListener("pointermove", function (e) { if (cur && (Math.abs(e.clientX - sx) > 9 || Math.abs(e.clientY - sy) > 9)) cancel(); }, { passive: true });
    out.addEventListener("pointerup", cancel); out.addEventListener("pointercancel", cancel); out.addEventListener("pointerleave", cancel);
    window.addEventListener("scroll", cancel, { passive: true });
    out.addEventListener("click", function (e) {
      if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
      var tb = e.target.closest && e.target.closest(".tbtn"); if (tb && tb._t) { e.stopPropagation(); e.preventDefault(); openTeam(tb._t); }   // badge tap beats the card tap
    }, true);
    document.addEventListener("click", function (e) { var tb = e.target.closest && e.target.closest(".find .tbtn"); if (tb && tb._t) { e.stopPropagation(); e.preventDefault(); closeFind(); openTeam(tb._t); } }, true);
    out.addEventListener("contextmenu", function (e) { if (cardOf(e)) e.preventDefault(); });
    // Start fetching a game's box score as soon as a finger or mouse settles on its card, so the tap opens instantly.
    out.addEventListener("pointerover", function (e) {
      var c = cardOf(e); if (!c || !c.classList.contains("pfx")) return;
      clearTimeout(pt); pt = setTimeout(function () { ESPN.fetchGame(c._x.lk, c._x.g.id).catch(function () {}); }, 90);
    });
    out.addEventListener("pointerout", function () { clearTimeout(pt); });
  })();
  var UCOL = {}, SCY = {};
  try { UCOL = JSON.parse(localStorage.getItem("sb-ucol") || "{}") || {}; } catch (e) {}
  function group(title, cls, items, big, split) {
    if (!items.length) return null;
    var s = el("section", "grp"), h = el("h2", cls || "");
    if (cls === "live") h.appendChild(el("span", "pulse"));
    if (cls === "close") h.appendChild(el("span", "flame", "\u25B2"));
    h.appendChild(document.createTextNode(title));
    s.appendChild(h);
    if (split) {
      var seenL = {}, lks = [];
      items.forEach(function (x) { if (!seenL[x.lk]) { seenL[x.lk] = 1; lks.push(x.lk); } });
      if (lks.length > 1) {
        LG.forEach(function (l) {
          if (!seenL[l.key]) return;
          var its = items.filter(function (x) { return x.lk === l.key; }), wrap = el("div", "usec" + (UCOL[l.key] ? " shut" : ""));
          var sb = el("button", "sub-h"); sb.type = "button"; sb.setAttribute("aria-expanded", UCOL[l.key] ? "false" : "true");
          sb.appendChild(el("span", "lgh-t", l.label)); sb.appendChild(el("span", "lgh-c", "\u25BE"));
          sb.onclick = function () {
            var shut = wrap.classList.toggle("shut"); sb.setAttribute("aria-expanded", shut ? "false" : "true");
            if (shut) UCOL[l.key] = 1; else delete UCOL[l.key];
            try { localStorage.setItem("sb-ucol", JSON.stringify(UCOL)); } catch (e) {}
          };
          wrap.appendChild(sb); wrap.appendChild(gridOf(its, cls, big)); s.appendChild(wrap);
        });
        return s;
      }
    }
    s.appendChild(gridOf(items, cls, big));
    return s;
  }
  // Everything a card shows, in one string: when it hasn't changed between two quiet refreshes, the old card stays.
  function sigOf(x) {
    var g = x.g;
    return [g.s, g.c, g.t, g.n, g.b, g.o ? 1 : 0, g.a.slice(0, 7).join("~"), g.h.slice(0, 7).join("~"), x.ll, g.x ? JSON.stringify(g.x) : "", PREF.compact ? 1 : 0, PREF.logos ? 1 : 0, PREF.h24 ? 1 : 0].join("|");
  }
  function gridOf(items, cls, big) {
    var gr = el("div", "grid" + (big ? " big" : ""));
    items.forEach(function (x) {
      var c = card(x);
      c.setAttribute("data-k", x.lk + "_" + x.g.id); c.setAttribute("data-sig", sigOf(x));
      c.classList.add("click"); c.tabIndex = 0; c.setAttribute("role", "button");
      c.setAttribute("aria-label", "Open box score: " + x.g.a[0] + " at " + x.g.h[0]);
      c.onclick = function () { openGame(x); };
      c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGame(x); } };
      if (cls === "close") c.classList.add("close");
      prefetchOn(c, x);
      gr.appendChild(c);
    });
    return gr;
  }
  function prefetchOn(c, x) { if (!x.g.ev) { c._x = x; c.classList.add("pfx"); } }
  // Loading placeholders: a few shimmering card shapes instead of a sentence.
  function skel(n, big) {
    var g = el("div", "grid skel" + (big ? " big" : ""));
    for (var i = 0; i < n; i++) { var c = el("div", "card sk"); c.appendChild(el("div", "sk-l w40")); c.appendChild(el("div", "sk-l")); c.appendChild(el("div", "sk-l")); g.appendChild(c); }
    return g;
  }
  function notice(title, text) {
    var e = el("div", "empty");
    e.appendChild(el("b", null, title));
    e.appendChild(document.createTextNode(text));
    return e;
  }
  // ---------- fun stuff: streak borders, win/loss pops, confetti (all CSS-driven, played once) ----------
  var STK = {};
  function streakOf(name) {
    var gs = tcGames(name); if (!gs.length) return null;
    var fin = 0; gs.forEach(function (g) { if (g.s === "final") fin++; });
    if (fin === gs.length) return null;                       // season over: a streak means nothing now
    var k = name + ":" + fin; if (STK[k] !== undefined) return STK[k];
    var ts = trendStats(gs);
    return (STK[k] = ts && ts.cur.t !== "T" && ts.cur.n >= 3 ? { t: ts.cur.t, n: ts.cur.n } : null);
  }
  function strCls(v) { return v ? " " + (v.t === "W" ? "fire" : "cold") + (v.n >= 5 ? "5" : "3") : ""; }
  function strPill(v) { return v ? el("span", "stk " + (v.t === "W" ? "hot" : "ice"), (v.t === "W" ? "\uD83D\uDD25 " : "\u2744\uFE0F ") + v.t + v.n) : null; }
  function confetti() {
    var cf = el("span", "cf"); cf.setAttribute("aria-hidden", "true");
    var cols = ["#ffd200", "#ff7a18", "#4ade80", "#38bdf8", "#f472b6"];
    for (var i = 0; i < 14; i++) {
      var p = document.createElement("i"), ang = (i / 14) * Math.PI * 2 + (i % 3) * 0.2, d = 34 + (i % 4) * 14;
      p.style.cssText = "--dx:" + Math.round(Math.cos(ang) * d) + "px;--dy:" + Math.round(Math.sin(ang) * d - 10) + "px;--c:" + cols[i % 5] + ";--r:" + (i * 47 % 360) + "deg;animation-delay:" + (i % 5) * 35 + "ms";
      cf.appendChild(p);
    }
    return cf;
  }
  // ---------- Yesterday > My teams: all your sports on one page ----------
  var SIGMA = { nfl: 13, ncaafb: 14, nba: 12, ncaamb: 11, wnba: 11, ncaawb: 11, nhl: 2, mlb: 3.5, epl: 1.5, ucl: 1.5, mls: 1.5, afl: 28 };
  function tcGames(name) { var T = S.teams[name] && S.teams[name].games ? S.teams[name] : TC[name]; return (T && T.games) || []; }
  function ovSection(title, sub, body) {
    var d = el("details", "ov"); d.open = true;
    var s = el("summary", null); s.appendChild(el("span", "ovt", title)); if (sub) s.appendChild(el("span", "tsub", sub));
    d.appendChild(s); d.appendChild(body); return d;
  }
  function overview(y, played) {
    var box = el("div", "ovs"), W = 0, L = 0, T0 = 0;
    played.forEach(function (t) { if (t.result === "W") W++; else if (t.result === "L") L++; else T0++; });
    // 1. yesterday's results, simple: win/loss badge, team, score
    var body = el("div", "rsw");
    played.forEach(function (t) {
      var row = el("div", "rs " + (t.result === "W" ? "w" : t.result === "L" ? "l" : "t"));
      row.appendChild(el("span", "rsb", t.result));
      var mid = el("div", "rsm"); mid.appendChild(el("b", null, t.name)); mid.appendChild(el("span", null, (t.home ? "vs " : "at ") + t.opp));
      row.appendChild(mid);
      row.appendChild(el("span", "rss", t.my + "\u2013" + t.op + (t.ot ? " OT" : "")));
      body.appendChild(row);
    });
    if (played.length) box.appendChild(ovSection("Yesterday's scores", W + "-" + L + (T0 ? "-" + T0 : ""), body));
    // 2. everything below comes from the schedules already saved on this phone: no network
    var names = C.followed.filter(function (n) { return tcGames(n).some(function (g) { return g.s === "final" && g.my != null; }); });
    if (names.length) {
      var fb = el("div", "fgw"), info = names.map(function (n) { return { n: n, s: trendStats(tcGames(n)), g: tcGames(n).filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime) }; });
      info.sort(function (p, q) { return (q.s ? q.s.pct : 0) - (p.s ? p.s.pct : 0); });
      info.forEach(function (r) {
        var row = el("div", "fg"); row.appendChild(el("div", "dvn", r.n));
        var dots = el("div", "fgd");
        r.g.slice(-10).forEach(function (g, di) { var d2 = el("i", g.my > g.op ? "w" : g.my < g.op ? "l" : "t"); d2.style.setProperty("--i", di); dots.appendChild(d2); });
        row.appendChild(dots);
        var rt = el("div", "dvs", r.s ? Math.round(r.s.pct * 100) + "%" : ""); if (r.s) rt.appendChild(el("small", null, r.s.cur.t + r.s.cur.n));
        row.appendChild(rt);
        fb.appendChild(row);
      });
      box.appendChild(ovSection("Form guide", "last 10 \u00b7 season win %", fb));
    }
    // 3. the week ahead, as a short agenda
    var now = Date.now(), end = now + 7 * DAY, items = [];
    C.followed.forEach(function (n) {
      tcGames(n).forEach(function (g) { var t = new Date(g.t).getTime(); if (g.s === "up" && t > now && t < end) items.push({ n: n, g: g, t: t }); });
    });
    if (items.length) {
      items.sort(function (p, q) { return p.t - q.t; });
      var ag = el("div", "ag"), lastDay = "";
      items.forEach(function (it) {
        var d = new Date(it.t), dk = d.toDateString();
        if (dk !== lastDay) { lastDay = dk; ag.appendChild(el("div", "agd", dk === new Date().toDateString() ? "Today" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))); }
        var r = el("div", "agr");
        r.appendChild(el("span", "agt", d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })));
        r.appendChild(el("b", null, it.n));
        r.appendChild(el("span", "ago", (it.g.home ? "vs " : "at ") + it.g.opp));
        ag.appendChild(r);
      });
      box.appendChild(ovSection("Next 7 days", items.length + " game" + (items.length === 1 ? "" : "s") + " for your teams", ag));
    }
    return box;
  }
  function renderYesterday(out) {
    var sn = el("div", "subnav"); sn.setAttribute("role", "tablist");
    [["teams", "Yesterday"], ["week", "Week"], ["recap", "Recap"]].forEach(function (p) {
      var b = el("button", "sub", p[1]); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", S.ysub === p[0] ? "true" : "false");
      b.onclick = function () {
        if (S.ysub === p[0]) return;
        S.ysub = p[0]; try { localStorage.setItem("sb-ysub", p[0]); } catch (e) {}
        render(); if (p[0] === "teams") loadLeaders();
      };
      sn.appendChild(b);
    });
    out.appendChild(sn);
    if (S.ysub === "recap") { renderRecap(out); renderNews(out); return; }
    if (S.ysub === "week") { renderWeek(out); renderTomorrow(out); return; }
    var y = S.yesterday;
    if (!y) { out.appendChild(notice("No recap yet", "Pull down to load yesterday's results.")); return; }
    out.appendChild(el("p", "lg", y.date));
    var played = y.teams.filter(function (t) { return t.played; });
    if (!played.length) { out.appendChild(notice("No games yesterday", "None of your teams played yesterday.")); out.appendChild(quickScores()); out.appendChild(overview(y, played)); return; }
    var gr = el("div", "recaps");
    played.forEach(function (t) {
      var stv = streakOf(t.name);
      var a = el("article", "recap " + (t.result === "W" ? "w" : t.result === "L" ? "l" : "t") + strCls(stv));
      var h = el("div", "rh");
      var yh = el("h3", null, t.name), yl = logoFor(t.name);
      if (yl) { var yb = el("span", "ab lg sm"); yb.appendChild(logoImg(yl, "")); yh.insertBefore(yb, yh.firstChild); }
      h.appendChild(yh);
      var sp = strPill(stv); if (sp) h.appendChild(sp);
      h.appendChild(el("span", "res" + (t.result === "W" ? " win" : ""), t.result === "W" ? "Won" : t.result === "L" ? "Lost" : "Tied"));
      if (t.result === "W") a.appendChild(confetti());
      a.appendChild(h);
      a.appendChild(el("div", "rl", t.line));
      a.appendChild(el("p", "rb", t.body));
      // The whole card opens that game's detail page.
      a.style.cursor = "pointer"; a.tabIndex = 0; a.setAttribute("role", "button");
      a.setAttribute("aria-label", "Open game: " + t.line);
      (function (t) {
        var go = function () { openGame({ lk: t.lk, g: { id: t.gid } }); };
        a.onclick = go;
        a.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      })(t);
      var L = (S.leaders[t.gid] || []).filter(function (l) { return l.team === t.abbr; }).slice(0, 3);
      if (L.length) {
        var ul = el("ul", "lead");
        L.forEach(function (l) {
          var li = el("li"); li.appendChild(el("b", null, l.name));
          li.appendChild(document.createTextNode(" · " + l.line + (l.cat ? " (" + l.cat.replace(/ Leader$/i, "") + ")" : "")));
          ul.appendChild(li);
        });
        a.appendChild(ul);
      }
      a.appendChild(el("div", "rl", "Box score ›"));
      gr.appendChild(a);
    });
    out.appendChild(gr);
    out.appendChild(quickScores());
    out.appendChild(overview(y, played));
  }
  // Quick scoreboard: yesterday's finals in the big four plus college football's big ones, ranked so the close and
  // the big games sit at the top (your teams first, then upsets, overtime, one-score finishes, ranked matchups).
  var BIG4 = ["nfl", "nba", "nhl", "mlb"];
  function qsHeat(g, lk) {
    var diff = Math.abs(g.h[2] - g.a[2]), t = TIGHT[lk] || 2, h = 0;
    if (isFollowed(g)) h += 100;
    if (g.o) h += 25;
    if (diff <= t) h += 40 - diff * (20 / Math.max(1, t)); else if (diff <= t * 2) h += 10;
    if (g.n) h += 15;
    var rw = g.h[2] > g.a[2] ? g.h : g.a, rl = rw === g.h ? g.a : g.h;
    if (g.h[6] || g.a[6]) h += 20 + (Math.min(g.h[6] || 99, g.a[6] || 99) <= 10 ? 15 : 0) + (rl[6] && !rw[6] ? 45 : 0) + (rl[6] && rw[6] && rw[6] > rl[6] ? 25 : 0);
    if (g.h[6] && g.a[6]) h += 20;
    return h;
  }
  function quickScores() {
    var yk = ESPN.dayKey(new Date(Date.now() - DAY)), box = el("div", "ovs"), body = el("div", "qsw"), rows = [];
    BIG4.concat(["ncaafb"]).forEach(function (lk) {
      var lg = leagueOf(lk); if (!lg) return;
      var gs = (S.yf[lk] || S.games[lk] || []).filter(function (g) { return g.s === "final" && g.h[2] != null && g.a[2] != null && ESPN.dayKey(new Date(g.t)) === yk; });
      if (lk === "ncaafb") gs = gs.filter(function (g) { return g.h[6] || g.a[6] || isFollowed(g); });   // college: ranked teams only
      var L = gs.map(function (g) { return { g: g, lk: lk, ll: lg.label, h: qsHeat(g, lk) }; });
      if (lk === "ncaafb") L = L.sort(function (a, b) { return b.h - a.h; }).slice(0, 8);
      rows = rows.concat(L);
    });
    rows.sort(function (a, b) { return b.h - a.h; });
    rows.forEach(function (r, i) {
      var g = r.g, st = new Date(g.t), pm = st.getHours() >= 19 || (st.getHours() === 18 && st.getMinutes() >= 30), close = Math.abs(g.h[2] - g.a[2]) <= (TIGHT[r.lk] || 2);
      var row = el("div", "qs" + (isFollowed(g) ? " fol" : "") + (pm ? " prime" : "") + (close ? " close" : "")), aw = g.a[2] > g.h[2];
      row.tabIndex = 0; row.setAttribute("role", "button"); row.setAttribute("aria-label", r.ll + ": " + g.a[0] + " " + g.a[2] + ", " + g.h[0] + " " + g.h[2]);
      var a = el("span", "qst" + (aw ? " w" : "")); a.appendChild(el("i", null, (g.a[6] ? g.a[6] + " " : "") + g.a[1])); a.appendChild(el("u", null, String(g.a[2]))); row.appendChild(a);
      row.appendChild(el("span", "qsat", "@"));
      var h = el("span", "qst" + (aw ? "" : " w")); h.appendChild(el("i", null, (g.h[6] ? g.h[6] + " " : "") + g.h[1])); h.appendChild(el("u", null, String(g.h[2]))); row.appendChild(h);
      var f = el("span", "qsf"); f.appendChild(el("em", null, r.lk === "ncaafb" ? "CFB" : r.ll)); f.appendChild(el("b", null, g.o ? "F/OT" : "F")); row.appendChild(f);
      if (pm || close) {
        var tg = el("span", "qstag");
        if (pm) tg.appendChild(el("i", "tpm", "\u263D " + st.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !PREF.h24 })));
        if (close) tg.appendChild(el("i", "tcl", (g.o ? "OT \u00b7 " : "") + "by " + Math.abs(g.h[2] - g.a[2])));
        row.appendChild(tg);
      }
      var go = function () { openGame({ lk: r.lk, g: g }); };
      row.onclick = go; row.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      body.appendChild(row);
    });
    if (!rows.length) body.appendChild(el("p", "rb", "No NFL, NBA, NHL, MLB or ranked college football finals yesterday."));
    box.appendChild(ovSection("Scoreboard", null, body));
    return box;
  }
  // ---------- Tomorrow: a month of what's coming for your teams, summarized (schedules already on the phone) ----------
  function renderTomorrow(out) {
    var now = Date.now(), t0 = new Date(); t0.setHours(0, 0, 0, 0); var day0 = t0.getTime(), to = day0 + 30 * DAY, items = [], per = {};
    C.followed.forEach(function (n) {
      var list = [];
      tcGames(n).forEach(function (g) {
        var t = Date.parse(g.t); if (isNaN(t) || g.s === "final" || t < now - 4 * 3600000 || t >= to) return;
        var it = { n: n, g: g, t: t, d: Math.floor((t - day0) / DAY) }; list.push(it); items.push(it);
      });
      list.sort(function (a, b) { return a.t - b.t; }); per[n] = list;
    });
    out.appendChild(el("p", "lg", "The next 30 days"));
    if (!items.length) { out.appendChild(notice("Nothing scheduled yet", "Fixtures for your teams fill in once their schedules load (My teams).")); C.followed.forEach(loadTeam); return; }
    items.sort(function (a, b) { return a.t - b.t; });
    var box = el("div", "ovs"), fmtD = function (t, long) { return new Date(t).toLocaleDateString(undefined, long ? { weekday: "long", month: "short", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" }); };
    var fmtT = function (t) { return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !PREF.h24 }); };
    // 1. the month at a glance
    var days = {}, homeN = 0, seen = {}, derbies = [];
    items.forEach(function (it) {
      days[it.d] = (days[it.d] || 0) + 1; if (it.g.home) homeN++;
      if (C.followed.indexOf(it.g.opp) >= 0 && !seen[it.g.id]) { seen[it.g.id] = 1; derbies.push(it); }
    });
    var busy = Object.keys(days).sort(function (a, b) { return days[b] - days[a] || a - b; })[0];
    var gap = { n: 0, s: 0 }, run = 0, rs = 0;
    for (var di = 0; di < 30; di++) { if (days[di]) { if (run > gap.n) gap = { n: run, s: rs }; run = 0; rs = di + 1; } else run++; }
    if (run > gap.n) gap = { n: run, s: rs };
    var gl = el("div", "glance"), glr = el("div", "gl-row"); gl.appendChild(glr);
    var chip = function (big, small) { var c = el("div", "gch"); c.appendChild(el("b", null, big)); c.appendChild(el("span", null, small)); glr.appendChild(c); };
    chip(String(items.length), "game" + (items.length === 1 ? "" : "s"));
    chip(homeN + " / " + (items.length - homeN), "home / away");
    if (busy != null && days[busy] > 1) chip(String(days[busy]), "on " + fmtD(day0 + busy * DAY));
    if (gap.n >= 3) chip(gap.n + " days", "off from " + fmtD(day0 + gap.s * DAY));
    var strip = el("div", "mstrip"), lbl = el("div", "mstrip-l");
    for (var k = 0; k < 30; k++) {
      var c = el("i", days[k] ? (days[k] > 1 ? "m" : "g") : ""), dd = new Date(day0 + k * DAY);
      if (k === 0) c.classList.add("today");
      if (days[k]) c.title = fmtD(day0 + k * DAY) + ": " + items.filter(function (it) { return it.d === k; }).map(function (it) { return it.n + (it.g.home ? " vs " : " at ") + it.g.opp; }).join(", ");
      strip.appendChild(c);
      if (k % 7 === 0) { var l = el("span", null, k === 0 ? "Today" : dd.toLocaleDateString(undefined, { month: "short", day: "numeric" })); l.style.setProperty("--k", k); lbl.appendChild(l); }
    }
    gl.appendChild(strip); gl.appendChild(lbl);
    box.appendChild(ovSection("At a glance", null, gl));
    // 2. one line per team: how many, where, and what's next
    var tb = el("div", "tms");
    C.followed.forEach(function (n) {
      var L = per[n]; if (!L || !L.length) return;
      var h = L.filter(function (it) { return it.g.home; }).length, nx = L[0];
      var row = el("div", "tmr"), top = el("div", "tmr-t");
      top.appendChild(el("b", null, n)); top.appendChild(el("span", "dvs", L.length + " game" + (L.length === 1 ? "" : "s") + " · " + h + " home"));
      row.appendChild(top);
      var ms = el("div", "mstrip sm");
      for (var k2 = 0; k2 < 30; k2++) { var it2 = L.filter(function (q) { return q.d === k2; })[0]; var ci = el("i", it2 ? (it2.g.home ? "h" : "a") : ""); if (it2) ci.title = fmtD(it2.t) + (it2.g.home ? " vs " : " at ") + it2.g.opp; ms.appendChild(ci); }
      row.appendChild(ms);
      var nxt = el("div", "tmr-n"); nxt.appendChild(el("span", "tmr-k", "Next")); nxt.appendChild(el("span", null, fmtD(nx.t) + " " + fmtT(nx.t) + (nx.g.home ? " vs " : " at ") + nx.g.opp + (nx.g.b ? " · " + nx.g.b : "")));
      row.appendChild(nxt);
      var b2b = 0; for (var j = 1; j < L.length; j++) if (L[j].d - L[j - 1].d === 1) b2b++;
      if (b2b) { var bb = el("div", "tmr-n"); bb.appendChild(el("span", "tmr-k", "B2B")); bb.appendChild(el("span", null, b2b + " back-to-back" + (b2b === 1 ? "" : "s"))); row.appendChild(bb); }
      tb.appendChild(row);
    });
    box.appendChild(ovSection("Your teams", C.followed.filter(function (n) { return per[n] && per[n].length; }).length + " playing", tb));
    // 3. followed vs followed
    if (derbies.length) {
      var dw = el("div", "ag");
      derbies.forEach(function (it) { var r = el("div", "agr"); r.appendChild(el("span", "agt w", fmtD(it.t))); r.appendChild(el("b", null, (it.g.home ? it.g.opp : it.n) + " at " + (it.g.home ? it.n : it.g.opp))); r.appendChild(el("span", "ago", fmtT(it.t))); dw.appendChild(r); });
      box.appendChild(ovSection("Your teams meet", derbies.length + " game" + (derbies.length === 1 ? "" : "s"), dw));
    }
    // 4. the agenda, a week at a time (this week open, the rest folded)
    var weeks = {};
    items.forEach(function (it) { var w = Math.floor(it.d / 7); (weeks[w] = weeks[w] || []).push(it); });
    Object.keys(weeks).sort(function (a, b) { return a - b; }).forEach(function (w) {
      var ag = el("div", "ag"), ld = "";
      weeks[w].forEach(function (it) {
        var dk = new Date(it.t).toDateString();
        if (dk !== ld) { ld = dk; ag.appendChild(el("div", "agd", it.d === 0 ? "Today" : it.d === 1 ? "Tomorrow" : fmtD(it.t, true))); }
        var r = el("div", "agr"); r.appendChild(el("span", "agt", fmtT(it.t)));
        r.appendChild(el("b", null, it.n)); r.appendChild(el("span", "ago", (it.g.home ? "vs " : "at ") + it.g.opp + (it.g.b ? " · " + it.g.b : ""))); ag.appendChild(r);
      });
      var title = w === "0" ? "This week" : w === "1" ? "Next week" : "Week of " + new Date(day0 + w * 7 * DAY).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      var sec2 = ovSection(title, weeks[w].length + " game" + (weeks[w].length === 1 ? "" : "s"), ag); if (w !== "0") sec2.open = false;
      box.appendChild(sec2);
    });
    out.appendChild(box);
    C.followed.forEach(loadTeam);
  }

  // Leaders for the week's finished games, fetched once per game and kept for the session.
  var WEEKL = {};
  function weekPerf(past) {
    var loading = false, best = {}, order = [];
    past.forEach(function (p) {
      var gid = p.g.id, e = WEEKL[gid];
      if (e === undefined) {
        loading = true; WEEKL[gid] = null;
        ESPN.findTeam(p.n).then(function (f) { if (!f) throw 0; return ESPN.fetchGame(f.lk, gid).then(function (d) { return { lk: f.lk, d: d }; }); }).then(function (r) {
          var rows = r.d.periods ? r.d.periods.rows : null, ab = rows ? rows[p.g.home ? 1 : 0][0] : "";
          WEEKL[gid] = { lk: r.lk, ab: ab, L: (r.d.leaders || []).filter(function (l) { return !ab || l.team === ab; }) };
          if (S.tab === "yesterday" && S.ysub === "week" && !S.view && !S.settings) renderSoon();
        }, function () { WEEKL[gid] = { lk: "", ab: "", L: [] }; });
        return;
      }
      if (e === null) { loading = true; return; }
      e.L.forEach(function (l) {
        var cat = (l.cat || "").replace(/ Leader$/i, ""), v = parseFloat((l.line || "").replace(/^[^\d.]*/, "")) || 0;
        if (!cat) return;
        if (!best[cat]) order.push(cat);
        if (!best[cat] || v > best[cat].v) best[cat] = { v: v, cat: cat, name: l.name, line: l.line, ab: e.ab, opp: p.g.opp, home: p.g.home, t: p.t, lk: e.lk, gid: gid };
      });
    });
    return { loading: loading, rows: order.map(function (c) { return best[c]; }).slice(0, 12) };
  }
  // ---------- Week: the last seven days of results for your teams, day by day, then the best individual lines ----------
  function renderWeek(out) {
    var now = Date.now(), from = now - 7 * DAY, to = now + 7 * DAY, past = [], next = [];
    C.followed.forEach(function (n) {
      tcGames(n).forEach(function (g) {
        var t = Date.parse(g.t); if (isNaN(t)) return;
        if (g.s === "final" && g.my != null && g.op != null && t >= from && t <= now) past.push({ n: n, g: g, t: t });
        else if (g.s !== "final" && t > now && t < to) next.push({ n: n, g: g, t: t });
      });
    });
    out.appendChild(el("p", "lg", "This week"));
    if (!past.length) { out.appendChild(notice("Nothing yet", "Results for your teams fill in once their schedules load (My teams).")); C.followed.forEach(loadTeam); return; }
    var W = 0, L = 0; past.forEach(function (p) { if (p.g.my > p.g.op) W++; else if (p.g.my < p.g.op) L++; });
    var box = el("div", "ovs");
    if (past.length) {
      past.sort(function (a, b) { return b.t - a.t; });
      var body = el("div", "rsw"), lastDay = "";
      past.forEach(function (p) {
        var d = new Date(p.t), dk = d.toDateString();
        if (dk !== lastDay) { lastDay = dk; body.appendChild(el("div", "agd", d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))); }
        var g = p.g, res = g.my > g.op ? "W" : g.my < g.op ? "L" : "T", row = el("div", "rs " + res.toLowerCase());
        row.appendChild(el("span", "rsb", res));
        var mid = el("div", "rsm"); mid.appendChild(el("b", null, p.n)); mid.appendChild(el("span", null, (g.home ? "vs " : "at ") + g.opp)); row.appendChild(mid);
        row.appendChild(el("span", "rss", g.my + "\u2013" + g.op)); body.appendChild(row);
      });
      box.appendChild(ovSection("Last 7 days", W + "-" + L + (past.length - W - L ? "-" + (past.length - W - L) : ""), body));
    }
    // Top individual performances of the week: each finished game's leaders (one cached box score per game), best per category.
    if (past.length) {
      var perf = weekPerf(past), pw = el("div", "ag");
      if (perf.loading && !perf.rows.length) pw.appendChild(el("p", "rb", "Loading box scores\u2026"));
      else if (!perf.rows.length) pw.appendChild(el("p", "rb", "No leader lines for these games yet."));
      perf.rows.forEach(function (r) {
        var row = el("div", "agr pf"); row.tabIndex = 0; row.setAttribute("role", "button");
        row.appendChild(el("span", "agt", r.cat));
        row.appendChild(el("b", null, r.name));
        row.appendChild(el("span", "ago", r.line + " \u00b7 " + r.ab + (r.home ? " vs " : " at ") + r.opp + " \u00b7 " + new Date(r.t).toLocaleDateString(undefined, { weekday: "short" })));
        var go = function () { openGame({ lk: r.lk, g: { id: r.gid } }); };
        row.onclick = go; row.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
        pw.appendChild(row);
      });
      box.appendChild(ovSection("Top performances", perf.rows.length ? "best lines, your teams" : (perf.loading ? "loading" : ""), pw));
    }
    out.appendChild(box);
    C.followed.forEach(loadTeam);
  }

  // ---------- Daily recap: yesterday's biggest stories first, then every result by league ----------
  var HEAT = { nfl: 100, nba: 90, ncaafb: 80, mlb: 70, ucl: 70, epl: 65, nhl: 65, ncaamb: 55, wnba: 50, afl: 40, mls: 35, ufl: 30 };
  var TIGHT = { nfl: 7, ncaafb: 7, nba: 5, wnba: 5, ncaamb: 5, ncaawb: 5, ufl: 7, afl: 6, mlb: 2, nhl: 1, ncaah: 1, ncaawh: 1, ncaabsb: 2, ncaasb: 2 };   // "close game": one score in football, 5 in basketball, 2 runs, 1 goal
  var YCOL = {};
  try { YCOL = JSON.parse(localStorage.getItem("sb-ycol") || "{}") || {}; } catch (e) {}
  var SCORING = { nfl: 1, ncaafb: 1, nba: 1, ncaamb: 1, ncaawb: 1, wnba: 1, gleague: 1, ufl: 1, afl: 1 };
  // Is this a lopsided game, judged in the sport's own terms (set-based sports like volleyball are skipped)?
  function lopsided(x) {
    if (x.g.ev || !x.tot) return false;
    if (SCORING[x.lk]) return x.diff / x.tot >= 0.3;
    var lg = x.lg; return (lg.soccer || x.lk === "nhl" || x.lk === "mlb" || /hockey|baseball|softball/.test(lg.path)) && x.diff >= 3;
  }
  function recapItems() {
    var yk = ESPN.dayKey(new Date(Date.now() - DAY)), out = [];
    LG.forEach(function (l) {
      (S.yf[l.key] || S.games[l.key] || []).forEach(function (g) {
        if (g.s !== "final") return;
        if (l.kind === "race" || l.kind === "golf" ? Date.now() - new Date(g.t) > 4 * DAY : ESPN.dayKey(new Date(g.t)) !== yk) return;
        if (l.soccer && !isFollowed(g) && !bigSoccer(g)) return;   // soccer only for the huge ones: finals, World Cup, title deciders
        var x = { g: g, lk: l.key, ll: l.label, lg: l };
        if (g.ev) { x.heat = (l.kind === "mma" ? 75 : l.kind === "golf" ? 70 : 80) + (isFollowed(g) ? 120 : 0); out.push(x); return; }
        if (g.h[2] == null || g.a[2] == null) return;
        x.diff = Math.abs(g.h[2] - g.a[2]); x.tot = g.h[2] + g.a[2];
        var t = l.soccer ? 1 : (TIGHT[l.key] || 2);
        x.tight = x.diff <= t;
        x.heat = (HEAT[l.key] || (l.soccer ? 30 : 20)) + (isFollowed(g) ? 120 : 0) + (g.o ? 25 : 0) + (x.tight ? 20 : 0) + (g.n ? 25 : 0);
        // Ranked teams make games bigger; a ranked team losing to an unranked one is the day's biggest kind of story.
        var rw = g.h[2] > g.a[2] ? g.h : g.a, rl = rw === g.h ? g.a : g.h;
        if (g.h[6] || g.a[6]) x.heat += 20 + (Math.min(g.h[6] || 99, g.a[6] || 99) <= 10 ? 15 : 0) + (rl[6] && !rw[6] ? 45 : 0) + (rl[6] && rw[6] && rw[6] > rl[6] ? 25 : 0);
        out.push(x);
      });
    });
    return out;
  }
  function bigSoccer(g) { return /\bfinal\b|world cup|euro 20\d\d|copa am|gold cup|championship|title|decider|super ?cup/i.test(g.n || ""); }
  // "Kansas City Chiefs edge Buffalo Bills 27-24 in overtime"
  function headline(x) {
    var g = x.g, lg = x.lg;
    if (g.ev) {
      var P = g.x || {};
      if (g.ev === "mma") { var f = (P.fights || [])[0]; return f && f.win >= 0 ? f.n[f.win] + " wins the main event" + (f.m ? " by " + f.m : "") : g.h[0]; }
      if (g.ev === "golf") { var gr = (P.rows || [])[0]; return gr ? gr[0] + " wins the " + g.h[0] + " (" + gr[2] + ")" : g.h[0]; }
      var rc = (P.sess || []).filter(function (s) { return /^race$/i.test(s.n); })[0], w = rc && rc.rows[0];
      return w ? w[1] + " wins the " + g.h[0] : g.h[0];
    }
    var hw = g.h[2] >= g.a[2], W = hw ? g.h : g.a, L = hw ? g.a : g.h;
    if (g.h[2] === g.a[2]) return tn(g.h) + " and " + tn(g.a) + " draw " + g.h[2] + "-" + g.a[2];
    var low = lg.soccer || x.lk === "nhl" || x.lk === "mlb" || /hockey|baseball|softball/.test(lg.path), r = x.diff / x.tot, v;
    if (L[2] === 0 && low) v = "blank";
    else if (g.o || (x.tight && !low)) v = "edge";
    else if (low) v = x.diff === 1 ? "edge" : x.diff === 2 ? "beat" : x.diff <= 4 ? "top" : "rout";
    else v = r < 0.05 ? "edge" : r < 0.15 ? "beat" : r < 0.28 ? "cruise past" : "rout";
    return tn(W) + " " + v + " " + tn(L) + " " + W[2] + "-" + L[2] + (g.o ? (lg.soccer ? " after extra time" : " in overtime") : "");
  }
  // AP stories open with a dateline ("FOXBOROUGH, Mass. -- —"); drop it from the first paragraph.
  function delede(p) { return String(p || "").replace(/^[A-Z]{2,}(?:[ ,.\u2019']+[A-Za-z.\u2019]+){0,5}\.?\s*(?:\(AP\))?\s*(?:--|\u2014|\u2013)+\s*(?:\(AP\)\s*)?(?:--|\u2014|\u2013)*\s*/, ""); }
  function trunc(s, n) { if (s.length <= n) return s; var t = s.slice(0, n), i = t.lastIndexOf(" "); return t.slice(0, i > n * 0.6 ? i : n) + "…"; }
  function openX(c, x) {
    c.classList.add("click"); c.tabIndex = 0; c.setAttribute("role", "button");
    c.onclick = function () { openGame(x); };
    c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGame(x); } };
    lpCopy(c, x); prefetchOn(c, x);
  }
  // ESPN's AP recap for a finished game: a short lede that expands to the first few paragraphs. Fills in when it arrives (cached), nothing if ESPN has none.
  function narrBlock(x, onHead, max) {
    if (x.g.ev) return null;
    var box = el("div", "narr"); box.hidden = true;
    ESPN.fetchNarrative(x.lk, x.g.id, true).then(function (n) {
      if (!n || !n.paras || !n.paras.length) return;
      if (onHead) onHead(n);
      var p0 = delede(n.paras[0]);
      var lede = trunc(p0, max || 260), more = n.paras.slice(1, 5), cut = lede !== p0;
      var p = el("p", "narr-p", lede); box.appendChild(p);
      if (more.length || cut) {
        var rest = el("div", "narr-more"); rest.hidden = true;
        more.forEach(function (t) { rest.appendChild(el("p", "narr-p", t)); });
        if (n.link) { var ln = el("a", "narr-a", "Full story on ESPN \u203A"); ln.href = n.link; ln.target = "_blank"; ln.rel = "noopener"; ln.onclick = function (e) { e.stopPropagation(); }; rest.appendChild(ln); }
        var tg = el("button", "narr-t", "Read more \u25BE"); tg.type = "button";
        tg.onclick = function (e) {
          e.stopPropagation();
          var open = rest.hidden; rest.hidden = !open; p.textContent = open ? p0 : lede; tg.textContent = open ? "Show less \u25B4" : "Read more \u25BE";
        };
        box.appendChild(rest); box.appendChild(tg);
      }
      box.appendChild(el("div", "narr-s", "Recap via ESPN"));
      box.hidden = false;
    }, function () {});
    box.addEventListener("click", function (e) { e.stopPropagation(); });
    return box;
  }
  function storyCard(x, lead) {
    var g = x.g, c = el("article", "story" + (lead ? " top1" : "") + (isFollowed(g) ? " followed" : ""));
    var top = el("div", "top");
    top.appendChild(el("span", "pill final", g.o ? "Final · OT" : "Final"));
    top.appendChild(isFollowed(g) ? folTag(x.ll) : el("span", "tag", x.ll + (g.n ? " · " + g.n : "")));
    c.appendChild(top);
    var h = el("h3", "st-h", headline(x)); c.appendChild(h);
    if (!g.ev) {
      var hs = g.h[2], as = g.a[2];
      [[g.a, as, hs], [g.h, hs, as]].forEach(function (r) {
        var row = el("div", "row" + (r[1] < r[2] ? " lose" : "")), tm = el("div", "tm");
        tm.appendChild(badge(r[0]));
        var nmw = el("span", "nmw"); nmw.appendChild(rankedName(r[0]));
        if (r[0][3] && !/^0(-0)+$/.test(r[0][3])) nmw.appendChild(el("span", "rec", r[0][3]));
        tm.appendChild(nmw); row.appendChild(tm); row.appendChild(el("span", "sc", String(r[1]))); c.appendChild(row);
      });
    } else {
      var f = (g.x && g.x.fights || [])[0];
      if (g.ev === "mma" && f) c.appendChild(el("p", "st-p", g.h[0] + ". " + f.n.join(" vs ") + (g.x.fights.length > 1 ? " and " + (g.x.fights.length - 1) + " more fights." : "")));
      else if (g.ev === "golf" && g.x.rows && g.x.rows[0]) c.appendChild(el("p", "st-p", g.h[0] + ". " + g.x.rows[0][0] + " " + g.x.rows[0][2] + (g.x.rows[1] ? ", then " + g.x.rows[1][0] + " (" + g.x.rows[1][2] + ")." : ".")));
      else if (g.x && g.x.venue) c.appendChild(el("p", "st-p", g.x.venue));
    }
    var nb = narrBlock(x, function (n) { if (n.h) h.textContent = n.h; }, lead ? 320 : 220); if (nb) c.appendChild(nb);
    openX(c, x);
    return c;
  }
  function renderRecap(out) {
    var items = recapItems(), yd = new Date(Date.now() - DAY);
    out.appendChild(el("p", "lg", new Intl.DateTimeFormat("en-US", { timeZone: C.timezone, weekday: "long", month: "long", day: "numeric" }).format(yd)));
    if (!items.length) { out.appendChild(notice("Nothing to recap yet", "No finished games from yesterday in the loaded leagues. Pull down to refresh.")); return; }
    var games = items.filter(function (x) { return !x.g.ev; });
    var leaguesN = {}; items.forEach(function (x) { leaguesN[x.lk] = 1; });
    var chips = el("div", "chips");
    [[games.length, "games"], [Object.keys(leaguesN).length, "leagues"], [games.filter(function (x) { return x.tight; }).length, "close finishes"], [games.filter(function (x) { return x.g.o; }).length, "overtime"]].forEach(function (c) {
      if (!c[0] && c[1] !== "games") return;
      var s = el("span", "chip"); s.appendChild(el("b", null, String(c[0]))); s.appendChild(document.createTextNode(" " + c[1])); chips.appendChild(s);
    });
    out.appendChild(chips);

    // Top stories: hottest games, at most two per league so one busy league doesn't take over.
    var per = {}, top = items.slice().sort(function (a, b) { return b.heat - a.heat; }).filter(function (x) {
      per[x.lk] = (per[x.lk] || 0) + 1; return per[x.lk] <= 2 || isFollowed(x.g);
    }).slice(0, 6);
    var sec = el("section", "grp"); sec.appendChild(el("h2", null, "Top stories"));
    var gr = el("div", "stories");
    top.forEach(function (x, i) { gr.appendChild(storyCard(x, i === 0)); });
    sec.appendChild(gr); out.appendChild(sec);

    // By the numbers (always says which league each one is from)
    var nums = [];
    var ratio = function (x) { return x.tot ? x.diff / x.tot : 0; };
    var bl = games.filter(lopsided).sort(function (a, b) { return ratio(b) - ratio(a) || b.diff - a.diff; })[0];
    if (bl) nums.push(["Biggest blowout", bl]);
    var hiL = {}, hi = games.filter(function (x) { return SCORING[x.lk]; })
      .sort(function (a, b) { return b.tot - a.tot; }).filter(function (x) { if (hiL[x.lk]) return false; hiL[x.lk] = 1; return true; }).slice(0, 2);
    hi.forEach(function (x) { nums.push(["Highest scoring", x, tn(x.g.a) + " " + x.g.a[2] + ", " + tn(x.g.h) + " " + x.g.h[2] + " (" + x.tot + " combined)"]); });
    var ot = games.filter(function (x) { return x.g.o; });
    if (ot.length) nums.push(["Went to extra time" + (ot.length > 1 ? " (" + ot.length + " games)" : ""), ot[0]]);
    if (nums.length) {
      var ns = el("section", "grp"); ns.appendChild(el("h2", null, "By the numbers"));
      var ul = el("ul", "nums");
      nums.forEach(function (n) {
        var li = el("li"), lb = el("b", null, n[0] + " \u00b7 " + n[1].ll);
        li.appendChild(lb); li.appendChild(document.createTextNode(n[2] || headline(n[1]))); openX(li, n[1]); ul.appendChild(li);
      });
      ns.appendChild(ul); out.appendChild(ns);
    }

    // League by league: a short briefing for each league (what happened, what was close, who was lopsided), then every score.
    var around = el("section", "grp"); around.appendChild(el("h2", null, "League by league"));
    LG.forEach(function (l) {
      var list = items.filter(function (x) { return x.lk === l.key; }).sort(function (a, b) { return b.heat - a.heat; });
      if (!list.length) return;
      var box = el("div", "lgbox" + (YCOL[l.key] ? " shut" : "")), more = S.ymore[l.key], LIM = 10;
      var hb = el("button", "lgh"); hb.type = "button"; hb.setAttribute("aria-expanded", YCOL[l.key] ? "false" : "true");
      hb.appendChild(el("span", "lgh-t", l.label)); hb.appendChild(el("span", "lgh-c", "\u25BE"));
      hb.onclick = function () {
        var shut = box.classList.toggle("shut"); hb.setAttribute("aria-expanded", shut ? "false" : "true");
        if (shut) YCOL[l.key] = 1; else delete YCOL[l.key];
        try { localStorage.setItem("sb-ycol", JSON.stringify(YCOL)); } catch (e) {}
      };
      box.appendChild(hb);
      var body = el("div", "lgb"); box.appendChild(body);
      var br = leagueBrief(list);
      if (br.length) {
        var bu = el("div", "brief");
        br.forEach(function (b) {
          var bw = el("div", "bw"), d = el("div", "bl"), lab = el("span", "bl-l", b[0]), tx = el("span", "bl-t", headline(b[1]));
          d.appendChild(lab); d.appendChild(tx); d.appendChild(el("span", "sr-go", "\u203A")); openX(d, b[1]); bw.appendChild(d); bu.appendChild(bw);
          if (b[0] === "Game of the day" || b[0] === "Down to the wire") {
            var nb = narrBlock(b[1], b[0] === "Game of the day" ? function (n) { if (n.h) tx.textContent = n.h; } : null, 240); if (nb) bw.appendChild(nb);
          }
        });
        body.appendChild(bu);
        body.appendChild(el("div", "bl-s", "All scores"));
      }
      (more ? list : list.slice(0, LIM)).forEach(function (x) {
        var g = x.g, r = el("div", "srow");
        if (g.ev) r.appendChild(el("span", "sr-t", headline(x)));
        else {
          var hw = g.h[2] >= g.a[2], W = hw ? g.h : g.a, L = hw ? g.a : g.h, t = el("span", "sr-t");
          t.appendChild(el("b", null, tn(W) + " " + W[2])); t.appendChild(document.createTextNode(", " + tn(L) + " " + L[2])); r.appendChild(t);
        }
        var tg = el("span", "sr-g");
        if (isFollowed(g)) { var mf = el("span", "mk fol"); mf.appendChild(markIcon()); tg.appendChild(mf); }
        if (g.o) tg.appendChild(el("span", "mk", "OT"));
        else if (x.tight) tg.appendChild(el("span", "mk", "Close"));
        tg.appendChild(el("span", "sr-go", "\u203A")); r.appendChild(tg); openX(r, x); body.appendChild(r);
        if (list.length <= 3) { var sn = narrBlock(x, null, 240); if (sn) body.appendChild(sn); }
      });
      if (list.length > LIM && !more) {
        var mb = el("button", "sr-more", "Show " + (list.length - LIM) + " more"); mb.type = "button";
        mb.onclick = function () { S.ymore[l.key] = true; render(); };
        body.appendChild(mb);
      }
      around.appendChild(box);
    });
    out.appendChild(around);
    out.appendChild(el("p", "rb dim", "Covers your main leagues plus any extra leagues you have opened."));
  }
  // ---------- News: notable stories that are not game results, by league ----------
  var NCOL = {};
  try { NCOL = JSON.parse(localStorage.getItem("sb-ncol") || "{}") || {}; } catch (e) {}
  function renderNews(out) {
    out.appendChild(el("p", "lg", "Latest news"));
    var sec = el("section", "grp"), left = 0, shown = 0, msg = el("p", "rb dim", "Loading headlines\u2026");
    out.appendChild(msg);
    LG.forEach(function (l) {
      if (l.lazy && !(S.yf[l.key] && S.yf[l.key].length) && S.lgState[l.key] !== "done") return;
      left++;
      var box = el("div", "lgbox" + (NCOL[l.key] ? " shut" : "")); box.hidden = true;
      var hb = el("button", "lgh"); hb.type = "button"; hb.setAttribute("aria-expanded", NCOL[l.key] ? "false" : "true");
      hb.appendChild(el("span", "lgh-t", l.label)); hb.appendChild(el("span", "lgh-c", "\u25BE"));
      hb.onclick = function () {
        var shut = box.classList.toggle("shut"); hb.setAttribute("aria-expanded", shut ? "false" : "true");
        if (shut) NCOL[l.key] = 1; else delete NCOL[l.key];
        try { localStorage.setItem("sb-ncol", JSON.stringify(NCOL)); } catch (e) {}
      };
      box.appendChild(hb);
      var body = el("div", "lgb news"); box.appendChild(body); sec.appendChild(box);
      ESPN.fetchNews(l.key).then(function (ns) {
        if (ns.length) {
          ns.forEach(function (n) {
            var ai = el("a", "ni"); ai.href = n.link; ai.target = "_blank"; ai.rel = "noopener";
            ai.appendChild(el("span", "ni-h", n.h));
            if (n.d) ai.appendChild(el("span", "ni-d", trunc(n.d, 160)));
            var hrs = Math.max(1, Math.round((Date.now() - n.t) / 3600000));
            ai.appendChild(el("span", "ni-w", (hrs < 24 ? hrs + "h ago" : Math.round(hrs / 24) + "d ago") + " \u00b7 ESPN \u203A"));
            body.appendChild(ai);
          });
          box.hidden = false; shown++;
        }
        if (--left === 0) msg.textContent = shown ? "Headlines from ESPN, last two days. Betting and fantasy pieces left out." : "No headlines right now.";
      });
    });
    out.appendChild(sec);
  }
  // The few lines that tell you what mattered in one league (skipped for tiny slates, where the scores say it all).
  function leagueBrief(list) {
    if (list.length <= 3) return [];
    var used = {}, out = [], take = function (label, x) { if (!x || used[x.g.id]) return false; used[x.g.id] = 1; out.push([label, x]); return true; };
    take("Game of the day", list[0]);
    var games = list.filter(function (x) { return !x.g.ev; });
    games.filter(function (x) { return x.g.o || x.tight; }).sort(function (a, b) { return (b.g.o ? 1 : 0) - (a.g.o ? 1 : 0) || a.diff - b.diff; }).slice(0, 2)
      .forEach(function (x, i) { take(i ? "Also close" : "Down to the wire", x); });
    var bl = games.filter(lopsided).sort(function (a, b) { return b.diff / b.tot - a.diff / a.tot; })[0];
    if (bl) take("Biggest margin", bl);
    games.filter(function (x) { return isFollowed(x.g); }).slice(0, 2).forEach(function (x) { take("Your team", x); });
    return out;
  }

  // Top performers for yesterday's recaps (one box-score fetch per finished game, cached).
  function loadLeaders() {
    if (!S.yesterday || S.tab !== "yesterday" || S.ysub !== "teams") return;
    S.yesterday.teams.forEach(function (t) {
      if (!t.played || S.leaders[t.gid] !== undefined) return;
      S.leaders[t.gid] = null;
      ESPN.fetchGame(t.lk, t.gid).then(function (d) {
        S.leaders[t.gid] = d.leaders || [];
        if (S.tab === "yesterday" && !S.view && !S.settings) renderSoon();
      }, function () { delete S.leaders[t.gid]; });
    });
  }

  // ---------- my teams (record, standing, schedule) ----------
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  // lk and id are known when the team came from the Find index; otherwise the name is looked up in the team lists.
  // My teams redraws once when its teams have landed (or after 1.2s at most), not once per team: no jumping.
  var TQ = 0, TQS = 0;
  function teamsSoon() {
    if (TQ) return;
    TQ = setTimeout(function () { TQ = 0; if (Object.keys(LT).length && Date.now() - TQS < 1200) { teamsSoon(); return; } renderSoon(); }, 90);
  }
  var LT = {};   // teams with a request in flight (a stale copy on screen re-renders often; it must not refetch each time)
  function loadTeam(name, lk, id, fresh) {
    if ((S.teams[name] && !S.teams[name].stale && !fresh) || LT[name]) return;
    if (!lk && TID[name]) { lk = TID[name].lk; id = TID[name].id; }
    if (!Object.keys(LT).length) TQS = Date.now();
    LT[name] = 1;
    // Show the last saved copy right away; the fresh one replaces it when it arrives.
    if (!S.teams[name] || !S.teams[name].done) S.teams[name] = TC[name] ? Object.assign({ done: true, stale: true }, TC[name]) : { loading: true };   // what's on screen stays until the new copy lands
    (lk && id ? Promise.resolve({ lk: lk, id: id }) : ESPN.findTeam(name)).then(function (f) {
      if (!f) return { missing: true };
      return ESPN.fetchTeamInfo(f.lk, f.id, fresh).then(function (i) { i.lk = f.lk; i.id = f.id; return i; });
    }).then(function (i) {
      S.teams[name] = Object.assign({ done: true }, i);
      if (!i.missing && C.followed.indexOf(name) >= 0) { TC[name] = i; try { localStorage.setItem("sb-tcache", JSON.stringify(TC)); } catch (e) {} }   // only your teams are kept on disk
    }, function () { if (!S.teams[name] || !S.teams[name].stale) S.teams[name] = { done: true, error: true }; else S.teams[name].stale = false; })
      .then(function () { delete LT[name]; if (S.settings) return; if (S.tab === "teams" && !S.view) teamsSoon(); else if (S.view && S.view.team) renderSoon(); });
  }
  // Turns a schedule entry into the game shape the detail page uses, when the schedule carried both teams' details.
  function schedGame(g, T, lk) {
    if (!T || !T.me || !g.o || !lk) return null;
    var me = [T.me[0], T.me[1], g.my, "", T.me[3], T.me[2], 0], op = [g.opp, g.o[0], g.op, "", g.o[2], g.o[1], 0];
    return { id: g.id, lk: lk, s: g.s, t: g.t, h: g.home ? me : op, a: g.home ? op : me, c: g.s === "live" ? "Live" : "", b: g.b || "" };
  }
  var SG = {};   // schedule games shown lately, by league_id, so a tapped row can open even when the game isn't in the lists
  function gameList(label, gs, T, lk) {
    var w = el("div", "tgl"), h4 = el("h4", null, label); w.appendChild(h4);
    if (label === "Next" && gs[0] && gs[0].s === "up") { var cdn = countdown(gs[0].t, true); if (cdn) { var cs2 = el("span", "cd", " · " + cdn); cs2.setAttribute("data-cd", gs[0].t); cs2.setAttribute("data-long", "1"); h4.appendChild(cs2); } }
    if (!gs.length) { w.appendChild(el("p", "rb", label === "Next" ? "Nothing scheduled." : "No results yet.")); return w; }
    gs.forEach(function (g) {
      var r = el("div", "tg");
      r.appendChild(el("span", "tgd", g.s === "final" ? new Date(g.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : when(g.t)));
      r.appendChild(el("span", "tgo", (g.home ? "vs " : "at ") + g.opp));
      if (g.b && g.s === "up") r.appendChild(el("span", "tgb", g.b));
      if (g.s === "final" && g.my != null && g.op != null) {
        var res = g.my > g.op ? "W" : g.my < g.op ? "L" : "T";
        r.appendChild(el("span", "tgr" + (res === "W" ? " win" : ""), res + " " + g.my + "-" + g.op));
      } else if (g.s === "live") r.appendChild(el("span", "tgr", "Live"));
      var sg = schedGame(g, T, lk);
      if (sg) {
        SG[lk + "_" + sg.id] = sg; r.classList.add("click"); r.tabIndex = 0; r.setAttribute("role", "button"); r.setAttribute("aria-label", "Open " + (g.home ? "vs " : "at ") + g.opp);
        var go = function () { openGame({ lk: lk, g: sg, ll: (leagueOf(lk) || {}).label || "" }); };
        r.onclick = go; r.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
      }
      w.appendChild(r);
    });
    return w;
  }
  // Offseason view for a team with no games left: a written season recap built from its schedule results.
  function dshort(g) { return new Date(g.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function resLine(g) { return (g.my > g.op ? "W " : g.my < g.op ? "L " : "T ") + g.my + "-" + g.op + " " + (g.home ? "vs " : "at ") + g.opp; }
  function seasonRecap(a, T) {
    var fin = T.games.filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime);
    var reg = fin.filter(function (g) { return g.st !== 3 && g.st !== 1; }), post = fin.filter(function (g) { return g.st === 3; });
    if (!reg.length) reg = fin;
    var W = 0, L = 0, TT = 0, hw = 0, hl = 0, rw = 0, rl = 0, pf = 0, pa = 0, run = 0, best = 0, bestEnd = null, bw = null, bl = null;
    reg.forEach(function (g) {
      var m = g.my - g.op;
      pf += g.my; pa += g.op;
      if (m > 0) { W++; run++; if (g.home) hw++; else rw++; if (run > best) { best = run; bestEnd = g; } if (!bw || m > bw.my - bw.op) bw = g; }
      else if (m < 0) { L++; run = 0; if (g.home) hl++; else rl++; if (!bl || m < bl.my - bl.op) bl = g; }
      else { TT++; run = 0; }
    });
    var l10 = reg.slice(-10), lw = l10.filter(function (g) { return g.my > g.op; }).length;
    var diff = pf - pa, rec = (T.standing && T.standing.record) || (W + "-" + L + (TT ? "-" + TT : ""));
    var chips = el("div", "chips");
    [[rec, "Record"], [hw + "-" + hl, "Home"], [rw + "-" + rl, "Road"], [lw + "-" + (l10.length - lw), "Last 10"], [(diff >= 0 ? "+" : "") + diff, "Point diff"]].forEach(function (c) {
      var ch = el("span", "chip"); ch.appendChild(el("b", null, c[0])); ch.appendChild(el("i", null, c[1])); chips.appendChild(ch);
    });
    a.appendChild(chips);
    var s = ["Scored " + pf + " and allowed " + pa + " over " + reg.length + " games."];
    if (best >= 3) s.push("Best stretch: " + best + " straight wins, ending " + dshort(bestEnd) + ".");
    if (bw) s.push("Biggest win: " + resLine(bw) + " (" + dshort(bw) + ").");
    if (bl) s.push("Toughest loss: " + resLine(bl) + " (" + dshort(bl) + ").");
    if (post.length) {
      var pw = post.filter(function (g) { return g.my > g.op; }).length;
      s.push("Reached the postseason and went " + pw + "-" + (post.length - pw) + ".");
    } else if (T.standing) s.push("No postseason games.");
    s.push("The season ended with " + resLine(fin[fin.length - 1]) + ".");
    a.appendChild(el("p", "rb", s.join(" ")));
    a.appendChild(gameList("Final games", fin.slice(-3).reverse()));
  }
  // Compact standings table: collapsed by default, scrolls inside its own box so it never stretches the page.
  S.stOpen = S.stOpen || {};
  function standTable(name, st, lk) {
    if (!st.rows || !st.rows.length) return null;
    var d = el("details", "stn");
    d.open = !!S.stOpen[name];
    d.appendChild(el("summary", null, "Standings · " + st.group));
    var box = el("div", "stbox"), t = el("table"), hd = el("tr");
    ["#", "Team", "Record", st.exLabel, "Strk"].forEach(function (c, i) { hd.appendChild(th(c, i === 1 ? "l" : null, "stand")); });
    t.appendChild(hd);
    var mine = null;
    st.rows.forEach(function (r) {
      var tr = el("tr", r.me ? "me" : null);
      [r.rank, r.n, r.rec, r.ex, r.k].forEach(function (v, i) {
        var td = el("td", i === 1 ? "l" : null, String(v));
        if (i === 1 && r.lg) td.insertBefore(mini(r.lg), td.firstChild);
        tr.appendChild(td);
      });
      if (r.me) mine = tr;
      if (lk && r.id && r.nm && !r.me) {   // any other team in the table opens its page
        tr.classList.add("click"); tr.tabIndex = 0; tr.setAttribute("role", "button");
        tr.onclick = function () { openTeam({ lk: lk, id: r.id, name: r.nm, ab: r.n, lg: r.lg }); };
        tr.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); tr.onclick(); } };
      }
      t.appendChild(tr);
    });
    box.appendChild(t); d.appendChild(box);
    d.addEventListener("toggle", function () {
      S.stOpen[name] = d.open;
      if (d.open && mine) box.scrollTop = Math.max(0, mine.offsetTop - box.clientHeight / 2 + 12);
    });
    if (d.open && mine) setTimeout(function () { box.scrollTop = Math.max(0, mine.offsetTop - box.clientHeight / 2 + 12); }, 0);
    return d;
  }
  function formDots(gs) {
    var fin = gs.filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime).slice(-10);
    if (!fin.length) return null;
    var w = el("div", "frm"); w.appendChild(el("span", null, "Form"));
    fin.forEach(function (g) {
      var r = g.my > g.op ? "w" : g.my < g.op ? "l" : "t", i = el("i", r); i.title = resLine(g); w.appendChild(i);
    });
    return w;
  }
  // ---------- team trends: charts and numbers built from the season schedule we already loaded ----------
  var SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, at, kid) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in at) n.setAttribute(k, at[k]);
    if (kid) { var t = document.createElementNS(SVGNS, "title"); t.textContent = kid; n.appendChild(t); }
    return n;
  }
  function recStr(w, l, t) { return w + "-" + l + (t ? "-" + t : ""); }
  function trendStats(gs) {
    var fin = gs.filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime);
    if (fin.length < 3) return null;
    var S0 = { n: fin.length, fin: fin, W: 0, L: 0, T: 0, pf: 0, pa: 0, cum: [], hW: 0, hL: 0, aW: 0, aL: 0, best: 0, run: 0 }, tot = 0;
    fin.forEach(function (g) {
      var w = g.my > g.op ? 1 : g.my < g.op ? 0 : 0.5;
      if (w === 1) S0.W++; else if (w === 0) S0.L++; else S0.T++;
      S0.pf += g.my; S0.pa += g.op; tot += g.my + g.op;
      if (g.home) { if (w === 1) S0.hW++; else if (w === 0) S0.hL++; } else { if (w === 1) S0.aW++; else if (w === 0) S0.aL++; }
      S0.run = w === 1 ? S0.run + 1 : 0; if (S0.run > S0.best) S0.best = S0.run;
      S0.cum.push((S0.W + 0.5 * S0.T) / (S0.W + S0.L + S0.T));
    });
    var avg = tot / fin.length, thr = avg >= 120 ? 5 : avg >= 30 ? 8 : 1;
    S0.thr = thr; S0.cW = 0; S0.cL = 0;
    fin.forEach(function (g) { var d = Math.abs(g.my - g.op); if (d && d <= thr) { if (g.my > g.op) S0.cW++; else S0.cL++; } });
    S0.pct = (S0.W + 0.5 * S0.T) / S0.n;
    var last = fin[fin.length - 1], lt = last.my > last.op ? "W" : last.my < last.op ? "L" : "T", cn = 0;
    for (var qi = fin.length - 1; qi >= 0; qi--) { var qg = fin[qi], qt = qg.my > qg.op ? "W" : qg.my < qg.op ? "L" : "T"; if (qt !== lt) break; cn++; }
    S0.cur = { t: lt, n: cn };
    var l5 = fin.slice(-5), w5 = 0, t5 = 0, l5l = 0, pf5 = 0, pa5 = 0;
    l5.forEach(function (g) { if (g.my > g.op) w5++; else if (g.my < g.op) l5l++; else t5++; pf5 += g.my; pa5 += g.op; });
    S0.l5 = { w: w5, l: l5l, t: t5, n: l5.length, pct: (w5 + 0.5 * t5) / l5.length, pf: pf5 / l5.length, pa: pa5 / l5.length };
    S0.pfAvg = S0.pf / S0.n; S0.paAvg = S0.pa / S0.n;
    S0.mom = S0.l5.pct - S0.pct;                         // how much better (or worse) the last five are than the season
    S0.heat = Math.round(S0.l5.pct * 60 + (S0.mom + 1) * 20 + Math.max(-10, Math.min(10, ((S0.l5.pf - S0.l5.pa) - (S0.pfAvg - S0.paAvg)) / (avg / 8 || 1) * 10)));
    return S0;
  }
  function momLabel(s, off) {
    var up = s.mom >= 0.15, down = s.mom <= -0.15;
    if (off) return up ? ["\u25B2", "Finished hot", "up"] : down ? ["\u25BC", "Faded late", "down"] : ["\u25B6", "Steady to the end", "flat"];
    return up ? ["\u25B2", "Heating up", "up"] : down ? ["\u25BC", "Cooling off", "down"] : ["\u25B6", "Holding steady", "flat"];
  }
  function marginChart(s) {
    var gs = s.fin.slice(-16), W = 300, H = 64, mid = H / 2, mx = 1;
    gs.forEach(function (g) { mx = Math.max(mx, Math.abs(g.my - g.op)); });
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "tsv", role: "img", "aria-label": "Winning and losing margin of the last " + gs.length + " games" }), bw = W / gs.length;
    svg.appendChild(sv("line", { x1: 0, x2: W, y1: mid, y2: mid, class: "t-mid" }));
    gs.forEach(function (g, i) {
      var m = g.my - g.op, h = Math.max(2, Math.abs(m) / mx * (mid - 4));
      svg.appendChild(sv("rect", { x: (i * bw + bw * 0.14).toFixed(1), width: (bw * 0.72).toFixed(1), y: m >= 0 ? (mid - h).toFixed(1) : mid, height: h.toFixed(1), rx: 2, class: m > 0 ? "t-w" : m < 0 ? "t-l" : "t-t", style: "--i:" + i }, (g.home ? "vs " : "at ") + g.opp + " \u00b7 " + (m > 0 ? "W " : m < 0 ? "L " : "T ") + g.my + "-" + g.op));
    });
    return svg;
  }
  function pctChart(s) {
    var W = 300, H = 46, n = s.cum.length, svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "tsv", role: "img", "aria-label": "Win percentage over the season" });
    var y = function (p) { return (4 + (1 - p) * (H - 8)).toFixed(1); }, x = function (i) { return n > 1 ? (4 + i * (W - 8) / (n - 1)).toFixed(1) : W / 2; };
    svg.appendChild(sv("line", { x1: 0, x2: W, y1: y(0.5), y2: y(0.5), class: "t-half" }));
    svg.appendChild(sv("polyline", { points: s.cum.map(function (p, i) { return x(i) + "," + y(p); }).join(" "), class: "t-line", fill: "none", pathLength: 1 }));
    svg.appendChild(sv("circle", { cx: x(n - 1), cy: y(s.cum[n - 1]), r: 3.5, class: "t-dot" }));
    return svg;
  }
  function dlt(v, d, inv) {   // small up/down arrow comparing the last five to the season average
    var diff = v; if (Math.abs(diff) < d) return null;
    var good = inv ? diff < 0 : diff > 0;
    return el("span", "tdl " + (good ? "g" : "b"), (diff > 0 ? "\u25B2 " : "\u25BC ") + Math.abs(diff).toFixed(1));
  }
  function stat(label, big, sub, extra) {
    var d = el("div", "tstat"); d.appendChild(el("div", "tl", label));
    var b = el("div", "tb", big); if (extra) b.appendChild(extra); d.appendChild(b);
    if (sub) d.appendChild(el("div", "ts", sub)); return d;
  }
  function trendsPanel(s, off, first) {
    var box = el("details", "trn"); box.open = !!first;
    var lab = momLabel(s, off), sm = el("summary", null);
    sm.appendChild(el("span", "tm " + lab[2], lab[0] + " " + lab[1]));
    sm.appendChild(el("span", "tsub", s.l5.w + "-" + s.l5.l + (s.l5.t ? "-" + s.l5.t : "") + " in last " + s.l5.n));   // the record sits in the card header (a second "season" count disagreed with it once playoffs counted)
    var dd = el("span", "tdots");
    s.fin.slice(-5).forEach(function (g, di) { var d1 = el("i", g.my > g.op ? "w" : g.my < g.op ? "l" : "t"); d1.style.setProperty("--i", di); dd.appendChild(d1); });
    sm.appendChild(dd);
    box.appendChild(sm);
    var body = el("div", "trb");
    body.appendChild(el("div", "tcap", "Margin, last " + Math.min(16, s.n) + " games"));
    body.appendChild(marginChart(s));
    body.appendChild(el("div", "tcap", "Win % through the season \u00b7 now " + Math.round(s.cum[s.n - 1] * 100) + "%"));
    body.appendChild(pctChart(s));
    var g = el("div", "tstats"), unit = s.pfAvg >= 30 ? "pts" : "";
    g.appendChild(stat("Scored", s.l5.pf.toFixed(1), "last " + s.l5.n + " \u00b7 season " + s.pfAvg.toFixed(1), dlt(s.l5.pf - s.pfAvg, 0.1)));
    g.appendChild(stat("Allowed", s.l5.pa.toFixed(1), "last " + s.l5.n + " \u00b7 season " + s.paAvg.toFixed(1), dlt(s.l5.pa - s.paAvg, 0.1, true)));
    g.appendChild(stat("Home", recStr(s.hW, s.hL), "Away " + recStr(s.aW, s.aL)));
    g.appendChild(stat("Close games", recStr(s.cW, s.cL), "decided by " + s.thr + " or less"));
    body.appendChild(g); box.appendChild(body);
    return box;
  }
  // Active streaks across the teams you follow, wins and losses alike, longest first.
  function heatCheck(rows) {
    var on = rows.filter(function (r) { return !r.off && r.s.cur.t !== "T" && r.s.cur.n >= (r.s.cur.t === "W" ? 1 : 2); }).sort(function (p, q) { return q.s.cur.n - p.s.cur.n || q.s.heat - p.s.heat; });
    if (!on.length) return null;   // only teams on a streak are listed; nobody on one means no panel
    var box = el("section", "heat"); box.appendChild(el("h2", null, "Active streaks"));
    {
      var ul = el("ol", "hl"), mx = on[0].s.cur.n;
      on.forEach(function (r, i) {
        var w = r.s.cur.t === "W", li = el("li", w ? "" : "cold");
        li.appendChild(el("span", "hn", String(i + 1)));
        var mid = el("div", "hm"); mid.appendChild(el("div", "hname", r.name));
        var bar = el("div", "hbar"), fill = el("i", w ? "up" : "down"); fill.style.width = Math.max(8, Math.round(r.s.cur.n / mx * 100)) + "%"; bar.appendChild(fill); mid.appendChild(bar);
        li.appendChild(mid);
        var rt = el("div", "hr"); rt.appendChild(el("b", null, (r.s.cur.n >= 5 ? (w ? "\uD83D\uDD25 " : "\u2744\uFE0F ") : "") + r.s.cur.t + r.s.cur.n)); rt.appendChild(el("span", "tsub", w ? "best " + r.s.best : "losing"));
        li.appendChild(rt); ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    return box;
  }
  // Where a followed person stands right now: live event first, else the next one coming up, else the latest result.
  function personLine(n) {
    var ln = n.toLowerCase(), best = null, rk = { live: 0, up: 1, final: 2 };
    allGames().forEach(function (x) {
      var g = x.g; if (!g.ev || !g.pp || !g.pp.some(function (q) { return q.toLowerCase() === ln; })) return;
      if (!best || rk[g.s] < rk[best.g.s] || (rk[g.s] === rk[best.g.s] && (g.s === "final" ? Date.parse(g.t) > Date.parse(best.g.t) : Date.parse(g.t) < Date.parse(best.g.t)))) best = x;
    });
    if (!best) return "Not in an event right now";
    var g = best.g, P = g.x || {}, d = "";
    if (g.ev === "golf") { var r = (P.rows || []).filter(function (q) { return q[0].toLowerCase() === ln; })[0]; d = r ? (g.s === "up" ? "in the field" : r[1] + " at " + r[2] + (r[5] && g.s === "live" ? " thru " + r[5] : "")) : ""; }
    else if (g.ev === "mma") {
      var f = (P.fights || []).filter(function (q) { return q.n.some(function (m) { return m.toLowerCase() === ln; }); })[0];
      if (f) { var me = f.n.map(function (m) { return m.toLowerCase(); }).indexOf(ln), op = f.n[1 - me]; d = f.s === "post" ? (f.win < 0 ? "no result vs " + op : (f.win === me ? "won" : "lost") + " vs " + op + (f.m ? " by " + f.m : "")) : "vs " + op + (f.s === "in" ? " (live)" : ""); }
    } else {
      var ses = (P.sess || []).filter(function (z) { return z.s !== "pre"; }).sort(function (a, b) { return Date.parse(b.t) - Date.parse(a.t); })[0];
      var rr = ses && ses.rows.filter(function (q) { return q[1].toLowerCase() === ln; })[0]; d = rr ? "P" + rr[0] + " in " + sessName(ses.n) : "entered";
    }
    return g.h[0] + (g.s === "up" ? " · " + when(g.t) : "") + (d ? " · " + d : "");
  }
  function peopleBox() {
    var box = el("section", "ppl");
    if (C.fp.length) {
      C.fp.forEach(function (n) {
        var r = el("div", "pr fol"); r.appendChild(el("span", "pp", "★"));
        var nm = el("span", "pn"); nm.appendChild(el("span", null, n)); nm.appendChild(el("small", null, personLine(n))); r.appendChild(nm);
        var x = el("button", "pdel", "Remove"); x.type = "button"; x.onclick = function () { togglePerson(n); }; r.appendChild(x); box.appendChild(r);
      });
    } else box.classList.add("empty");
    var names = {};
    allGames().forEach(function (x) { (x.g.pp || []).forEach(function (n) { names[n] = 1; }); });
    var f = el("form", "add"), inp = el("input"), dl = el("datalist"), add = el("button", null, "Add");
    inp.placeholder = "Fighter, driver or golfer"; inp.setAttribute("list", "pplnames"); inp.setAttribute("aria-label", "Person name"); inp.autocomplete = "off";
    dl.id = "pplnames"; add.type = "submit";
    Object.keys(names).sort().forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); });
    inp.addEventListener("focus", function () { LG.forEach(function (l) { if (l.kind && S.lgState[l.key] !== "done" && S.lgState[l.key] !== "loading") loadLeague(l.key); }); }, { once: true });
    f.onsubmit = function (e) {
      e.preventDefault();
      var q = inp.value.trim(); if (!q) return;
      var hit = Object.keys(names).filter(function (n) { return n.toLowerCase() === q.toLowerCase(); })[0] || q;
      if (!fpHas(hit)) setFp(C.fp.concat([hit])); else toast("Already following " + hit + ".");
    };
    f.appendChild(clearable(inp, true)); f.appendChild(add); f.appendChild(dl); box.appendChild(f);
    return box;
  }
  function peopleStatus() {
    if (!C.fp.length) return null;
    var box = el("section", "ppl ro"); box.appendChild(el("h3", null, "People you follow"));
    C.fp.forEach(function (n) {
      var r = el("div", "pr fol"); r.appendChild(el("span", "pp", "\u2605"));
      var nm = el("span", "pn"); nm.appendChild(el("span", null, n)); nm.appendChild(el("small", null, personLine(n))); r.appendChild(nm); box.appendChild(r);
    });
    return box;
  }
  // One team's card: record, standing, trends, next and last games. Shared by My teams and the team page.
  function teamBlock(name, heatRows) {
    var tv = S.view && S.view.team && S.view.team.name === name ? S.view.team : null;
    loadTeam(name, tv && tv.lk, tv && tv.id);
    var T = S.teams[name] || {};
    var a = el("article", "recap"), h = el("div", "rh"), lk = T.lk || (S.view && S.view.team && S.view.team.name === name ? S.view.team.lk : "");
    var h3 = el("h3", null, name);
    if (T.standing && T.standing.logo) { var lb = el("span", "ab lg sm"); lb.appendChild(logoImg(T.standing.logo, "")); h3.insertBefore(lb, h3.firstChild); }
    if (!tv && T.lk && T.id) {   // on My teams the name is the way into the team page
      h3.classList.add("click"); h3.tabIndex = 0; h3.setAttribute("role", "link"); h3.appendChild(el("span", "find-go", " \u203A"));
      var goT = function () { openTeam({ lk: T.lk, id: T.id, name: name, ab: T.me ? T.me[1] : "", lg: T.me ? T.me[2] : "" }); };
      h3.onclick = goT; h3.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); goT(); } };
    }
    h.appendChild(h3);
    if (T.standing) h.appendChild(el("span", "res rc", T.standing.record));
    a.appendChild(h);
    var gsAll = T.games || [];
    var off = !!T.done && gsAll.some(function (g) { return g.s === "final"; }) && !gsAll.some(function (g) { return g.s !== "final"; });
    if (off) a.className = "recap off";
    var ups0 = gsAll.filter(function (g) { return g.s === "up"; }).sort(byTime)[0];
    if (T.pre && ups0) a.appendChild(el("div", "rl", "Season starts " + when(ups0.t)));
    if (T.standing) a.appendChild(el("div", "rl", (off ? "Season recap · " : "") + ordinal(T.standing.rank) + " in " + T.standing.group + (!off && T.standing.streak && (parseInt(String(T.standing.streak).replace(/\D/g, ""), 10) || 0) < 3 ? " · streak " + T.standing.streak : "")));   // 3+ already shows as the streak badge
    if (!T.done) { var tsk = el("div", "tsk"); ["w40", "", "w70", ""].forEach(function (w) { tsk.appendChild(el("div", "sk-l" + (w ? " " + w : ""))); }); tsk.appendChild(el("div", "sk-b")); a.appendChild(tsk); a.classList.add("ld"); }
    else if (T.missing || T.error) a.appendChild(el("p", "rb", "Couldn\u2019t load this team."));
    else {
      var gs = T.games || [];
      var stt = T.standing && standTable(name, T.standing, lk);
      if (stt) a.appendChild(stt);
      var ts = trendStats(gs);
      if (ts) {
        a.appendChild(trendsPanel(ts, off, !heatRows.length)); heatRows.push({ name: name, s: ts, off: off });
        if (!off && ts.cur.t !== "T" && ts.cur.n >= 3) { var sv0 = { t: ts.cur.t, n: ts.cur.n }; a.className += strCls(sv0); var sp2 = strPill(sv0); if (sp2) h.appendChild(sp2); }
      }
      else { var fd = formDots(gs); if (fd) a.appendChild(fd); }
      if (off) seasonRecap(a, T);
      else {
        var ups = gs.filter(function (g) { return g.s !== "final"; }).sort(byTime);
        a.appendChild(gameList("Next", ups.slice(0, 5), T, lk));
        if (ups.length > 5) {
          var sd = el("details", "stn"), sb = el("div", "stbox");
          sd.appendChild(el("summary", null, "Full schedule · " + ups.length + " games")); sd.appendChild(sb);
          sd.addEventListener("toggle", function () { if (sd.open && !sb.firstChild) sb.appendChild(gameList("All upcoming", ups, T, lk)); });
          a.appendChild(sd);
        }
        a.appendChild(gameList("Last", gs.filter(function (g) { return g.s === "final"; }).sort(function (x, y) { return byTime(y, x); }).slice(0, 3), T, lk));
      }
    }
    return a;
  }
  // Find a team (My teams, Settings): the index plus the every-sport search; rows open the page, the star follows.
  var TF = {}, TFF = "";
  function teamFinder(key, ph) {
    var st = TF[key] = TF[key] || { q: "", ctl: {} }, box = el("div", "tfind"), inp = el("input", "tf-q"), res = el("div", "tf-res");
    inp.type = "search"; inp.placeholder = ph || "Find any team or athlete"; inp.autocomplete = "off"; inp.setAttribute("aria-label", ph || "Find a team or athlete"); inp.value = st.q; inp.setAttribute("data-tf", key);
    function fill() {
      var q = inp.value.trim().toLowerCase(); st.q = inp.value; res.textContent = "";
      if (!q) { if (D0.activeElement === inp) drawRecent(res); return; }
      var n = drawHits(res, q, st.ctl, { nt: 6, heads: false });
      if (!n && st.ctl.done) res.appendChild(el("p", "find-h", "Nothing matches \u201c" + inp.value.trim() + "\u201d."));
    }
    st.ctl.redraw = function () { if (inp.isConnected) fill(); };
    inp.onfocus = function () { teamIndex().then(fill); if (!inp.value.trim()) fill(); };
    inp.onblur = function () { setTimeout(function () { if (!inp.value.trim() && D0.activeElement !== inp && inp.isConnected) res.textContent = ""; }, 150); };
    inp.oninput = fill;
    inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); var r = res.querySelector(".find-tm"); if (r) r.onclick(); } if (e.key === "Escape") { inp.value = ""; inp.dispatchEvent(new Event("input")); inp.blur(); } };
    box.appendChild(clearable(inp)); box.appendChild(res);
    if (st.q) { teamIndex().then(fill); fill(); }
    if (TFF === key) { TFF = ""; requestAnimationFrame(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }); }
    return box;
  }
  function renderTeams(out) {
    var heatRows = [], heatSlot = el("div"), ps = peopleStatus(); if (ps) out.appendChild(ps);
    out.appendChild(teamFinder("teams", "Add a team or athlete")); out.appendChild(heatSlot);
    var gr = el("div", "recaps");
    C.followed.forEach(function (name) { gr.appendChild(teamBlock(name, heatRows)); });
    var hc = heatCheck(heatRows); if (hc) heatSlot.appendChild(hc);
    out.appendChild(gr);
  }

  // ---------- settings ----------
  // lk: reload just that league (a team was followed there); false: no reload (an unfollow); omitted: full reload.
  // Team pages don't depend on who you follow, so their data stays; only the saved copies follow the list.
  function setFollowed(list, lk) {
    C.followed = list;
    try { localStorage.setItem("sb-followed", JSON.stringify(list)); } catch (e) {}
    var tc = false;
    Object.keys(TC).forEach(function (n) { if (list.indexOf(n) < 0) { delete TC[n]; tc = true; } });
    list.forEach(function (n) { var T = S.teams[n]; if (!TC[n] && T && T.done && !T.missing && !T.error && T.games) { TC[n] = tcOf(T); tc = true; } });
    if (tc) try { localStorage.setItem("sb-tcache", JSON.stringify(TC)); } catch (e) {}
    S.yesterday = buildYesterday(new Date()); loadLeaders(); render();
    if (lk === false) return;
    if (lk) { var lg = leagueOf(lk); if (lg && lg.lazy && S.lgState[lk] !== "done") loadLeague(lk); else load(true, [lk]); }
    else load(true);
  }
  function tcOf(T) { var o = {}; Object.keys(T).forEach(function (k) { if (k !== "done" && k !== "stale") o[k] = T[k]; }); return o; }
  function renderSettings(out) {
    // A header like every other page: Back to where you were, and the page's name.
    var back = el("button", "back", "\u2039 Back"); back.type = "button"; back.onclick = function () { S.settings = false; render(); window.scrollTo(0, 0); };
    var nav = el("div", "navbar"); nav.appendChild(back); nav.appendChild(el("span", "mini-sc", "Settings")); out.appendChild(nav);
    var box = el("div", "set");
    box.appendChild(el("h3", null, "Teams you follow"));
    var ul = el("ul", "fl");
    C.followed.forEach(function (n) {
      var li = el("li"); li.appendChild(el("span", null, n));
      var x = el("button", null, "Remove"); x.type = "button";
      x.onclick = function () { var T = S.teams[n] || TC[n] || {}; setFollowed(C.followed.filter(function (q) { return q !== n; }), false); dynTidy(T.lk); };
      li.appendChild(x); ul.appendChild(li);
    });
    box.appendChild(ul);
    box.appendChild(teamFinder("set", "Add a team: search any league"));
    box.appendChild(el("h3", null, "People you follow"));
    var pb = peopleBox(); pb.classList.add("inset"); box.appendChild(pb);
    box.appendChild(el("h3", null, "Share your teams"));
    box.appendChild(el("p", "hcold", "Send a link that adds your teams and people to someone else\u2019s scoreboard."));
    var shb = el("button", null, "Copy share link"); shb.type = "button";
    shb.onclick = function () {
      var code = btoa(unescape(encodeURIComponent(JSON.stringify({ t: C.followed, p: C.fp })))).replace(/=+$/, "");
      var url = location.origin + location.pathname + "?add=" + code;
      if (navigator.share) navigator.share({ title: "My teams on Scoreboard", url: url }).catch(function () { copyText(url, "Link copied"); });
      else copyText(url, "Link copied");
    };
    box.appendChild(shb);

    // One row per preference: a label, a short hint and a segmented control.
    function segRow(label, hint, opts, cur, onPick) {
      var wide = opts.length > 3 || opts.map(function (o) { return o[1]; }).join("").length > 18;   // long choices go on their own line under the label
      var r = el("div", "prow" + (wide ? " wide" : "")), lw = el("div", "pl"); lw.appendChild(el("b", null, label)); if (hint) lw.appendChild(el("small", null, hint)); r.appendChild(lw);
      var sg = el("div", "seg");
      opts.forEach(function (o) {
        var b = el("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(o[0]) === String(cur) ? "true" : "false");
        b.onclick = function () { [].forEach.call(sg.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); onPick(o[0]); };
        sg.appendChild(b);
      });
      r.appendChild(sg); return r;
    }
    var pref = function (k, label, hint, opts, rerender) { return segRow(label, hint, opts, PREF[k], function (v) { setPref(k, v); if (rerender) render(); }); };
    var ONOFF = [[true, "On"], [false, "Off"]];
    box.appendChild(el("h3", null, "Look"));
    box.appendChild(pref("compact", "Compact cards", "Tighter cards, no records", ONOFF, true));
    box.appendChild(pref("logos", "Team logos", "Off shows abbreviations", ONOFF, true));
    box.appendChild(pref("text", "Text size", "", [["n", "Normal"], ["l", "Large"]]));
    box.appendChild(el("h3", null, "Behavior"));
    box.appendChild(pref("tab0", "Open on", "Which tab the app starts on", [["last", "Last used"], ["pinned", "Following"], ["yesterday", "Yesterday"], ["teams", "My teams"], ["top", "Top games"]]));
    box.appendChild(pref("upwin", "Upcoming games", "How far ahead the lists go", [["1", "24 hours"], ["3", "3 days"], ["all", "Everything"]], true));
    box.appendChild(pref("alerts", "Score alerts", "Pop-ups when your teams score or finish", ONOFF));
    box.appendChild(segRow("Notify at final", "A phone notification when a followed game ends (app open or in the background)", ONOFF, PREF.notify, function (v) {
      if (!v) { setPref("notify", false); return; }
      if (!("Notification" in window)) { toast("This browser can\u2019t show notifications"); setPref("notify", false); render(); return; }
      Notification.requestPermission().then(function (p) { if (p === "granted") { setPref("notify", true); notify("Notifications on", "You\u2019ll hear when a followed game ends."); } else { toast("Notifications are blocked for this site"); setPref("notify", false); render(); } });
    }));
    box.appendChild(el("h3", null, "Leagues in All"));
    box.appendChild(el("p", "hcold", "Tap a league to hide it from the All tab. Its own tab and your teams are never hidden."));
    var lw = el("div", "lchips");
    LG.forEach(function (l) {
      if (l.lazy && EAGER.indexOf(l.key) < 0 && S.lgState[l.key] !== "done") return;
      var off = PREF.hideL.indexOf(l.key) >= 0, b = el("button", "lchip" + (off ? " off" : ""), l.label); b.type = "button"; b.setAttribute("aria-pressed", off ? "false" : "true");
      b.onclick = function () { var i = PREF.hideL.indexOf(l.key); if (i >= 0) PREF.hideL.splice(i, 1); else PREF.hideL.push(l.key); setPref("hideL", PREF.hideL); b.classList.toggle("off"); b.setAttribute("aria-pressed", b.classList.contains("off") ? "false" : "true"); };
      lw.appendChild(b);
    });
    box.appendChild(lw);
    box.appendChild(el("h3", null, "Feel"));
    box.appendChild(pref("h24", "24-hour clock", "", ONOFF, true));
    box.appendChild(pref("haptic", "Haptics", "Little taps on buttons (phones)", ONOFF));
    box.appendChild(pref("motion", "Animations", "Off makes every move instant", ONOFF));
    box.appendChild(pref("splash", "Splash screen", "The one-second intro when the app opens", ONOFF));

    box.appendChild(el("h3", null, "Reset"));
    var rs = el("button", null, "Back to default teams"); rs.type = "button";
    rs.onclick = function () { try { localStorage.removeItem("sb-followed"); } catch (e) {} setFollowed(DEFAULT_FOLLOWED.slice()); };
    box.appendChild(rs);
    box.appendChild(el("h3", null, "App"));
    box.appendChild(el("p", "hcold", "Version 2.0 \u00b7 build " + (FV.replace(/^v=/, "") || "dev") + ". Keys: 1 2 3 4 tabs \u00b7 f find a game \u00b7 / leagues \u00b7 r refresh \u00b7 p profile \u00b7 t top \u00b7 Esc back."));
    var rl = el("button", null, "Reload app"); rl.type = "button";
    rl.onclick = function () { try { localStorage.removeItem("sb-cache"); } catch (e) {} location.reload(); };
    box.appendChild(rl);
    if (window.FUN) { box.appendChild(el("h3", null, "Collection Log")); box.appendChild(el("p", "hcold", FUN.count() + " of " + FUN.total + " cards found. Hint: poke things, visit at odd hours, try a classic cheat code."));
      var cb = el("button", null, "Open profile and Collection Log"); cb.type = "button"; cb.onclick = function () { openProf("log"); }; box.appendChild(cb);
      box.appendChild(el("h3", null, "New card reveal"));
      var rv = el("div", "seg"), rc = "f"; try { rc = localStorage.getItem("sb-rv") || "f"; } catch (e) {}
      [["f", "Full show"], ["q", "Quick toast"], ["0", "Off"]].forEach(function (o) {
        var b = el("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", o[0] === rc ? "true" : "false");
        b.onclick = function () { try { if (o[0] === "f") localStorage.removeItem("sb-rv"); else localStorage.setItem("sb-rv", o[0]); } catch (e) {} [].forEach.call(rv.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); };
        rv.appendChild(b);
      });
      box.appendChild(rv);
      box.appendChild(el("p", "hcold", "Off keeps finding cards quietly: they still land in the log with a NEW badge."));
      box.appendChild(el("h3", null, "Card pack pop-ups"));
      var pk = el("div", "seg"), pc = "1"; try { pc = localStorage.getItem("sb-pk") || "1"; } catch (e) {}
      [["1", "On"], ["0", "Off"]].forEach(function (o) {
        var b = el("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", o[0] === pc ? "true" : "false");
        b.onclick = function () { try { if (o[0] === "1") localStorage.removeItem("sb-pk"); else localStorage.setItem("sb-pk", "0"); } catch (e) {} [].forEach.call(pk.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); };
        pk.appendChild(b);
      });
      box.appendChild(pk);
      box.appendChild(el("p", "hcold", "Off: packs still pile up, the gold dot on the profile button says when one is ready.")); }
    out.appendChild(box);
  }

  // One tap: copies a clean score line, ready to paste into Discord or a text.
  function scoreLine(x0) {
    var x = x0 || S.view.x, g = x.g, pa = (leagueOf(x.lk) || {}).path || "", em = /^football/.test(pa) ? "🏈" : /^basketball/.test(pa) ? "🏀" : /^hockey/.test(pa) ? "🏒" : /^baseball/.test(pa) ? "⚾" : /^australian/.test(pa) ? "🏉" : /^soccer/.test(pa) ? "⚽" : /^volleyball/.test(pa) ? "🏐" : /^lacrosse/.test(pa) ? "🥍" : /^field-hockey/.test(pa) ? "🏑" : "";
    if (g.ev) {
      var top = g.ev === "mma" ? (g.x.fights[0] && g.x.fights[0].win >= 0 ? g.x.fights[0].n[g.x.fights[0].win] + " won the main event" : "") : g.ev === "golf" ? (((g.x.rows || [])[0] || [])[0] || "") : (((g.x.sess.filter(function (s) { return /^race$/i.test(s.n); })[0] || { rows: [] }).rows[0] || [])[1] || "");
      var etx = (g.ev === "mma" ? "🥊 " : g.ev === "golf" ? "⛳ " : "🏁 ") + g.h[0] + " · " + (g.s === "final" ? "Final" + (top ? " · " + (g.ev === "mma" ? top : "Winner: " + top) : "") : g.s === "live" ? g.c || "Live" : when(g.t));
      return etx;
      return;
    }
    var txt = g.s === "up" ? g.a[0] + " at " + g.h[0] + " · " + when(g.t)
      : g.a[0] + " " + g.a[2] + ", " + g.h[0] + " " + g.h[2] + " · " + (g.s === "final" ? "Final" : g.c || "Live");
    txt = (em ? em + " " : "") + txt;
    return txt;
  }
  function copyText(t, msg) {
    try { navigator.clipboard.writeText(t).then(function () { toast(msg || "Copied: " + t); }, function () { toast("Could not copy"); }); } catch (e) { toast("Could not copy"); }
  }
  function copyScore(x) { copyText(scoreLine(x || S.view.x)); }
  function sharePlay(x) {
    var t = scoreLine(x);
    if (navigator.share) { navigator.share({ title: x.g.a[0] + " at " + x.g.h[0], text: t }).catch(function () {}); return; }
    copyText(t, "Copied to share: " + t);
  }
  function togglePin(x) {
    var k = pinKey(x), i = PINS.indexOf(k);
    if (i >= 0) PINS.splice(i, 1); else PINS.push(k);
    savePins(); toast(i >= 0 ? "Unpinned" : "Pinned to the top of every list");
    if (!S.settings) render();
  }
  // ESPN's own page for a game, for the long-press menu (only for the sports whose URL pattern is known).
  function espnUrl(x) {
    var lg = leagueOf(x.lk) || {}, p = (lg.path || "").split("/");
    if (lg.kind || !p[1]) return "";
    if (lg.soccer) return "https://www.espn.com/soccer/match/_/gameId/" + x.g.id;
    if (!/^(football|basketball|hockey|baseball)$/.test(p[0])) return "";
    return "https://www.espn.com/" + p[1] + "/game/_/gameId/" + x.g.id;
  }
  // "Add to calendar": a one-event .ics file for an upcoming game (opens the phone's calendar).
  function icsFor(x) {
    var g = x.g, st = new Date(g.t), en = new Date(st.getTime() + 3 * 3600000), f = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
    var title = g.ev ? g.h[0] : g.a[0] + " at " + g.h[0], esc = function (t) { return String(t).replace(/[\\;,]/g, function (m) { return "\\" + m; }); };
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Scoreboard//EN", "BEGIN:VEVENT", "UID:sb-" + x.lk + "-" + g.id + "@scoreboard", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(st), "DTEND:" + f(en), "SUMMARY:" + esc(title), "DESCRIPTION:" + esc(x.ll + (g.b ? " \u00b7 " + g.b : "")), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    try {
      var u = URL.createObjectURL(new Blob([body], { type: "text/calendar" })), a = el("a"); a.href = u; a.download = title.replace(/[^\w ]+/g, "").trim().replace(/ +/g, "-") + ".ics"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000); toast("Calendar event ready");
    } catch (e) { toast("Could not make the calendar event"); }
  }
  // Long-press menu: copy, pin or share the game.
  var LPM = null;
  function lpClose() { if (!LPM) return; var o = LPM; LPM = null; o.classList.remove("in"); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 180); }
  function lpMenu(x) {
    lpClose();
    var g = x.g, ov = el("div", "lpm"), sh = el("div", "lpm-s");
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Game actions");
    sh.appendChild(el("div", "lpm-t", g.ev ? g.h[0] : g.a[0] + " at " + g.h[0]));
    var acts = [["Copy score", function () { copyScore(x); }], [isPinned(x) ? "Unpin" : "Pin to top", function () { togglePin(x); }], ["Share", function () { sharePlay(x); }]], eu = espnUrl(x);
    if (g.s === "up") acts.push(["Add to calendar", function () { icsFor(x); }]);
    if (!g.ev && g.a[4] && g.h[4]) { acts.push([g.a[0], function () { openTeam(teamOfSide(x.lk, g.a)); }]); acts.push([g.h[0], function () { openTeam(teamOfSide(x.lk, g.h)); }]); }
    if (eu) acts.push(["Open on ESPN", function () { var a = el("a"); a.href = eu; a.target = "_blank"; a.rel = "noopener"; a.click(); }]);
    acts.forEach(function (r) {
      var b = el("button", "lpm-b", r[0]); b.type = "button"; b.onclick = function () { lpClose(); r[1](); }; sh.appendChild(b);
    });
    var cn = el("button", "lpm-b lpm-c", "Cancel"); cn.type = "button"; cn.onclick = lpClose; sh.appendChild(cn);
    ov.appendChild(sh); ov.onclick = function (e) { if (e.target === ov) lpClose(); };
    document.body.appendChild(ov); LPM = ov; requestAnimationFrame(function () { ov.classList.add("in"); });
  }
  function shareGame() {
    var g = S.view.x.g, data = { title: g.a[0] + " at " + g.h[0], url: location.href };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    try { navigator.clipboard.writeText(location.href).then(function () { toast("Link copied"); }, function () { toast("Could not copy the link"); }); }
    catch (e) { toast("Could not copy the link"); }
  }

  // ---------- stat tooltips: what each column means (hover on a desktop, tap on a phone) ----------
  var TIPS = {
    MIN: "Minutes played", PTS: "Points", REB: "Rebounds", AST: "Assists", STL: "Steals", BLK: "Blocks", TO: "Turnovers", PF: "Personal fouls", FG: "Field goals made\u2013attempted", "3PT": "Three-pointers made\u2013attempted", FT: "Free throws made\u2013attempted", OREB: "Offensive rebounds", DREB: "Defensive rebounds", "+/-": "Plus\u2013minus: how the score moved while this player was in", "FG%": "Field goal percentage", "3P%": "Three-point percentage", "FT%": "Free throw percentage",
    "C/ATT": "Completions / attempts", YDS: "Yards", AVG: "Average per attempt", TD: "Touchdowns", INT: "Interceptions", QBR: "ESPN Total QBR (0\u2013100)", RTG: "Passer rating", CAR: "Carries", LONG: "Longest play", REC: "Receptions", TGTS: "Targets", FUM: "Fumbles", LOST: "Fumbles lost", TOT: "Total tackles", SOLO: "Solo tackles", SACKS: "Sacks", TFL: "Tackles for loss", PD: "Passes defended", "QB HTS": "Quarterback hits", XP: "Extra points made\u2013attempted", NO: "Number of punts", TB: "Touchbacks", "IN 20": "Punts downed inside the 20", ATT: "Attempts",
    G: "Goals", A: "Assists", S: "Shots", SOG: "Shots on goal", PIM: "Penalty minutes", HT: "Hits", HITS: "Hits", BS: "Blocked shots", "FO%": "Faceoff win percentage", PPG: "Power-play goals", PPA: "Power-play assists", SHG: "Short-handed goals", TOI: "Time on ice", GA: "Goals against", SA: "Shots against", SV: "Saves", "SV%": "Save percentage", ESSV: "Even-strength saves", PPSV: "Power-play saves", SHSV: "Short-handed saves", TK: "Takeaways", GV: "Giveaways", GF: "Goals for",
    AB: "At-bats", R: "Runs", H: "Hits", RBI: "Runs batted in", HR: "Home runs", BB: "Walks", K: "Strikeouts", SO: "Strikeouts", "#P": "Pitches seen", OBP: "On-base percentage", SLG: "Slugging percentage", OPS: "On-base plus slugging", "H-AB": "Hits / at-bats", IP: "Innings pitched", ER: "Earned runs", ERA: "Earned run average", "PC-ST": "Pitches / strikes", PC: "Pitch count", ST: "Strikes", "2B": "Doubles", "3B": "Triples", SB: "Stolen bases", LOB: "Runners left on base", WHIP: "Walks + hits per inning pitched", BF: "Batters faced", CS: "Caught stealing", RS: "Runs scored", RA: "Runs allowed",
    SH: "Shots", FC: "Fouls committed", FD: "Fouls drawn", OF: "Offsides", YC: "Yellow cards", RC: "Red cards", GP: "Games played", W: "Wins", L: "Losses", OTL: "Overtime losses", PCT: "Win percentage", GB: "Games back", DIFF: "Point differential", STRK: "Current streak (W wins, L losses)", RECORD: "Wins\u2013losses", PTS2: "Points", "PD": "Point differential", OT: "Overtime", ET: "Extra time", "1H": "First half", "2H": "Second half",
    "per:T": "Total", "stand:T": "Ties", "stand:PTS": "Standings points", "stand:GA": "Goals against", "hockey:A": "Assists", "baseball:K": "Strikeouts",
  };
  var ORD = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth"];
  function tipFor(col, ctx) {
    var c = String(col || "").trim(), m; if (!c || c.length > 7) return "";
    var k = c.toUpperCase();
    if (ctx && TIPS[ctx + ":" + k]) return TIPS[ctx + ":" + k];
    if (ctx === "per") {
      if ((m = /^Q(\d)$/.exec(k))) return (ORD[+m[1]] || m[1] + "th") + " quarter";
      if ((m = /^P(\d)$/.exec(k))) return (ORD[+m[1]] || m[1] + "th") + " period";
      if ((m = /^S(\d)$/.exec(k))) return "Set " + m[1];
      if ((m = /^OT(\d*)$/.exec(k))) return m[1] ? "Overtime " + m[1] : "Overtime";
      if (/^\d+$/.test(k)) return (ORD[+k] || k + "th") + " inning";
    }
    return TIPS[k] || "";
  }
  var TIPB = null, TIPT = 0;
  function tipShow(th) {
    var r = th.getBoundingClientRect();
    if (!TIPB) { TIPB = el("div", "tipb"); TIPB.setAttribute("role", "tooltip"); document.body.appendChild(TIPB); }
    TIPB.textContent = ""; TIPB.appendChild(el("b", null, th.textContent)); TIPB.appendChild(document.createTextNode(th.getAttribute("data-tip")));
    TIPB.style.left = Math.max(136, Math.min(window.innerWidth - 136, r.left + r.width / 2)) + "px";
    TIPB.style.bottom = (window.innerHeight - r.top + 6) + "px";
    TIPB.classList.add("in"); clearTimeout(TIPT); TIPT = setTimeout(tipHide, 3200);
  }
  function tipHide() { if (TIPB) TIPB.classList.remove("in"); clearTimeout(TIPT); }
  (function () {
    var out = $("out"), hov = 0, thOf = function (e) { return e.target && e.target.closest && e.target.closest("th[data-tip]"); };
    out.addEventListener("click", function (e) { var th = thOf(e); if (th) { tipShow(th); e.stopPropagation(); } });
    out.addEventListener("pointerover", function (e) { if (e.pointerType === "touch") return; var th = thOf(e); if (th) { clearTimeout(hov); hov = setTimeout(function () { tipShow(th); }, 160); } });
    out.addEventListener("pointerout", function (e) { if (e.pointerType === "touch") return; if (thOf(e)) { clearTimeout(hov); tipHide(); } });
    out.addEventListener("focusin", function (e) { var th = thOf(e); if (th) tipShow(th); });
    out.addEventListener("focusout", tipHide);
    out.addEventListener("scroll", tipHide, true);
    window.addEventListener("scroll", tipHide, { passive: true });
    document.addEventListener("click", function (e) { if (!thOf(e)) tipHide(); }, true);
  })();
  function th(txt, cls, ctx) {
    var h = el("th", cls || null, txt), tp = tipFor(txt, ctx);
    if (tp) { h.setAttribute("data-tip", tp); h.tabIndex = 0; }
    return h;
  }

  // ---------- detail view ----------
  function tbl(t, ctx) {
    var tw = el("div", "tw"), tb = el("table"), hd = el("thead"), hr = el("tr");
    t.cols.forEach(function (c, i) { hr.appendChild(th(c, i === 0 ? "l" : null, ctx)); });
    hd.appendChild(hr); tb.appendChild(hd);
    var bd = el("tbody");
    t.rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (v, i) { tr.appendChild(el("td", i === 0 ? "l" : null, v == null ? "–" : String(v))); });
      bd.appendChild(tr);
    });
    tb.appendChild(bd); tw.appendChild(tb);
    return tw;
  }
  // Column titles for the score-by-period table, by sport.
  function perLabel(lk, i) {
    var lg = leagueOf(lk) || {};
    if (lg.soccer) return i === 0 ? "1H" : i === 1 ? "2H" : "ET";
    var pa = lg.path || "";
    if (/^hockey/.test(pa)) return i < 3 ? "P" + (i + 1) : "OT";
    if (/^baseball/.test(pa)) return String(i + 1);
    if (lk === "ncaamb") return i < 2 ? (i + 1) + "H" : "OT";
    if (/^volleyball/.test(pa)) return "S" + (i + 1);
    return i < 4 ? "Q" + (i + 1) : "OT" + (i > 4 ? i - 3 : "");
  }
  // Home win chance over the game as a tiny line chart (top = home team more likely to win).
  function wpChart(pts, g) {
    var NS = "http://www.w3.org/2000/svg", w = el("div", "wp"), sv = document.createElementNS(NS, "svg");
    sv.setAttribute("viewBox", "0 0 100 100"); sv.setAttribute("preserveAspectRatio", "none"); sv.setAttribute("role", "img");
    sv.setAttribute("aria-label", "Win probability for " + g.h[0] + " over the game");
    var ln = document.createElementNS(NS, "line"); ln.setAttribute("x1", 0); ln.setAttribute("x2", 100); ln.setAttribute("y1", 50); ln.setAttribute("y2", 50); sv.appendChild(ln);
    var pl = document.createElementNS(NS, "polyline");
    pl.setAttribute("points", pts.map(function (p, i) { return (i / (pts.length - 1) * 100).toFixed(1) + "," + (100 - p); }).join(" "));
    sv.appendChild(pl); w.appendChild(sv);
    var last = pts[pts.length - 1];
    w.appendChild(el("p", null, g.h[1] + " " + last + "% · " + g.a[1] + " " + (100 - last) + "%"));
    return w;
  }
  function pretty(s) {
    return s.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ").map(function (w) {
      return w === "defenses" ? "Defensemen" : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }
  // A collapsible section. Open/closed choices are remembered while the page is open.
  function sec(title, node, open, fav, logo) {
    var key = (S.view ? S.view.key : "") + "|" + title;
    if (openState[key] !== undefined) open = openState[key];
    var d = el("details", "sec" + (fav ? " fav" : ""));
    if (open) d.open = true;
    var sm = el("summary", null, title);
    if (logo) sm.insertBefore(mini(logo), sm.firstChild);
    d.appendChild(sm);
    var b = el("div", "body"); b.appendChild(node); d.appendChild(b);
    d.addEventListener("toggle", function () { openState[key] = d.open; });
    return d;
  }
  // A top-level collapsible that holds several section cards (primary / secondary stats).
  function tier(title, kids, open) {
    if (!kids.length) return null;
    var w = el("div", "tiered");
    kids.forEach(function (k) { w.appendChild(k); });
    var t = sec(title, w, open, false); t.classList.add("tier");
    return t;
  }
  // Detail for an event sport: every fight on the card, or every session of the race weekend with its results.
  // ---------- following people (fighters, drivers, golfers) ----------
  function setFp(list) {
    var added = list.length > C.fp.length;
    C.fp = list; fpIdx();
    try { localStorage.setItem("sb-fp", JSON.stringify(list)); } catch (e) {}
    if (added) LG.forEach(function (l) { if (l.kind) { addEager(l.key); loadLeague(l.key); } });
    S.yesterday = buildYesterday(new Date());
    render();
  }
  function togglePerson(n) { setFp(fpHas(n) ? C.fp.filter(function (q) { return q.toLowerCase() !== String(n).toLowerCase(); }) : C.fp.concat([n])); }
  function starBtn(name) {
    var on = fpHas(name), b = el("button", "fstar" + (on ? " on" : ""), on ? "★" : "☆");
    b.type = "button"; b.setAttribute("aria-label", (on ? "Unfollow " : "Follow ") + name); b.title = on ? "Following" : "Follow";
    b.onclick = function (e) { e.stopPropagation(); buzz(8); togglePerson(name); };
    return b;
  }
  // One row of a leaderboard or running order: position, name (with a follow star), right-hand figure, small print.
  function prow(pos, name, right, small) {
    var r = el("div", "pr" + (fpHas(name) ? " fol" : ""));
    r.appendChild(el("span", "pp", String(pos))); var nm = el("span", "pn"), nl = el("span", null, name); nm.appendChild(nl);
    var vx = S.view && S.view.x;
    if (vx && name && name !== "\u2013") {   // the name opens their athlete page (events from the same league)
      nl.className = "pn-l"; nl.tabIndex = 0; nl.setAttribute("role", "link");
      nl.onclick = function () { openPerson({ lk: vx.lk, id: "0", name: name, sport: ((leagueOf(vx.lk) || {}).path || "").split("/")[0], ind: true, ll: (leagueOf(vx.lk) || {}).label || "" }); };
      nl.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); nl.onclick(); } };
    }
    if (small) nm.appendChild(el("small", null, small));
    r.appendChild(nm); r.appendChild(el("span", "ps", right || "")); r.appendChild(starBtn(name)); return r;
  }
  function parOf(s) { return s === "E" ? 0 : Number(s); }
  // What has happened so far in an event that is under way.
  function evCatch(g) {
    var P = g.x || {}, w = el("div", "sum"), me = fpIn(g), n = 0;
    var add = function (h, t) { if (!t) return; n++; var d = el("div", "nar"); d.appendChild(el("h4", null, h)); d.appendChild(el("p", null, t)); w.appendChild(d); };
    if (g.ev === "mma") {
      var fs = (P.fights || []).slice().reverse(), dn = fs.filter(function (f) { return f.s === "post"; }), nw = fs.filter(function (f) { return f.s === "in"; }), lf = fs.filter(function (f) { return f.s === "pre"; });
      w.appendChild(el("p", null, dn.length + " of " + fs.length + " fights are finished" + (nw.length ? " and one is under way." : ".")));
      add("Results so far", dn.map(function (f) { return f.win >= 0 ? f.n[f.win] + " def. " + f.n[1 - f.win] + (f.m ? " by " + f.m : "") + (f.rd ? " (R" + f.rd + (f.tm ? " " + f.tm : "") + ")" : "") : f.n.join(" vs ") + ", no result"; }).join(" • "));
      add("In the cage now", nw.map(function (f) { return f.n.join(" vs ") + (f.live ? " · " + f.live : ""); }).join(" • "));
      var mn = (P.fights || [])[0];
      add("Still to come", lf.length ? lf.length + " more fight" + (lf.length > 1 ? "s" : "") + (mn && mn.s === "pre" ? ", including the main event: " + mn.n.join(" vs ") : "") + "." : "");
      add("Your fighters", me.map(function (nm) {
        var f = fs.filter(function (q) { return q.n.indexOf(nm) >= 0; })[0]; if (!f) return "";
        return nm + (f.s === "post" ? (f.win >= 0 ? (f.n[f.win] === nm ? " won" : " lost") + (f.m ? " by " + f.m : "") : " fought to no result") : f.s === "in" ? " is fighting now" : " is still to fight");
      }).filter(Boolean).join(" • "));
    } else if (g.ev === "golf") {
      var R = P.rows || [];
      w.appendChild(el("p", null, (P.det || g.c || "In progress") + (R[0] ? ". " + R[0][0] + " leads at " + R[0][2] + "." : ".")));
      add("At the top", R.slice(0, 5).map(function (r) { return r[1] + " " + r[0] + " (" + r[2] + ")"; }).join(" • "));
      if (R[0]) { var ld = parOf(R[0][2]), wi = R.filter(function (r) { var v = parOf(r[2]); return isFinite(v) && v - ld <= 2; }).length; add("The chase", wi > 1 ? wi + " players are within two shots of the lead." : "Nobody is within two shots of the lead."); }
      var best = null; R.forEach(function (r) { r[3].forEach(function (v, i) { if (v != null && v >= 55 && (!best || v < best.v)) best = { v: v, i: i, n: r[0] }; }); });
      if (best) add("Low round", best.n + " shot " + best.v + " in round " + (best.i + 1) + ".");
      add("Your golfers", me.map(function (nm) { var r = R.filter(function (q) { return q[0] === nm; })[0]; return r ? nm + " is " + r[1] + " at " + r[2] + (r[5] ? " through " + r[5] : "") : ""; }).filter(Boolean).join(" • "));
    } else {
      var ss = (P.sess || []).slice().sort(function (a, b) { return Date.parse(a.t) - Date.parse(b.t); }), lv = ss.filter(function (z) { return z.s === "in"; })[0];
      var dd = ss.filter(function (z) { return z.s === "post"; }), nx = ss.filter(function (z) { return z.s === "pre"; });
      w.appendChild(el("p", null, g.c || (lv ? sessName(lv.n) + " is on track." : "Weekend under way.")));
      add("Already run", dd.map(function (z) { return sessName(z.n) + ": " + (z.rows.slice(0, 3).map(function (r) { return r[1]; }).join(", ") || "no times"); }).join(" • "));
      if (lv) add(sessName(lv.n) + " right now", lv.rows.slice(0, 5).map(function (r) { return r[0] + ". " + r[1]; }).join(", "));
      add("Still to come", nx.map(function (z) { return sessName(z.n) + " " + when(z.t); }).join(" • "));
      var cur = lv || dd[dd.length - 1];
      add("Your drivers", cur ? me.map(function (nm) { var r = cur.rows.filter(function (q) { return q[1] === nm; })[0]; return r ? nm + " is P" + r[0] + " in " + sessName(cur.n) : ""; }).filter(Boolean).join(" • ") : "");
    }
    return n ? w : null;
  }
  function renderEvent(out, g) {
    var P = g.x || {};
    if (P.venue) out.appendChild(el("p", "rb", P.venue));
    var cw = g.s === "live" ? evCatch(g) : null;
    if (cw) out.appendChild(sec("Get caught up", cw, true, false));
    if (g.ev === "mma") {
      var fs = P.fights || [], main = fs.filter(function (f) { return f.ft; }), prel = fs.filter(function (f) { return !f.ft; });
      if (!main.length) { main = fs; prel = []; }
      var mk = function (list) {
        var ul = el("ul", "fights");
        list.forEach(function (f) {
          var li = el("li"), tp = el("div", "ft"), done = f.s === "post" && f.win >= 0;
          tp.appendChild(el("span", "fw", f.w || "Bout"));
          tp.appendChild(el("span", "fr", f.s === "post" ? (done ? [f.m, f.rd ? "R" + f.rd : "", f.tm].filter(Boolean).join(" · ") : "No result") : f.s === "in" ? (f.live || "Live") : ""));
          li.appendChild(tp);
          var nm = el("div", "fn"), who = function (i, w) {
            var s = el("span"); s.appendChild(el("b", w ? "fwin" : "", f.n[i] || "–"));
            if (f.r[i]) s.appendChild(document.createTextNode(" (" + f.r[i] + ")"));
            if (f.n[i] && f.n[i] !== "–") s.appendChild(starBtn(f.n[i]));
            return s;
          }, o = done ? [f.win, 1 - f.win] : [0, 1];
          nm.appendChild(who(o[0], done)); nm.appendChild(document.createTextNode(done ? " def. " : " vs ")); nm.appendChild(who(o[1], false));
          li.appendChild(nm); ul.appendChild(li);
        });
        return ul;
      };
      if (!fs.length) out.appendChild(el("p", "rmsg", "The fight card has not been announced yet."));
      if (main.length) out.appendChild(sec("Main card", mk(main), true, false));
      if (prel.length) out.appendChild(sec("Prelims", mk(prel), g.s === "up", false));
    } else if (g.ev === "golf") {
      var R = P.rows || [];
      if (P.det && g.s !== "final") out.appendChild(el("p", "rb", P.det));
      if (!R.length) { out.appendChild(el("p", "rmsg", "The field has not been posted yet.")); return; }
      var gl = function (rows) {
        var w = el("div", "plist");
        rows.forEach(function (r) { w.appendChild(prow(r[1], r[0], r[2], [r[3].filter(function (v) { return v != null; }).join(" · "), r[5] ? "thru " + r[5] : ""].filter(Boolean).join("  ·  "))); });
        return w;
      };
      var mine = R.filter(function (r) { return fpHas(r[0]); });
      if (mine.length) out.appendChild(sec("Your golfers", gl(mine), true, true));
      out.appendChild(sec(g.s === "up" ? "Field" : "Leaderboard", gl(R.slice(0, 25)), true, false));
      if (R.length > 25) out.appendChild(sec("Rest of the field · " + (R.length - 25), gl(R.slice(25)), false, false));
    } else {
      var ses = (P.sess || []).slice().reverse();
      ses.forEach(function (s, i) {
        var title = sessName(s.n) + " · " + (s.s === "post" ? "Final" : s.s === "in" ? "Live" : when(s.t));
        var body;
        if (s.rows.length) { body = el("div", "plist"); s.rows.forEach(function (r) { body.appendChild(prow(r[0], r[1], "", "")); }); }
        else body = el("p", "rb", "Starts " + when(s.t) + ".");
        out.appendChild(sec(title, body, i === 0 || s.s === "in", false));
      });
    }
  }
  var DIO = null;
  function miniLine(g) {
    if (g.ev) return g.h[0];
    if (g.s === "up") return g.a[1] + " at " + g.h[1] + " \u00b7 " + when(g.t);
    return g.a[1] + " " + g.a[2] + " \u00b7 " + g.h[1] + " " + g.h[2] + " \u00b7 " + (g.s === "live" ? (g.c || "Live") : "Final");
  }
  // ---------- live watch: the bits that change while you're looking ----------
  var LASTCELL = {}, LASTPL = {};
  // Cells whose value moved since the last render pulse once (values are remembered per table, per game).
  function flashCells(tw, rows, key) {
    var prev = LASTCELL[key], cur = rows.map(function (r) { return r.map(function (v) { return v == null ? "" : String(v); }); });
    LASTCELL[key] = cur;
    if (!prev || prev.length !== cur.length) return;
    var trs = tw.querySelectorAll("tbody tr");
    cur.forEach(function (r, i) { r.forEach(function (v, j) { if (j && prev[i] && prev[i][j] !== v && trs[i] && trs[i].children[j]) trs[i].children[j].classList.add("chg"); }); });
  }
  function livePanel(g, d, lg) {
    var q = g.q || {}, pa = (lg && lg.path) || "", w = el("div", "lv"), hd = el("div", "lvh");
    hd.appendChild(el("span", "lvd")); hd.appendChild(el("b", null, g.c || "Live"));
    if (d && d.wp && d.wp.length > 5) {
      var cur = d.wp[d.wp.length - 1], was = d.wp[Math.max(0, d.wp.length - 6)], lead = cur >= 50 ? g.h[1] : g.a[1], pct = cur >= 50 ? cur : 100 - cur;
      var mo = el("span", "lvwp", lead + " " + pct + "%"); var dlt = cur - was; if (Math.abs(dlt) >= 3) mo.appendChild(el("i", (dlt > 0) === (cur >= 50) ? "up" : "down", (dlt > 0) === (cur >= 50) ? "\u25B2" : "\u25BC"));
      hd.appendChild(mo);
    }
    w.appendChild(hd);
    if (/^football/.test(pa) && (q.pt || q.dd)) {
      // Virtual field: away team's half on the left, the ball where ESPN says it is, driving toward the end zone they attack.
      var fld = el("div", "fld" + (q.rz ? " rz" : "")), ez1 = el("span", "ez l", g.a[1]), ez2 = el("span", "ez r", g.h[1]);
      fld.appendChild(ez1); fld.appendChild(ez2);
      var m = /^([A-Z0-9&]+)\s+(\d+)/.exec(q.pt || ""), x = 50;
      if (m) { var yd = +m[2]; x = m[1] === g.a[1] ? yd : m[1] === g.h[1] ? 100 - yd : 50; }
      var away = q.p && q.p === String(g.a[4]), home = q.p && q.p === String(g.h[4]);
      var ball = el("span", "ball" + (away ? " r" : home ? " l" : "")); ball.style.left = x + "%";
      ball.appendChild(el("i", null, "\uD83C\uDFC8")); fld.appendChild(ball);
      for (var y = 10; y < 100; y += 10) { var yl = el("span", "yl"); yl.style.left = y + "%"; fld.appendChild(yl); }
      w.appendChild(fld);
      var dd = el("div", "lvdd"); if (q.dd) dd.appendChild(el("b", null, q.dd)); else if (q.pt) dd.appendChild(el("b", null, "Ball on " + q.pt));
      if (q.rz) dd.appendChild(el("span", "rzb", "RED ZONE"));
      var tos = el("span", "tos");
      if (q.at != null) tos.appendChild(toDots(g.a[1], q.at)); if (q.ht != null) tos.appendChild(toDots(g.h[1], q.ht));
      dd.appendChild(tos); w.appendChild(dd);
    } else if (/^baseball/.test(pa) && q.b) {
      var bb = el("div", "bsb"), dia = el("div", "dia");
      [1, 2, 0].forEach(function (i) { dia.appendChild(el("i", "b" + i + (q.b[i] ? " on" : ""))); });
      bb.appendChild(dia);
      var info = el("div", "bsi"), outs = el("div", "outs");
      for (var oi = 0; oi < 3; oi++) outs.appendChild(el("i", oi < q.o ? "on" : ""));
      outs.appendChild(el("span", null, q.o + " out" + (q.o === 1 ? "" : "s"))); info.appendChild(outs);
      info.appendChild(el("div", "cnt", "Count " + q.bs));
      if (q.bat) info.appendChild(el("div", "who", "AB: " + q.bat)); if (q.pit) info.appendChild(el("div", "who", "P: " + q.pit));
      bb.appendChild(info); w.appendChild(bb);
    }
    if (q.lp) { var lp = el("div", "lvp" + (LASTPL["lp" + g.id] && LASTPL["lp" + g.id] !== q.lp ? " new" : "")); LASTPL["lp" + g.id] = q.lp; lp.appendChild(el("span", "lvk", "Last play")); lp.appendChild(el("span", null, q.lp)); w.appendChild(lp); }
    return w;
  }
  function toDots(ab, n) { var s2 = el("span", "to"); s2.appendChild(el("em", null, ab)); for (var i = 0; i < 3; i++) s2.appendChild(el("i", i < n ? "on" : "")); return s2; }
  function renderDetail(out) {
    var v = S.view, g = v.x.g, d = v.d, lg = leagueOf(v.x.lk);
    var back = el("button", "back", "\u2039 Scores"); back.type = "button"; back.onclick = closeGame;
    var nav = el("div", "navbar"); nav.appendChild(back);
    var ms = el("span", "mini-sc", miniLine(g)); nav.appendChild(ms);
    out.appendChild(nav);
    var hd = el("div", "dhead"); hd.appendChild(card(v.x)); out.appendChild(hd);
    // Once the big card scrolls away, the sticky bar shows the compact score instead.
    if (DIO) DIO.disconnect();
    if (window.IntersectionObserver) { DIO = new IntersectionObserver(function (en) { nav.classList.toggle("on", !en[0].isIntersecting); }, { threshold: 0, rootMargin: "-56px 0px 0px 0px" }); DIO.observe(hd); }
    if (g.ev) { renderEvent(out, g); return; }
    if (d === undefined) { out.appendChild(skel(3)); return; }
    if (d === null) { out.appendChild(el("p", "rmsg", "Box score unavailable right now.")); return; }
    if (g.s === "live") out.appendChild(livePanel(g, d, lg));

    var up = g.s === "up", list = [], prim = [], secd = [];
    var pv = el("div", "sum");
    var rc = g.s === "final" && d.recap && d.recap.secs.length ? d.recap : null;
    var nv = v.n && (v.n.type === "Recap") === (g.s === "final") ? v.n : null;
    if (nv) {
      pv.appendChild(el("p", "nh", nv.h));
      var ps = nv.paras.map(function (t, i) { return i ? t : delede(t); }), rest = ps.slice(2);
      ps.slice(0, 2).forEach(function (t) { pv.appendChild(el("p", "ap", t)); });
      if (rest.length) {
        var rw = el("div", "ap-more"); rest.forEach(function (t) { rw.appendChild(el("p", "ap", t)); });
        var rt = el("button", "narr-t"); rt.type = "button";
        var rtx = function () { rw.hidden = !v.full; rt.textContent = v.full ? "Show less \u25B4" : "Read the full story \u25BE"; }; rtx();   // survives the live re-renders
        rt.onclick = function () { v.full = !v.full; rtx(); };
        pv.appendChild(rw); pv.appendChild(rt);
      }
      var sl = el("p", "src", "Story: AP, via ESPN"), sa = nv.link && el("a", null, " Read on ESPN ↗");
      if (sa) { sa.href = nv.link; sa.target = "_blank"; sa.rel = "noopener"; sl.appendChild(sa); }
      pv.appendChild(sl);
    } else pv.appendChild(el("p", null, rc ? rc.head : (d.preview || (g.a[0] + " visit " + g.h[0] + " " + when(g.t) + "."))));
    if (d.h2h) pv.appendChild(el("p", "h2h", "Season series · " + d.h2h));
    (rc ? rc.secs : (d.narrative || [])).forEach(function (n) {
      if (nv && n.h === "The story") return;   // the AP story above already opens with that paragraph
      var w = el("div", "nar"); w.appendChild(el("h4", null, n.h)); w.appendChild(el("p", null, n.p)); pv.appendChild(w);
    });
    if (d.link && !nv) {
      var lw = el("div", "nar"), la = el("a", null, (rc ? "ESPN recap: " : "ESPN preview: ") + d.link.text + " ↗");
      la.href = d.link.href; la.target = "_blank"; la.rel = "noopener"; lw.appendChild(la); pv.appendChild(lw);
    }
    // Followed teams' finished games get a one-tap YouTube search for the full-game highlights (no extra requests).
    if (rc && isFollowed(g)) {
      var yq = g.a[0] + " vs " + g.h[0] + " full game highlights " + new Date(g.t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      var yw = el("div", "nar"), ya = el("a", null, "\u25B6 Highlights on YouTube \u2197");
      ya.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(yq); ya.target = "_blank"; ya.rel = "noopener";
      yw.appendChild(ya); pv.appendChild(yw);
    }
    var preview = sec(rc || nv && g.s === "final" ? "Recap" : "Preview", pv, up || !!rc || !!nv, false);
    if (up || rc) list.push(preview);

    if (d.wp && d.wp.length > 4) prim.push(sec("Win probability", wpChart(d.wp, g), true, false));
    if (d.periods) {
      var rows = d.periods.rows.map(function (r) {
        var tot = 0;
        for (var i = 1; i < r.length; i++) if (typeof r[i] === "number") tot += r[i];
        return r.concat([tot]);
      });
      var pt = tbl({ cols: [""].concat(d.periods.labels.map(function (_, i) { return perLabel(v.x.lk, i); }), ["T"]), rows: rows }, "per");
      if (g.s === "live") flashCells(pt, rows, "per" + g.id);
      prim.push(sec(lg && lg.soccer ? "By half" : "By period", pt, true, false));
    }
    d.tables.filter(function (t) { return t.kind === "team"; }).forEach(function (t) {
      var tt = tbl(t); if (g.s === "live") flashCells(tt, t.rows, "team" + g.id);
      prim.push(sec(up ? "Team stats" : t.title, tt, true, false));
    });

    // Players: followed team first (first three tables open), then the other team.
    var lgo = {}; lgo[g.a[1]] = g.a[5]; lgo[g.h[1]] = g.h[5];
    var followedAbbr = [g.a, g.h].filter(function (t) { return C.followed.indexOf(t[0]) >= 0; }).map(function (t) { return t[1]; });
    var players = d.tables.filter(function (t) { return t.kind === "players"; }).map(function (t) {
      var name = pretty(t.group);
      if (name === "Players") {
        var ths = t.cols;
        name = ths.indexOf("IP") >= 0 ? "Pitching" : (ths.indexOf("AB") >= 0 || ths.indexOf("H-AB") >= 0 ? "Batting" : name);
      }
      return { title: t.team + " " + name, node: tbl(t), logo: lgo[t.team], minor: /defens|kick|punt|return|fumble|intercept|tackle/i.test(name), fav: followedAbbr.indexOf(t.team) >= 0 };
    });
    var favs = players.filter(function (p) { return p.fav; }), others = players.filter(function (p) { return !p.fav; });
    favs.forEach(function (p, i) { (p.minor ? secd : prim).push(sec(p.title, p.node, p.minor || i < 3, true, p.logo)); });
    others.forEach(function (p) { (p.minor ? secd : prim).push(sec(p.title, p.node, p.minor || (!favs.length && !up && prim.length < 5), false, p.logo)); });

    var sc = null;
    if (d.plays.length) {
      sc = el("div", "plays"); sc.tabIndex = 0;
      sc.onscroll = function () { v.ps = sc.scrollTop; };   // where you were in the log, kept across the 20-second live refreshes
      var seenP = LASTPL[g.id] || null, firstP = d.plays[0] ? d.plays[0].t + "|" + d.plays[0].x : "";
      if (g.s === "live") LASTPL[g.id] = firstP;
      d.plays.forEach(function (p, pi) {
        var r = el("div", "play" + (g.s === "live" && seenP && seenP !== firstP && pi === 0 ? " new" : ""));
        r.appendChild(el("span", "pt", p.t));
        r.appendChild(el("span", "px", p.x));
        sc.appendChild(r);
      });
      secd.push(sec("Plays", sc, true, false));
    }
    // Two tiers: the main numbers first, minor categories and the play log tucked into the second one.
    [tier("Stats", prim, true), tier("More stats", secd, g.s === "live")].forEach(function (t) { if (t) list.push(t); });
    if (!up && !rc) list.push(preview);

    if (g.s === "live" && d.catch) {
      var cw = el("div", "sum"); cw.appendChild(el("p", null, d.catch.head));
      d.catch.secs.forEach(function (n) { var w = el("div", "nar"); w.appendChild(el("h4", null, n.h)); w.appendChild(el("p", null, n.p)); cw.appendChild(w); });
      list.unshift(sec("Get caught up", cw, true, false));
    }
    var bar = el("div", "allbar");
    var b1 = el("button", null, "Expand"), b2 = el("button", null, "Collapse");
    b1.type = b2.type = "button";
    var setAll = function (o) { list.forEach(function (s) { s.open = o; [].forEach.call(s.querySelectorAll("details"), function (c) { c.open = o; }); }); };
    b1.onclick = function () { setAll(true); };
    b2.onclick = function () { setAll(false); };
    bar.appendChild(b1); bar.appendChild(b2);
    out.appendChild(bar);
    list.forEach(function (s) { out.appendChild(s); });
    if (sc && v.ps) sc.scrollTop = v.ps;
  }

  // ---------- search: teams and athletes from every sport ----------
  // Two sources, merged: the core-league index (instant, cached a week) and ESPN's own search (one ~1KB request per
  // query, debounced, cached ten minutes), which reaches every league and every athlete ESPN covers.
  var TEAMS = null;
  function teamIndex() {
    if (TEAMS) return Promise.resolve();
    return ESPN.fetchTeams(false).then(function (v) {
      var out = [];
      Object.keys(v).forEach(function (lk) { var lg = leagueOf(lk); if (!lg) return; v[lk].forEach(function (t) { out.push({ lk: lk, id: t.id, name: t.name, ab: t.ab || "", lg: t.lg || "", ll: lg.label, h: (t.name + " " + (t.ab || "") + " " + lg.label + " " + lk).toLowerCase() }); }); });
      TEAMS = out;
    }, function () {});
  }
  // Teams in the index matching every word of the query, your teams first, then names that start with it.
  function teamHits(q) {
    var toks = q.split(/\s+/).filter(Boolean); if (!toks.length || !TEAMS) return [];
    var th = TEAMS.filter(function (t) { return toks.every(function (k) { return t.h.indexOf(k) >= 0; }); });
    th.sort(function (a, b) { return (C.followed.indexOf(b.name) >= 0 ? 1 : 0) - (C.followed.indexOf(a.name) >= 0 ? 1 : 0) || (b.h.indexOf(q) === 0 ? 1 : 0) - (a.h.indexOf(q) === 0 ? 1 : 0) || a.name.localeCompare(b.name); });
    return th;
  }
  // A search hit's league: one the app knows, or a new one built from ESPN's path (registered when you open or follow it).
  var IND = { mma: 1, golf: 1, racing: 1, tennis: 1 };   // sports whose athletes compete alone
  function pathLeague(path) { for (var i = 0; i < LG.length; i++) if (LG[i].path === path) return LG[i]; return null; }
  function leagueFor(sport, slug, label) {
    if (sport === "mma" && !slug) slug = "ufc";
    if (!sport || !slug) return null;
    var path = sport + "/" + slug;
    return pathLeague(path) || { key: dynKey(path), path: path, label: label || slug.toUpperCase(), pending: true };
  }
  // One row per team: a soccer club keeps one id across every competition it plays in, so it's keyed by club.
  function teamKey(lk, id) { var lg = leagueOf(lk); return lg && lg.soccer ? "soccer_" + id : lk + "_" + id; }
  function mergeTeams(q, remote) {
    var out = [], seen = {};
    teamHits(q).forEach(function (t) { var k = teamKey(t.lk, t.id); if (seen[k] || out.length >= 8) return; seen[k] = 1; out.push(t); });
    (remote ? remote.teams : []).forEach(function (r) {
      if (/friendly/.test(r.slug)) return;   // ESPN's catch-all for clubs with no league feed
      var lg = leagueFor(r.sport, r.slug, r.ll); if (!lg) return;
      var k = lg.pending ? (r.sport === "soccer" ? "soccer_" + r.id : lg.key + "_" + r.id) : teamKey(lg.key, r.id); if (seen[k]) return; seen[k] = 1;
      out.push({ lk: lg.key, id: r.id, name: r.name, ab: "", lg: r.lg, ll: lg.pending ? r.ll : lg.label, dl: lg.pending ? lg : null });
    });
    return out;
  }
  // An athlete hit. Fighters, golfers, drivers and players of individual sports get their own page; anyone on a team
  // opens that team's page.
  function personOf(r) {
    var ind = !!IND[r.sport], lg = ind ? leagueFor(r.sport, r.slug) : null;
    if (lg && (lg.pending || !lg.kind)) lg = null;   // only the event leagues the app loads carry their results
    return { name: r.name, id: r.id, sport: r.sport, ind: ind, lk: lg ? lg.key : "", img: r.img, web: r.web, team: ind ? "" : r.sub, slug: r.slug, d: r.d,
      ll: ind ? (lg ? lg.label : (r.d && r.d !== r.sport.toUpperCase() ? r.d : r.sport.charAt(0).toUpperCase() + r.sport.slice(1))) : [r.d, r.sub].filter(Boolean).join(" · ") };
  }
  function followTeam(t, on) {
    if (on == null) on = C.followed.indexOf(t.name) < 0;
    buzz(6);
    if (!on) { setFollowed(C.followed.filter(function (q) { return q !== t.name; }), false); dynTidy(t.lk); toast("Unfollowed " + t.name); return; }
    regTeam(t);
    setFollowed(C.followed.concat([t.name]), t.lk);
    toast("Following " + t.name);
  }
  // Make a newly followed team's league load: a league built from search is registered (sb-dyn), a lazy one goes eager.
  function regTeam(t) {
    var lg = t.dl ? addLeague(t.dl.key, t.dl.path, t.dl.label) : leagueOf(t.lk);
    if (lg && lg.dyn) { DYN[lg.key] = [lg.path, lg.label]; try { localStorage.setItem("sb-dyn", JSON.stringify(DYN)); } catch (e) {} }
    if (lg && lg.lazy) addEager(lg.key);
    if (t.id) TID[t.name] = { lk: t.lk, id: t.id };
  }
  var TID = {};   // league and id for teams followed this session, so their pages load without a lookup
  function starTeam(t) {
    var on = C.followed.indexOf(t.name) >= 0, b = el("button", "fstar" + (on ? " on" : ""), on ? "★" : "☆");
    b.type = "button"; b.setAttribute("aria-label", (on ? "Unfollow " : "Follow ") + t.name); b.title = on ? "Following" : "Follow";
    b.onclick = function (e) { e.stopPropagation(); followTeam(t); };
    return b;
  }
  function teamRow(t) {
    var r = el("div", "find-tm click"), lb = el("span", "ab" + (t.lg && PREF.logos ? " lg" : "")), ab = t.ab || t.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 3).toUpperCase();
    if (t.lg && PREF.logos) lb.appendChild(logoImg(t.lg, ab)); else lb.textContent = ab;
    r.appendChild(lb); var w = el("span", "find-tw"); w.appendChild(el("b", null, t.name)); w.appendChild(el("small", null, t.ll || "")); r.appendChild(w);
    r.appendChild(starTeam(t)); r.tabIndex = 0; r.setAttribute("role", "button");
    var go = function () { if (FIND) closeFind(); openTeam(t); };
    r.onclick = go; r.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } };
    return r;
  }
  function headshot(p, cls) {
    var w = el("span", "hs" + (cls ? " " + cls : "")), ini = p.name.split(/\s+/).map(function (x) { return x.charAt(0); }).join("").slice(0, 2).toUpperCase();
    var src = p.img || (p.id && p.id !== "0" && HSP[p.sport] ? "https://a.espncdn.com/i/headshots/" + HSP[p.sport] + "/players/full/" + p.id + ".png" : "");
    if (src && PREF.logos) {
      var i = new Image(); i.alt = ""; i.decoding = "async"; i.loading = "lazy"; i.src = src.replace(/^https:\/\/a\.espncdn\.com(\/i\/headshots\/.+)$/, "https://a.espncdn.com/combiner/i?img=$1&w=96&h=70");
      i.onerror = function () { w.textContent = ini; }; w.appendChild(i);
    } else w.textContent = ini;
    return w;
  }
  var HSP = { mma: "mma", golf: "golf", racing: "rpm", tennis: "tennis" };
  function personRow(p) {
    var r = el("div", "find-tm click pr-row");
    r.appendChild(headshot(p)); var w = el("span", "find-tw"); w.appendChild(el("b", null, p.name)); w.appendChild(el("small", null, p.ll)); r.appendChild(w);
    if (p.ind) r.appendChild(starBtn(p.name)); else r.appendChild(el("span", "find-go", "›"));
    r.tabIndex = 0; r.setAttribute("role", "button");
    var go = function () { if (FIND) closeFind(); if (p.ind) openPerson(p); else openPlayerTeam(p); };
    r.onclick = go; r.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } };
    return r;
  }
  // A team-sport player opens their team: the index first, then one search for the team's name.
  function openPlayerTeam(p) {
    var lg0 = leagueFor(p.sport, p.slug), hit = (TEAMS || []).filter(function (t) { return t.name === p.team && (!lg0 || t.lk === lg0.key); })[0];
    if (hit) { openTeam(hit); return; }
    if (!p.team) { toast("No team listed for " + p.name); return; }
    ESPN.search(p.team).then(function (r) {
      var c = r.teams.filter(function (t) { return t.name === p.team && t.sport === p.sport; })[0] || r.teams.filter(function (t) { return t.name === p.team; })[0], lg = c && leagueFor(c.sport, c.slug, c.ll);
      if (!lg) { toast("Couldn’t find " + p.team); return; }
      openTeam({ lk: lg.key, id: c.id, name: c.name, lg: c.lg, dl: lg.pending ? lg : null });
    }, function () { toast("Couldn’t reach the search"); });
  }
  // Sport words ("boston college football", "bc hockey", "uconn womens") narrow the results instead of being searched
  // for: ESPN's search finds nothing for "boston college football" but finds the team for "boston college".
  // "college" stays in the query too (it's part of names like Boston College).
  var SPW = [[/^football$/, /^football\//], [/^(basketball|hoops)$/, /^basketball\//], [/^hockey$/, /^hockey\//], [/^baseball$/, /^baseball\//], [/^(soccer|futbol)$/, /^soccer\//],
    [/^(cfb|ncaaf)$/, /college-football/], [/^(cbb|ncaam|ncaab)$/, /mens-college-basketball/], [/^(ncaaw|wbb)$/, /womens-college-basketball/], [/^ncaa$/, /college/],
    [/^(men|mens|men's|men’s)$/, /^(?!.*womens)/], [/^(women|womens|women's|women’s)$/, /womens|wnba|nwsl|wta|lpga/]];
  var SPX = [["football", "^football/"], ["basketball", "^basketball/"], ["baseball", "^baseball/(?!college-softball)"], ["hockey", "hockey/"], ["soccer", "^soccer/"], ["softball", "softball"], ["volleyball", "volleyball"], ["lacrosse", "lacrosse"], ["womens", "womens|wnba|nwsl"]];
  function sportQ(q) {
    var keep = [], tests = [];
    q.split(/\s+/).filter(Boolean).forEach(function (w) { var m = SPW.filter(function (s) { return s[0].test(w); })[0]; if (m) tests.push(m[1]); else keep.push(w); });
    if (q.split(/\s+/).some(function (w) { return w === "college"; })) tests.push(/college/);
    // A sport word still being typed ("uconn foot", "duke bask") narrows too, once it's three letters in.
    var lw = keep.length > 1 && keep[keep.length - 1], px = lw && lw.length >= 3 ? SPX.filter(function (s) { return s[0].indexOf(lw) === 0 && s[0] !== lw; }) : [];
    if (px.length) { keep.pop(); tests.push(new RegExp(px.map(function (s) { return s[1]; }).join("|"))); }
    if (!keep.length) return { q: q, ok: function () { return true; } };   // just a sport word: search it as typed
    return { q: keep.join(" "), ok: function (path) { return tests.every(function (t) { return t.test(path || ""); }); } };
  }
  // What a query's search shows, and what still needs asking. When ESPN has nothing for the whole query (a word
  // half-typed: "uconn huski", "man unit"), the answer for the words before it is reused, kept to the hits that have a
  // word starting with the last one, in their name, league or sport. At most one more small request, often none.
  function wordsOf(x) { return " " + String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " "); }   // "Montréal" matches "montreal"
  function searchState(q0) {
    var sq = sportQ(q0), q = sq.q, r = ESPN.peekSearch(q), st = { sq: sq, q: q, r: r, need: null };
    if (!r) { if (q.length >= 2) st.need = q; return st; }
    if (r.teams.length || r.people.length) return st;
    var toks = q.split(/\s+/); if (toks.length < 2) return st;
    var w = " " + toks.pop().replace(/[^a-z0-9]/g, ""), base = toks.join(" "), rb = ESPN.peekSearch(base);
    if (w.length < 2) return st;
    if (!rb) { st.r = null; st.need = base; return st; }
    st.r = {
      teams: rb.teams.filter(function (t) { return wordsOf(t.name + " " + t.ll + " " + t.sport + " " + t.slug).indexOf(w) >= 0; }),
      people: rb.people.filter(function (p) { return wordsOf(p.name + " " + p.sub + " " + p.d + " " + p.sport + " " + p.slug).indexOf(w) >= 0; })
    };
    return st;
  }
  function pathOfTeam(t) { return ((t.dl || leagueOf(t.lk)) || {}).path || ""; }
  // Results for one query, drawn into res: teams, then athletes, with a quiet line while the wider search runs.
  // ctl holds the debounce timer and the query on screen, so a slow answer never paints over a newer one.
  function drawHits(res, q0, ctl, opts) {
    var st = searchState(q0), sq = st.sq, q = st.q;
    var remote = st.r, teams = mergeTeams(q, remote).filter(function (t) { return sq.ok(pathOfTeam(t)); });
    var people = remote ? remote.people.filter(function (r) { return !/friendly/.test(r.slug) && sq.ok(r.sport + "/" + r.slug); }).map(personOf).slice(0, 6) : [];
    // When the words name a league ("f1", "golf"), ESPN's loose matches (an athlete for "f1") are noise: keep only hits
    // that actually carry the words.
    if (opts.strict) {
      var sw = wordsOf(q).trim().split(" ").filter(Boolean), carries = function (x) { var w = wordsOf(x) + " "; return sw.every(function (t) { return w.indexOf(" " + t) >= 0; }); };
      teams = teams.filter(function (t) { return carries(t.name + " " + (t.ll || "")); }); people = people.filter(function (p) { return carries(p.name + " " + (p.ll || "")); });
    }
    var n = opts.nt || 8, shownT = teams.slice(0, n);
    if (shownT.length) {
      if (opts.heads) res.appendChild(el("h4", "find-sh", "Teams"));
      var tw = el("div", "find-tms"); shownT.forEach(function (t) { tw.appendChild(teamRow(t)); }); res.appendChild(tw);
    }
    if (people.length) {
      res.appendChild(el("h4", "find-sh", "Athletes"));
      var pw = el("div", "find-tms"); people.forEach(function (p) { pw.appendChild(personRow(p)); }); res.appendChild(pw);
    }
    ctl.done = !st.need;   // the answer is final: "Nothing matches" may show
    if (st.need) {
      var nq = st.need;
      if (!shownT.length) res.appendChild(el("p", "find-h find-wait", "Searching every sport…"));
      clearTimeout(ctl.t); ctl.q = nq;
      ctl.t = setTimeout(function () { ESPN.search(nq).then(function () { if (ctl.q === nq && ctl.redraw) ctl.redraw(); }, function () { if (ctl.q === nq) { var w = res.querySelector(".find-wait"); if (w) w.textContent = "Couldn’t search every sport right now."; } }); }, 220);
    }
    return shownT.length + people.length;
  }
  // Recently opened teams and athletes (shown when a search box is empty). Kept small: eight entries.
  var REC = []; try { REC = JSON.parse(localStorage.getItem("sb-recent") || "[]") || []; } catch (e) {}
  function remember(it) {
    REC = [it].concat(REC.filter(function (r) { return !(r.k === it.k && r.lk === it.lk && String(r.id) === String(it.id) && r.name === it.name); })).slice(0, 8);
    try { localStorage.setItem("sb-recent", JSON.stringify(REC)); } catch (e) {}
  }
  function drawRecent(res) {
    if (!REC.length) return 0;
    res.appendChild(el("h4", "find-sh", "Recent"));
    var w = el("div", "find-tms");
    REC.slice(0, 6).forEach(function (r) { w.appendChild(r.k === "p" ? personRow(r) : teamRow(r)); });
    res.appendChild(w); return REC.length;
  }

  // ---------- leagues added through search (outside config.js) ----------
  // Stored as {key: [path, label]} and added to the league list at boot, then loaded like any other extra league.
  // The key spells out ESPN's path with letters and digits only, so a shared link to one still opens.
  function dynKey(path) { return "x" + path.toLowerCase().replace(/9/g, "99").replace(/\//g, "9s").replace(/\./g, "9d").replace(/-/g, "9h").replace(/_/g, "9u").replace(/[^a-z0-9]/g, ""); }
  function dynPath(k) { return k.slice(1).replace(/9(9|s|d|h|u)/g, function (m, c) { return { "9": "9", s: "/", d: ".", h: "-", u: "_" }[c]; }); }
  function addLeague(key, path, label) {
    if (LGM[key]) return LGM[key];
    var l = { key: key, label: label || (path.split("/")[1] || path).toUpperCase(), path: path, lazy: true, dyn: true, grp: "Added", soccer: /^soccer\//.test(path) };
    LG.push(l); LGM[key] = l; S.games[key] = []; return l;
  }
  function dynTidy(lk) {   // unfollowing the last team in an added league stops loading it
    var lg = leagueOf(lk); if (!lg || !lg.dyn) return;
    var still = C.followed.some(function (n) { var T = S.teams[n] || TC[n] || TID[n]; return T && T.lk === lk; });
    if (still) return;
    delete DYN[lk]; try { localStorage.setItem("sb-dyn", JSON.stringify(DYN)); } catch (e) {}
    var i = EAGER.indexOf(lk); if (i >= 0) { EAGER.splice(i, 1); try { localStorage.setItem("sb-eager", JSON.stringify(EAGER)); } catch (e) {} }
  }

  // ---------- team page (#team/<league>/<id>) and athlete page (#who/<league>/<id>/<name>) ----------
  function openTeam(t) {
    if (t.dl) addLeague(t.dl.key, t.dl.path, t.dl.label);
    remember({ k: "t", lk: t.lk, id: String(t.id), name: t.name, ab: t.ab || "", lg: t.lg || "", ll: t.ll || (leagueOf(t.lk) || {}).label || "" });
    buzz(4); if (S.view && S.view.x) S.sy1 = window.pageYOffset; else if (!S.view) S.sy = window.pageYOffset;
    S.tn = t; pushHash("team/" + t.lk + "/" + t.id);
  }
  function openTeamRoute(lk, id) {
    var key = "t_" + lk + "_" + id;
    if (S.view && S.view.key === key) return;
    var lg = leagueOf(lk) || (/^x[a-z0-9]+$/.test(lk) ? addLeague(lk, dynPath(lk)) : null);
    if (!lg) { S.view = null; render(); return; }
    var t = S.tn && S.tn.lk === lk && String(S.tn.id) === String(id) ? S.tn : { lk: lk, id: id, name: "" };
    S.tn = null;
    if (!t.name) {   // a reload or a shared link: a followed team's saved copy, else the schedule feed names the team
      var tk = Object.keys(TC).filter(function (n) { return TC[n].lk === lk && String(TC[n].id) === String(id); })[0];
      if (tk) t.name = tk;
      else ESPN.fetchTeamInfo(lk, id).then(function (i) {
        var nm = i && i.me && i.me[0];
        if (!S.view || S.view.key !== key) return;
        if (!nm) { S.view.team.err = 1; render(); return; }
        if (!S.teams[nm] || !S.teams[nm].done || S.teams[nm].stale) S.teams[nm] = Object.assign({ done: true, lk: lk, id: id }, i);
        S.view.team.name = nm; S.view.team.ab = i.me[1]; S.view.team.lg = i.me[2]; render();
      }, function () { if (S.view && S.view.key === key) { S.view.team.err = 1; render(); } });
    }
    var back = S.view && S.view.x ? S.sy1 || 0 : 0;   // coming back from one of its games: return to the same spot
    if (S.settings) { S.vset = true; S.settings = false; } S.more = false;   // opened from Settings: Back returns there
    S.view = { team: t, key: key }; S.sy1 = 0;
    swap(function () { render(); window.scrollTo(0, back); }); emit("view", null);
  }
  function openPerson(p) {
    remember({ k: "p", lk: p.lk || "", id: String(p.id || "0"), name: p.name, img: p.img || "", sport: p.sport || "", ind: true, ll: p.ll || "", web: p.web || "" });
    buzz(4); if (!S.view) S.sy = window.pageYOffset;
    S.pn = p; pushHash("who/" + (p.lk || "na") + "/" + (p.id || "0") + "/" + encodeURIComponent(p.name));
  }
  function openPersonRoute(lk, id, nm) {
    var key = "p_" + lk + "_" + id + "_" + nm;
    if (S.view && S.view.key === key) return;
    var p = S.pn && S.pn.name === nm ? S.pn : { lk: lk === "na" ? "" : lk, id: id, name: nm, ind: true };
    S.pn = null;
    var lg = p.lk ? leagueOf(p.lk) : null; if (lg && lg.lazy) loadLeague(lg.key);
    if (lg && !p.sport) p.sport = lg.path.split("/")[0];
    var back = S.view && S.view.x ? S.sy1 || 0 : 0;
    if (S.settings) { S.vset = true; S.settings = false; } S.more = false;
    S.view = { person: p, key: key }; S.sy1 = 0;
    swap(function () { render(); window.scrollTo(0, back); }); emit("view", null);
  }
  function renderPerson(out) {
    var p = S.view.person, lg = p.lk ? leagueOf(p.lk) : null;
    var back = el("button", "back", "‹ Back"); back.type = "button"; back.onclick = closeGame;
    var nav = el("div", "navbar"); nav.appendChild(back); nav.appendChild(el("span", "mini-sc", p.name)); out.appendChild(nav);
    var hd = el("div", "tph"); hd.appendChild(headshot(p, "big"));
    var tw = el("div", "tpw"); tw.appendChild(el("h2", null, p.name));
    tw.appendChild(el("p", "tps", lg ? lg.label : p.ll || ""));
    var bar = el("div", "tpacts"), on = fpHas(p.name), fb = el("button", "tpf" + (on ? " on" : ""), on ? "★ Following" : "☆ Follow"); fb.type = "button";
    fb.onclick = function () { buzz(6); togglePerson(p.name); toast((fpHas(p.name) ? "Following " : "Unfollowed ") + p.name); };
    bar.appendChild(fb);
    if (p.web) { var a = el("a", "tpx", "ESPN profile ↗"); a.href = p.web; a.target = "_blank"; a.rel = "noopener"; bar.appendChild(a); }
    tw.appendChild(bar); hd.appendChild(tw); out.appendChild(hd);
    if (!lg) { out.appendChild(notice("No live data for this sport here yet", "Following still works: their name gets the highlight wherever it shows up.")); return; }
    var nm = p.name.toLowerCase(), st = S.lgState[lg.key];
    var mine = S.games[lg.key].filter(function (g) { return (g.pp || []).some(function (n) { return n.toLowerCase() === nm; }); }).map(function (g) { return { g: g, lk: lg.key, ll: lg.label }; });
    var rk = { live: 0, up: 1, final: 2 };
    mine.sort(function (a, b) { return rk[a.g.s] - rk[b.g.s] || (a.g.s === "final" ? byTime(b.g, a.g) : byTime(a.g, b.g)); });
    var cal = S.games[lg.key].filter(function (g) { return g.s !== "final"; }).sort(byTime).slice(0, 3).map(function (g) { return { g: g, lk: lg.key, ll: lg.label }; });
    if (!mine.length) {
      if (lg.lazy && st !== "done" && st !== "failed") { out.appendChild(skel(1)); return; }
      var race = lg.kind === "race";
      if (!race) out.appendChild(notice("No " + lg.label + " event with " + p.name + " right now", "Covers the last week and the next two; fields often post a few days out. Follow and they\u2019re highlighted when they show up."));
      if (cal.length) { var sc0 = el("section", "grp"); sc0.appendChild(el("h2", null, race ? "Next races" : "On the " + lg.label + " calendar")); sc0.appendChild(gridOf(cal, "", true)); out.appendChild(sc0); }
      return;
    }
    var sec0 = el("section", "grp"); sec0.appendChild(el("h2", null, mine.length > 1 ? "Events" : "Event"));
    sec0.appendChild(gridOf(mine, "", true)); out.appendChild(sec0);
  }
  // ---------- the team page: status in words, where they sit in the league, top performers, standings, schedule ----------
  var TLD = {};   // top performers per team, from its latest finished game (in memory only)
  function teamLeaders(name, T, lk) {
    if (!T || !T.me || !lk) return null;
    var fin = (T.games || []).filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime), last = fin[fin.length - 1];
    if (!last) return null;
    var k = lk + "_" + last.id + "_" + T.me[1];
    if (TLD[k] === undefined) {
      TLD[k] = null;
      ESPN.fetchGame(lk, last.id).then(function (d) {
        var seen = {}, out = [];
        (d.leaders || []).forEach(function (l) { if (l.team === T.me[1] && !seen[l.name] && out.length < 3) { seen[l.name] = 1; out.push(l); } });
        TLD[k] = out; if (S.view && S.view.team && S.view.team.name === name) renderSoon();
      }, function () { TLD[k] = []; });
    }
    return { k: k, list: TLD[k], game: last };
  }
  var NUMW = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  function numw(n) { return NUMW[n] || String(n); }
  // Season tier from the league-wide rank: top quarter, middle, below average, or the bottom tenth.
  function teamTier(T) {
    var st = T.standing, lr = st && st.lr, ts = trendStats(T.games || []);
    var pct = lr ? lr.pos / lr.n : ts ? (ts.pct >= 0.6 ? 0.2 : ts.pct >= 0.45 ? 0.5 : 0.75) : null;
    if (pct == null) return null;
    var k = pct > 0.9 ? "fire" : pct > 0.6 ? "cold" : pct > 0.25 ? "avg" : "hot";
    return { k: k, pct: pct, lr: lr, ts: ts };
  }
  function teamStory(name, T, lk) {
    var lg = leagueOf(lk) || {}, st = T.standing, gs = T.games || [], ts = trendStats(gs), tier = teamTier(T), who = lg.soccer ? name : "The " + name, p = [];
    var fin = gs.filter(function (g) { return g.s === "final" && g.my != null && g.op != null; }).sort(byTime), ups = gs.filter(function (g) { return g.s !== "final"; }).sort(byTime);
    if (T.pre && ups[0] && !fin.length) return who + " open the regular season " + (ups[0].home ? "at home against " : "at ") + ups[0].opp + ", " + when(ups[0].t) + ".";
    if (st) p.push(who + " are " + st.record + ", " + ordinal(st.rank) + " in the " + st.group + (st.gb && /^[\d.]+$/.test(st.gb) && +st.gb > 0 ? " (" + st.gb + " back)" : "") + ".");
    else if (ts) p.push(who + " are " + recStr(ts.W, ts.L, ts.T) + " so far.");
    if (ts) {
      var c = ts.cur, l5 = ts.l5;
      if (c.n >= 2 && c.t !== "T") p.push("They’ve " + (c.t === "W" ? "won " : "lost ") + numw(c.n) + " straight" + (l5.n >= 4 && l5.n > c.n ? " and are " + recStr(l5.w, l5.l, l5.t) + " over the last " + numw(l5.n) : "") + ".");
      else if (l5.n >= 3) p.push("They’re " + recStr(l5.w, l5.l, l5.t) + " over the last " + numw(l5.n) + (ts.mom > 0.15 ? " and trending up" : ts.mom < -0.15 ? " and trending down" : "") + ".");
    }
    if (tier && tier.lr) {
      var ll = lg.label || "league", n = tier.lr.n, pos = tier.lr.pos;
      p.push(tier.k === "hot" ? (pos <= 3 ? "That’s " + ordinal(pos) + " of " + n + " in the " + ll + "." : "That puts them in the top quarter of the " + ll + ".") : tier.k === "avg" ? "That’s the middle of the pack, " + ordinal(pos) + " of " + n + " in the " + ll + "." : tier.k === "cold" ? "That’s below average, " + ordinal(pos) + " of " + n + " in the " + ll + "." : "That’s the bottom of the " + ll + ", " + ordinal(pos) + " of " + n + ". Rough stretch.");
    }
    var last = fin[fin.length - 1];
    if (last) p.push("Last time out they " + (last.my > last.op ? "beat " : last.my < last.op ? "lost to " : "tied ") + last.opp + " " + Math.max(last.my, last.op) + "–" + Math.min(last.my, last.op) + (last.home ? " at home." : " on the road."));
    if (ups[0]) p.push("Next: " + (ups[0].home ? "vs " : "at ") + ups[0].opp + ", " + when(ups[0].t) + ".");
    return p.join(" ");
  }
  // The trend graphic: a four-zone bar with the team's marker, the last five as dots, and a dumpster fire for the bottom tenth.
  function tierGauge(T) {
    var tier = teamTier(T); if (!tier) return null;
    var w = el("div", "tdg " + tier.k), bar = el("div", "tdg-b");
    ["fire", "cold", "avg", "hot"].forEach(function (z) { bar.appendChild(el("i", z)); });
    var mk = el("span", "tdg-m"); mk.style.left = Math.round((1 - tier.pct) * 100) + "%"; bar.appendChild(mk);
    w.appendChild(bar);
    var lab = el("div", "tdg-l");
    lab.appendChild(el("b", null, tier.k === "hot" ? "Doing well" : tier.k === "avg" ? "About average" : tier.k === "cold" ? "Below average" : "Bottom of the league"));
    if (tier.lr) lab.appendChild(el("span", null, ordinal(tier.lr.pos) + " of " + tier.lr.n + " by record"));
    w.appendChild(lab);
    if (tier.k === "fire") { var f = el("div", "tdg-f"); f.appendChild(el("span", "bin", "🗑️")); f.appendChild(el("span", "fl", "🔥")); f.setAttribute("aria-label", "Dumpster fire"); w.appendChild(f); }
    var fd = formDots(T.games || []); if (fd) w.appendChild(fd);
    return w;
  }
  function renderTeamPage(out) {
    var t = S.view.team, lk = t.lk, lg = leagueOf(lk) || {};
    var back = el("button", "back", "‹ Back"); back.type = "button"; back.onclick = closeGame;
    var nav = el("div", "navbar"); nav.appendChild(back); nav.appendChild(el("span", "mini-sc", t.name || lg.label || "")); out.appendChild(nav);
    if (!t.name) { out.appendChild(t.err ? notice("Couldn\u2019t find that team", "The link may be from a league this app doesn\u2019t carry.") : skel(2)); return; }
    loadTeam(t.name, lk, t.id);
    var T = S.teams[t.name] || {}, me = T.me || [t.name, t.ab || "", t.lg || "", t.id];
    if (lg.dyn && T.standing && T.standing.group && /^[A-Z0-9._-]+$/.test(lg.label)) {   // "ENG.W.1" → "English Women's Super League"
      lg.label = T.standing.group.replace(/^\d{4}(-\d{2,4})?\s+/, "");
      if (DYN[lg.key]) { DYN[lg.key][1] = lg.label; try { localStorage.setItem("sb-dyn", JSON.stringify(DYN)); } catch (e) {} }
    }
    // Header: logo, name, league, record and standing line, follow button.
    var hd = el("div", "tph"), lb = el("span", "ab lg big");
    if (me[2] && PREF.logos) lb.appendChild(logoImg(me[2], me[1])); else { lb.className = "ab big"; lb.textContent = me[1] || t.name.slice(0, 3).toUpperCase(); }
    hd.appendChild(lb);
    var tw = el("div", "tpw"); tw.appendChild(el("h2", null, t.name));
    var sub = [lg.label]; if (T.pre) { var u0 = (T.games || []).filter(function (g) { return g.s === "up"; }).sort(byTime)[0]; if (u0) sub.push("season starts " + when(u0.t)); }
    if (T.standing) { sub.push(T.standing.record); sub.push(ordinal(T.standing.rank) + " in " + T.standing.group); if (T.standing.streak) sub.push("streak " + T.standing.streak); }
    tw.appendChild(el("p", "tps", sub.filter(Boolean).join(" · ")));
    var fol = C.followed.indexOf(t.name) >= 0, fb = el("button", "tpf" + (fol ? " on" : ""), fol ? "★ Following" : "☆ Follow"); fb.type = "button";
    fb.onclick = function () { followTeam({ lk: lk, id: t.id, name: t.name }); };
    var acts = el("div", "tpacts"); acts.appendChild(fb);
    var shb = el("button", "tpx", "Share"); shb.type = "button";
    shb.onclick = function () { var u = location.href; if (navigator.share) navigator.share({ title: t.name, url: u }).catch(function () {}); else copyText(u, "Link copied"); };
    acts.appendChild(shb);
    tw.appendChild(acts); hd.appendChild(tw); out.appendChild(hd);
    if (!T.done) { out.appendChild(skel(2)); return; }
    if (T.missing || T.error) { out.appendChild(notice("Couldn’t load " + t.name, "Pull down to try again.")); return; }
    var gs = T.games || [], ups = gs.filter(function (g) { return g.s !== "final"; }).sort(byTime), fin = gs.filter(function (g) { return g.s === "final"; }).sort(function (x, y) { return byTime(y, x); });
    // Status in words.
    var story = teamStory(t.name, T, lk); if (story) { var sb0 = el("div", "sum tpn"); sb0.appendChild(el("p", null, story)); out.appendChild(sb0); }
    var gg = tierGauge(T); if (gg) out.appendChild(gg);
    // Top three from the latest finished game (one cached request).
    var ld = teamLeaders(t.name, T, lk);
    if (ld) {
      var lw = el("div", "tpl3"); lw.appendChild(el("h4", null, "Top performers · " + (ld.game.my > ld.game.op ? "W " : ld.game.my < ld.game.op ? "L " : "T ") + ld.game.my + "–" + ld.game.op + " " + (ld.game.home ? "vs " : "at ") + ld.game.opp));
      if (ld.list === null) lw.appendChild(el("p", "rb", "Loading…"));
      else if (!ld.list.length) lw.appendChild(el("p", "rb", "No player lines in that box score."));
      else ld.list.forEach(function (l, i) { var r = el("div", "tpp"); r.appendChild(el("span", "tpp-n", String(i + 1))); var nm = el("span", "tpp-w"); nm.appendChild(el("b", null, l.name)); nm.appendChild(el("small", null, l.cat.replace(/ Leader$/i, ""))); r.appendChild(nm); r.appendChild(el("span", "tpp-l", l.line)); lw.appendChild(r); });
      out.appendChild(lw);
    }
    var stt = T.standing && standTable(t.name, T.standing, lk); if (stt) out.appendChild(stt);
    var sch = el("div", "tpsch");
    sch.appendChild(gameList("Next", ups.slice(0, 3), T, lk));
    if (ups.length > 3) { var sd = el("details", "stn"), sb = el("div", "stbox"); sd.appendChild(el("summary", null, "Full schedule · " + ups.length + " games")); sd.appendChild(sb); sd.addEventListener("toggle", function () { if (sd.open && !sb.firstChild) sb.appendChild(gameList("All upcoming", ups, T, lk)); }); sch.appendChild(sd); }
    sch.appendChild(gameList("Last", fin.slice(0, 3), T, lk));
    if (fin.length > 3) { var rd = el("details", "stn"), rb = el("div", "stbox"); rd.appendChild(el("summary", null, "All results · " + fin.length + " games")); rd.appendChild(rb); rd.addEventListener("toggle", function () { if (rd.open && !rb.firstChild) rb.appendChild(gameList("Results", fin, T, lk)); }); sch.appendChild(rd); }
    out.appendChild(sch);
  }


  // ---------- routing (#game/<league>/<id>) so the phone's Back button works ----------
  function openGame(x) { buzz(4); if (S.view && (S.view.team || S.view.person)) S.sy1 = window.pageYOffset; else if (!S.view) S.sy = window.pageYOffset; pushHash("game/" + x.lk + "/" + x.g.id); }
  // gesture: the edge swipe (no cross-fade). A tap on Back marks the hash change as the app's own (cross-fade).
  function closeGame(gesture) {
    gesture = gesture === true;   // Back buttons pass their click event here
    NAV = gesture ? 0 : Date.now();
    if (S.depth > 0) { S.depth--; history.back(); } else { clearHash(); if (gesture) GEST = true; syncFromHash(); GEST = false; }
  }
  // History holds exactly one entry per page the app opened (S.depth of them above the list), never stray copies: a
  // leftover entry is what a back swipe can land on, showing one screen while the taps go to another.
  function pushHash(h) { if (location.hash === "#" + h) return; S.depth++; NAV = Date.now(); location.hash = h; }
  // Leaving the open pages some other way (a tab, the logo, Settings) steps back over all of them instead of rewriting
  // the top entry, so nothing is left behind to go back into.
  function clearHash() {
    if (S.depth > 0 && location.hash) { var n = S.depth; S.depth = 0; NAV = Date.now(); try { history.go(-n); } catch (e) {} return; }
    S.depth = 0; if (location.hash) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  function syncFromHash() {
    var tm = /^#team\/([a-z0-9]+)\/([\w-]+)$/.exec(location.hash);
    if (tm) { openTeamRoute(tm[1], tm[2]); return; }
    var pm = /^#who\/([a-z0-9]+)\/(\d+)\/(.+)$/.exec(location.hash);
    if (pm) { var pn = pm[3]; try { pn = decodeURIComponent(pn); } catch (e) {} openPersonRoute(pm[1], pm[2], pn); return; }
    var m = /^#game\/([a-z0-9]+)\/([\w-]+)$/.exec(location.hash);
    if (!m) { if (S.view) { swap(function () { S.view = null; if (S.vset) { S.vset = false; S.settings = true; } render(); window.scrollTo(0, S.sy || 0); S.sy = 0; emit("view", null); }); } return; }
    if (!S.ready) return;
    var key = m[1] + "_" + m[2];
    if (S.view && S.view.key === key) return;
    var x = allGames().filter(function (q) { return q.lk === m[1] && q.g.id === m[2]; })[0];
    if (!x) { var yl = (S.yf[m[1]] || []).filter(function (g) { return g.id === m[2]; })[0], lg0 = leagueOf(m[1]); if (yl && lg0) x = { g: yl, lk: m[1], ll: lg0.label }; }   // yesterday's finals live in S.yf once trimmed from the list
    if (!x && SG[key]) x = { g: SG[key], lk: m[1], ll: (leagueOf(m[1]) || {}).label || "" };   // a game tapped on a team's schedule
    if (!x) { S.view = null; render(); return; }
    S.view = { x: x, key: key, d: ESPN.peekGame(m[1], m[2]), n: undefined };
    if (window.FUN && FUN.team) FUN.team(x.lk, x.g); else S.gvq = (S.gvq || 0) + 1;   // opened before the fun layer loaded: counted when it does
    swap(function () { render(); window.scrollTo(0, 0); }); loadDetail(); loadNarr(); emit("view", x);
  }
  // The written recap/preview (AP via ESPN) loads alongside the box score and is added when it arrives.
  function loadNarr() {
    var v = S.view;
    if (!v || v.x.g.ev) return;
    ESPN.fetchNarrative(v.x.lk, v.x.g.id, v.x.g.s === "final").then(function (n) {
      if (S.view && S.view.key === v.key && n) { S.view.n = n; renderSoon(); }
    });
  }
  function loadDetail() {
    var v = S.view;
    if (!v || v.x.g.ev) return;
    ESPN.fetchGame(v.x.lk, v.x.g.id).then(function (d) {
      if (S.view && S.view.key === v.key && JSON.stringify(d) !== JSON.stringify(S.view.d)) { S.view.d = d; renderSoon(); }
    }, function () {
      if (S.view && S.view.key === v.key && S.view.d === undefined) { S.view.d = null; renderSoon(); }
    });
  }

  // ---------- the rail: built once, updated in place so the highlight slides between tabs ----------
  var RAIL = null;
  function railBtn(key, label, cls, icon) {
    var b = el("button", cls); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("data-k", key);
    if (icon) { var ic = el("span", "ico", icon); ic.setAttribute("aria-hidden", "true"); b.appendChild(ic); }
    b.appendChild(el("span", "lbl", label));
    b.onclick = function () { goTab(b.getAttribute("data-k")); };
    return b;
  }
  var MAINTABS = ["pinned", "yesterday", "teams", "top"];
  function goTab(key) {
    buzz(6);
    if (key === S.tab && !S.settings && !S.view) { if (window.scrollY > 40) window.scrollTo({ top: 0, behavior: "smooth" }); return; }   // tap the active tab to jump to the top
    if (!S.view && !S.settings) SCY[S.tab] = window.scrollY;
    S.tab = key; S.view = null; S.settings = false; S.more = false; clearHash();
    if (key === "yesterday") loadLeaders();
    var lz = leagueOf(key); if (lz && lz.lazy) loadLeague(key);
    try { localStorage.setItem("sb-tab", S.tab); } catch (e) {}
    render();
    var y0 = SCY[key] || 0; if (y0) requestAnimationFrame(function () { window.scrollTo({ top: y0, behavior: "instant" }); });   // each tab remembers where you were
  }
  function buildRail() {
    var rail = $("rail"), main = el("div", "rail-main"), lgs = el("div", "rail-lg");
    main.appendChild(el("span", "rail-ind"));
    main.appendChild(railBtn("pinned", "Following", "tab big", "\u2605"));
    main.appendChild(railBtn("yesterday", "Yesterday", "tab big", "\u21BA"));
    main.appendChild(railBtn("teams", "My teams", "tab big", "\u2691"));
    main.appendChild(railBtn("top", "Top games", "tab big", "\u2197"));
    lgs.appendChild(railBtn("all", "All", "tab"));
    LG.forEach(function (l) { if (MAIN.indexOf(l.key) >= 0) lgs.appendChild(railBtn(l.key, l.label, "tab")); });
    var ex = railBtn("", "", "tab"); ex.hidden = true; lgs.appendChild(ex);
    var mb = el("button", "tab more-btn", "More"); mb.type = "button";
    mb.onclick = function () { S.more = !S.more; render(); };
    lgs.appendChild(mb); lgs.appendChild(findBar());
    rail.appendChild(main); rail.appendChild(lgs);
    RAIL = { ind: main.firstChild, ex: ex, mb: mb, btns: [].slice.call(rail.querySelectorAll("[data-k]")) };
  }
  function updateRail() {
    if (!RAIL) buildRail();
    var cur = S.settings || S.view ? "" : S.tab, lz = cur && MAIN.indexOf(cur) < 0 && leagueOf(cur);
    if (lz) { RAIL.ex.hidden = false; RAIL.ex.setAttribute("data-k", lz.key); RAIL.ex.querySelector(".lbl").textContent = lz.label; } else RAIL.ex.hidden = true;
    RAIL.btns.forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-k") === cur ? "true" : "false"); });
    var bi = MAINTABS.indexOf(cur);
    RAIL.ind.style.transform = "translateX(calc(" + Math.max(0, bi) + " * (100% + 6px)))"; RAIL.ind.classList.toggle("off", bi < 0);
    RAIL.mb.textContent = S.more ? "Close" : "More"; RAIL.mb.setAttribute("aria-expanded", S.more ? "true" : "false");
    document.body.classList.toggle("gv", !!S.view);
  }

  // ---------- Top games: every loaded sport on one screen, the biggest games first ----------
  // "Big" is a cheap score from what the scoreboard feed already carries, so the tab costs no extra requests: the
  // league's draw, a national network, ranked teams, two good records, a playoff / rivalry / cup note, your teams,
  // and for finals overtime or an upset. Close games and live games sit on top the way they do on Following; the rest
  // is the top of the list with the long tail behind a button.
  var LGH = { nfl: 50, nba: 40, ncaafb: 36, mlb: 34, nhl: 30, f1: 30, ufc: 30, ucl: 28, epl: 26, ncaamb: 24, pga: 20, laliga: 18, afl: 16, nascar: 16, wnba: 14, seriea: 14, bund: 14, uel: 14, mls: 12, ligue1: 12, wc: 60 };
  var NATL = /^(NBC|CBS|FOX|ABC|ESPN|TNT|TBS|Prime|Amazon|Netflix|Peacock|Apple|NFL N|truTV|FS1|NBA TV|MLB N|NHL N|USA|Paramount|Sky|TSN|Sportsnet)/i;
  var BIGN = /final|championship|playoff|world series|stanley cup|super bowl|game \d|bowl|cup|derby|cl[aá]sico|classic|rivalry|wild card|division|semifinal|quarterfinal|opening|opener|all-star/i;
  function wpOf(rec) { var m = /^(\d+)-(\d+)(?:-(\d+))?/.exec(rec || ""); if (!m) return null; var w = +m[1], l = +m[2], t = +m[3] || 0, n = w + l + t; return n >= 3 ? (w + t / 2) / n : null; }
  function hype(x) {
    var g = x.g, h = LGH[x.lk] || 10;
    if (g.b) h += NATL.test(g.b) ? 22 : 4;
    var rh = g.h[6], ra = g.a[6];
    if (rh) h += 14 + Math.max(0, 25 - rh) / 2; if (ra) h += 14 + Math.max(0, 25 - ra) / 2; if (rh && ra) h += 10;
    var wh = wpOf(g.h[3]), wa = wpOf(g.a[3]);
    if (wh != null && wa != null) { h += (wh + wa) * 12; if (wh >= .6 && wa >= .6) h += 10; }
    if (g.n && BIGN.test(g.n)) h += /game 7/i.test(g.n) ? 36 : 24;
    if (isFollowed(g)) h += 18;
    if (g.ev) h += 8;                                           // a fight card or race weekend is its sport's whole day
    if (g.s === "final") {
      if (g.o) h += 8;
      if (wh != null && wa != null && g.h[2] != null && g.a[2] != null) { var hw = g.h[2] > g.a[2]; if ((hw && wh + .15 < wa) || (!hw && wa + .15 < wh)) h += 10; }   // an upset
    }
    return h;
  }
  function byHype(a, b) { return (b._h || (b._h = hype(b))) - (a._h || (a._h = hype(a))) || byTime(a.g, b.g); }
  var TOPN = { up: 10, fin: 6 }, TOPX = {};
  function renderTop(out, all) {
    var items = all.filter(function (x) { return PREF.hideL.indexOf(x.lk) < 0 || isFollowed(x.g); });
    if (!items.length) { out.appendChild(S.loading ? skel(3, true) : notice("Nothing here right now", "The biggest games across every sport show up here.")); return; }
    var close = items.filter(isClose).sort(function (a, b) { return Math.abs(a.g.h[2] - a.g.a[2]) - Math.abs(b.g.h[2] - b.g.a[2]) || byHype(a, b); });
    var live = items.filter(function (x) { return x.g.s === "live" && close.indexOf(x) < 0; }).sort(byHype);
    var lim = PREF.upwin === "all" ? Infinity : Date.now() + (PREF.upwin === "1" ? 1 : 3) * DAY, dayAgo = Date.now() - 1.5 * DAY;
    var up = items.filter(function (x) { return x.g.s === "up" && Date.parse(x.g.t) <= lim; }).sort(byHype);
    var fin = items.filter(function (x) { return x.g.s === "final" && Date.parse(x.g.t) > dayAgo; }).sort(byHype);
    function capped(title, cls, list, k) {
      var n = TOPX[k] ? list.length : TOPN[k], s = group(title, cls, list.slice(0, n), true); if (!s) return;
      out.appendChild(s);
      if (list.length > n) { var b = el("button", "sr-more dim2", (list.length - n) + " more \u00b7 show"); b.type = "button"; b.onclick = function () { TOPX[k] = 1; render(); }; out.appendChild(b); }
    }
    [group("Close games", "close", close, true), group("Live now", "live", live, true)].forEach(function (s) { if (s) out.appendChild(s); });
    capped("Biggest coming up", "", up, "up"); capped("Biggest finals", "", fin, "fin");
    if (!close.length && !live.length && !up.length && !fin.length) out.appendChild(notice("Nothing big right now", "Live, close and marquee games across every sport show up here."));
  }

  // ---------- main render ----------
  function render() {
    updateRail();
    var all = allGames(), fol = all.filter(function (x) { return isFollowed(x.g); });
    var out = $("out"); IMGN = 0;
    TFF = (D0.activeElement && D0.activeElement.getAttribute && D0.activeElement.getAttribute("data-tf")) || "";
    // Entrance animations play when you arrive somewhere new, not on the quiet once-a-minute refreshes.
    var vk = [S.tab, S.ysub, S.view ? S.view.key : "", S.settings ? 1 : 0, S.more ? 1 : 0].join("|");
    // A quiet refresh of a list keeps every card that didn't change (no logo reload, no flicker) and keeps your focus.
    var quiet = vk === RK && !S.view && !S.settings && S.ready, OLD = null, FK = null;
    if (quiet) {
      OLD = {}; [].forEach.call(out.querySelectorAll(".card[data-k]"), function (c) { OLD[c.getAttribute("data-k")] = c; });
      var ae = D0.activeElement, fc = ae && ae.closest && ae.closest("#out [data-k]"); FK = fc && fc.getAttribute("data-k");
    }
    out.textContent = "";
    if (vk !== RK) {
      RK = vk; out.classList.add("enter"); clearTimeout(RT);
      out.setAttribute("data-fx", window.FUN ? FUN.enterFx() : "rise");
      if (window.FUN) requestAnimationFrame(function () { FUN.after(out); }); RT = setTimeout(function () { out.classList.remove("enter"); }, 1500);
    }
    else { out.classList.remove("enter"); clearTimeout(RT); RT = 0; }   // same view, new data: swap in place, no second entrance

    if (FIND && FIND._fresh) FIND._fresh();
    if (!S.ready) { out.appendChild(skel(4, true)); emit("render", out); return; }
    if (S.settings) { renderSettings(out); emit("render", out); return; }
    if (S.view) { if (S.view.team) renderTeamPage(out); else if (S.view.person) renderPerson(out); else renderDetail(out); emit("render", out); return; }
    if (S.more) out.appendChild(morePanel());
    if (S.tab === "yesterday") { renderYesterday(out); emit("render", out); return; }
    if (S.tab === "teams") { renderTeams(out); emit("render", out); return; }
    if (S.tab === "top") { renderTop(out, all); if (OLD) reuseCards(out, OLD, FK); emit("render", out); return; }

    var items = S.tab === "pinned" ? fol : S.tab === "all" ? all.filter(function (x) { return PREF.hideL.indexOf(x.lk) < 0 || isFollowed(x.g); }) : all.filter(function (x) { return x.lk === S.tab; });
    var pins = all.filter(isPinned);
    items = items.filter(function (x) { return !isPinned(x); });
    var cl = leagueOf(S.tab), cst = cl && S.lgState[cl.key];
    if (!items.length && !pins.length) {
      out.appendChild(cst === "loading" ? skel(3) : cst === "failed" ? notice("Couldn\u2019t load " + cl.label, "Pull down to retry.") : notice("Nothing here right now", S.tab === "pinned" ? "Games for the teams and people you follow show up here." : "No games in this view."));
      emit("render", out); return;
    }
    var big = S.tab === "pinned";
    var close = items.filter(isClose).sort(function (a, b) { return Math.abs(a.g.h[2] - a.g.a[2]) - Math.abs(b.g.h[2] - b.g.a[2]); });
    var live = items.filter(function (x) { return x.g.s === "live" && close.indexOf(x) < 0; });
    var lim = PREF.upwin === "all" ? Infinity : Date.now() + (PREF.upwin === "1" ? 1 : 3) * DAY, hidden = 0;
    var up = items.filter(function (x) { if (x.g.s !== "up") return false; if (Date.parse(x.g.t) > lim && !isFollowed(x.g) && !isPinned(x)) { hidden++; return false; } return true; }).sort(function (a, b) { return byTime(a.g, b.g); });
    var fin = items.filter(function (x) { return x.g.s === "final"; }).sort(function (a, b) { return byTime(b.g, a.g); });
    [group("Pinned", "pin", pins, big), group("Close games", "close", close, big), group("Live now", "live", live, big), group("Coming up", "", up, big, true), group("Final", "", fin, big, true)].forEach(function (s) { if (s) out.appendChild(s); });
    if (hidden) { var hb = el("button", "sr-more dim2", hidden + " more game" + (hidden > 1 ? "s" : "") + " later this week \u00b7 show"); hb.type = "button"; hb.onclick = function () { setPref("upwin", "all"); render(); }; out.appendChild(hb); }
    if (OLD) reuseCards(out, OLD, FK);
    emit("render", out);
  }
  // Swap unchanged new cards for the ones already on screen (same game, same signature), then put focus back.
  function reuseCards(out, OLD, FK) {
    [].forEach.call(out.querySelectorAll(".card[data-k]"), function (c) {
      var o = OLD[c.getAttribute("data-k")];
      if (!o || o.getAttribute("data-sig") !== c.getAttribute("data-sig") || o.className !== c.className) return;
      o._x = c._x; o.onclick = c.onclick; o.onkeydown = c.onkeydown; o.style.visibility = "";
      c.parentNode.replaceChild(o, c);
    });
    if (FK) { var n = out.querySelector('[data-k="' + FK + '"]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} } }
  }

  // ---------- Find a game: the search bar at the end of the league row ----------
  // Typing searches every loaded game, plus teams and athletes from every sport (the same search as Find a team). For
  // the best team matches it also pulls that team's schedule (one request, kept for its page) so a game that isn't
  // loaded anywhere still turns up: live, next and last. Results drop down under the bar; tapping a game opens it.
  var FIND = null, FINDQ = null, FG = {};
  // What a league answers to besides its label: its sport, and what people call it ("golf", "fights", "grand prix").
  var LGW = { mma: "mma fight fights fighting", racing: "racing race races motorsport", golf: "golf", tennis: "tennis", soccer: "soccer futbol",
    f1: "formula one formula 1 grand prix gp", nascar: "cup stock car", pga: "golf", lpga: "womens golf", eur: "european tour dp world",
    epl: "prem english", ucl: "champions league", ncaafb: "college football cfb ncaaf", ncaamb: "college basketball cbb ncaam march madness",
    ncaawb: "womens college basketball ncaaw", wnba: "womens basketball", nwsl: "womens soccer" };
  function lgWords(lg) {
    if (!lg) return "";
    if (lg._w == null) { var sp = (lg.path || "").split("/")[0]; lg._w = wordsOf([lg.label, lg.key, sp, LGW[lg.key] || "", LGW[sp] || ""].join(" ")); }
    return lg._w;
  }
  // Leagues whose words start with every typed word: "golf" → PGA, LPGA, DP World; "f1", "ufc", "prem", "college foot".
  function leagueHits(raw) {
    var toks = wordsOf(raw).trim().split(" ").filter(Boolean); if (!toks.length || raw.length < 2) return [];
    // Short words must be a whole word ("f1", "gp", "ufc"); three letters on, the start of one is enough.
    return LG.filter(function (l) { var w = lgWords(l) + " "; return toks.every(function (t) { return w.indexOf(" " + t + (t.length < 3 ? " " : "")) >= 0; }); });
  }
  // A game's searchable words (names, abbreviations, league and sport words, event name, network, entrants), spaced so a
  // word start is " " + word.
  function hayW(x) {
    var g = x.g, lg = leagueOf(x.lk) || {};
    return wordsOf([g.h[0], g.h[1], g.a[0], g.a[1], x.ll, lgWords(lg), g.n, g.b, (g.pp || []).join(" ")].filter(Boolean).join(" ")) + " ";
  }
  // The search language loads the first time search is used (and on an idle moment after start), then stays cached.
  var SQW = [];
  function ensureSQ(cb) {
    if (window.SQ) { if (cb) cb(); return; }
    if (cb) SQW.push(cb); if (ensureSQ.on) return; ensureSQ.on = 1;
    addScript("search.js", function () { var q = SQW; SQW = []; q.forEach(function (f) { f(); }); });
  }
  var SQX = { tz: C.timezone, path: function (lk) { return (leagueOf(lk) || {}).path || ""; }, isClose: function (x) { return isClose(x); }, isFollowed: function (x) { return isFollowed(x.g); } };
  function parseQ(raw) {
    if (window.SQ) { SQX.now = new Date(); return SQ.parse(raw, SQX); }
    // until search.js arrives (a moment, once): plain words, each matched by word start
    var groups = wordsOf(raw).trim().split(" ").filter(Boolean).map(function (w) { return [w]; });
    return { groups: groups, tq: raw, chips: [], lkf: [], lks: [], days: [], dayOffs: [], intent: false, timed: false, sep: 0,
      test: function (x, hw) { return groups.every(function (g) { return hw.indexOf(" " + g[0]) >= 0; }); } };
  }
  // Games fetched just for a search: a day outside the loaded window, or a league that isn't loaded. Kept for the session.
  var FX = {}, FXS = {};   // FXS["lk|day"]: 1 while its request is out, 2 once answered
  function fxGames() { var o = []; Object.keys(FX).forEach(function (k) { FX[k].forEach(function (g) { o.push({ g: g, lk: g.lk, ll: (leagueOf(g.lk) || {}).label || "" }); }); }); return o; }
  // Looks for what the words name and isn't on hand (at most 3 leagues x 3 days), and starts those fetches after a
  // typing pause. True while any of them are out, so the list says "Looking that up" instead of "nothing".
  function planFetch(P, raw) {
    var lks = P.lks.slice(); leagueHits(P.tq || "").forEach(function (l) { if (lks.indexOf(l.key) < 0) lks.push(l.key); });
    lks = lks.filter(function (k) { return leagueOf(k); }).slice(0, 3);
    var offs = P.dayOffs.filter(function (o) { return o >= -7 && o <= 14; }).slice(0, 3), jobs = [], busy = false;
    lks.forEach(function (k) {
      var l = leagueOf(k), st = S.lgState[k], loaded = !l.lazy || st === "done";
      if (st === "loading") busy = true;
      if (!loaded) {   // a league that isn't loaded loads whole (event leagues always do: one request covers weeks)
        if (st !== "loading" && st !== "failed") { busy = true; jobs.push(function () { loadLeague(k); }); }
        if (l.kind || !offs.length) return;
      }
      if (l.kind) return;
      var need = offs.filter(function (o) { return !(loaded && o >= -1 && o <= C.daysAhead); });
      need.forEach(function (o) { if (FXS[k + "|" + o] === 1) busy = true; });
      var todo = need.filter(function (o) { return !FXS[k + "|" + o]; });
      if (!todo.length) return;
      busy = true;
      jobs.push(function () {
        todo.forEach(function (o) { FXS[k + "|" + o] = 1; });
        ESPN.fetchScores(todo, [k]).then(function (r) { FX[k + "|" + todo.join(",")] = r.byLeague[k] || []; }, function () {}).then(function () {
          todo.forEach(function (o) { FXS[k + "|" + o] = 2; }); if (FIND && FIND._fresh) FIND._fresh();
        });
      });
    });
    clearTimeout(planFetch.t);
    if (jobs.length) planFetch.t = setTimeout(function () { if (FIND && FINDQ && FINDQ.value.trim().toLowerCase() === raw) jobs.forEach(function (j) { j(); }); }, 350);
    return busy;
  }
  // A team's schedule for Find, once per team per session; it also fills S.teams so its page opens without waiting.
  // A team's games for Find: what's on hand (a team page already loaded, or an earlier lookup) comes back at once;
  // otherwise, with go, one schedule request starts (no standings; ESPN.scheduleOf keeps it for the team page).
  // A failed lookup stays empty for the session, so typing never loops on it.
  function findSched(t, go) {
    var k = t.lk + "_" + t.id, e = FG[k];
    if (e) return e.v;
    var T = S.teams[t.name]; if (T && T.done && T.games && T.me && T.lk === t.lk) { FG[k] = { v: T }; return T; }
    if (!go) return;
    e = FG[k] = {}; e.p = ESPN.scheduleOf(t.lk, t.id).then(function (v) { e.v = v; }, function () { e.v = { games: [] }; });
  }
  // Live first, then the next game, then the last result: the games someone searching for a team most likely wants.
  function schedPicks(T) {
    var gs = (T.games || []).slice().sort(function (a, b) { return Date.parse(a.t) - Date.parse(b.t); });
    var live = gs.filter(function (g) { return g.s === "live"; }), up = gs.filter(function (g) { return g.s === "up"; }), fin = gs.filter(function (g) { return g.s === "final"; });
    return live.concat(up.slice(0, live.length ? 0 : 1)).concat(fin.slice(-1));
  }
  // A league in Find: what's on there now (live count, or when the next event is), tap to open its tab.
  function leagueRow(l) {
    var r = el("div", "find-tm click lg-row"), gs = S.games[l.key] || [], st = S.lgState[l.key];
    var live = gs.filter(function (g) { return g.s === "live"; }).length, nx = gs.filter(function (g) { return g.s === "up"; }).sort(byTime)[0];
    r.appendChild(el("span", "ab", (l.key.length <= 4 ? l.key : l.label.split(/\s+/).map(function (w) { return w.charAt(0); }).join("")).slice(0, 4).toUpperCase()));
    var w = el("span", "find-tw"); w.appendChild(el("b", null, l.label));
    w.appendChild(el("small", live ? "lv-t" : null, live ? "\u25CF " + live + " live now" : nx ? "Next: " + (nx.n ? nx.n + " \u00b7 " : "") + when(nx.t) : st === "loading" ? "Loading events\u2026" : st === "done" || !l.lazy ? "Nothing scheduled in the next few days" : "Tap for the schedule"));
    r.appendChild(w); r.appendChild(el("span", "find-go", "\u203a"));
    r.tabIndex = 0; r.setAttribute("role", "button");
    var go = function () { closeFind(); pickLeague(l); };
    r.onclick = go; r.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } };
    return r;
  }
  function closeFind() {
    if (!FIND) return; var f = FIND; FIND = null;
    if (f._kb && window.visualViewport) visualViewport.removeEventListener("resize", f._kb);
    f.classList.remove("in"); document.body.classList.remove("find-on"); $("rail").classList.remove("finding");
    if (FINDQ) { FINDQ.value = ""; FINDQ.dispatchEvent(new Event("input")); try { FINDQ.blur(); } catch (e) {} }
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 220);
  }
  function findBar() {
    var w = el("div", "rfind"), inp = el("input", "rf-q"), x = el("button", "rf-x", "Cancel");
    inp.type = "search"; inp.placeholder = "Find a game"; inp.autocomplete = "off"; inp.enterKeyHint = "search";
    inp.setAttribute("aria-label", "Find a game, team or athlete"); x.type = "button";
    x.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    x.onclick = closeFind;
    inp.addEventListener("focus", openFind);
    inp.addEventListener("click", function () { if (!FIND) openFind(); });   // focus can be skipped (window not focused, already focused)
    inp.addEventListener("input", function () { if (!FIND && inp.value) openFind(); });
    w.appendChild(clearable(inp)); w.appendChild(x); FINDQ = inp;
    return w;
  }
  function openFind() {
    if (!FINDQ) return;
    if (FIND) { try { FINDQ.focus(); } catch (e) {} return; }
    var rail = $("rail"), inp = FINDQ, ov = el("div", "find rfp"), res = el("div", "find-res"), hint = el("p", "find-h", "Any team, athlete or league. Add a sport to narrow it: \u201cboston college football\u201d.");
    ov.appendChild(hint); ov.appendChild(res);
    rail.classList.remove("hide"); rail.classList.add("finding");
    var all = allGames().map(function (g) { return { x: g, w: hayW(g) }; }), cur = [], ctl = {}, st = 0;
    ensureSQ(function () { if (FIND === ov && inp.value.trim()) fill(); });
    // every game Find can show: loaded ones plus any fetched just for a search (deduped)
    function pool() {
      var o = all.slice(), have = {}; all.forEach(function (e) { have[e.x.lk + "_" + e.x.g.id] = 1; });
      fxGames().forEach(function (x) { var k = x.lk + "_" + x.g.id; if (!have[k]) { have[k] = 1; o.push({ x: x, w: hayW(x) }); } });
      return o;
    }
    var VOC = null;
    function vocab() {   // the typo repair's dictionary: team and league names on hand plus the search language's own words
      if (VOC) return VOC; VOC = window.SQ ? SQ.words() : {};
      var addW = function (str, wt) { wordsOf(str).trim().split(" ").forEach(function (w) { if (w.length >= 3 && !(VOC[w] > wt)) VOC[w] = wt; }); };
      (TEAMS || []).forEach(function (t) { addW(t.name, 3); });
      all.forEach(function (e) { addW(e.x.g.h[0] + " " + e.x.g.a[0], 3); });
      LG.forEach(function (l) { addW(l.label, 2); });
      REC.forEach(function (r) { addW(r.name, 4); });
      return VOC;
    }
    teamIndex().then(function () { if (FIND === ov) fill(); });
    ctl.redraw = function () { if (FIND === ov) fill(); };
    // New scores while the panel is open: the result cards update in place (scroll position kept).
    ov._fresh = function () { if (FIND !== ov || document.querySelector(".portal") || !inp.value.trim()) return; all = allGames().map(function (g) { return { x: g, w: hayW(g) }; }); var y = ov.scrollTop; fill(); ov.scrollTop = y; };
    function open(c, gx) { portal(c, gx); }
    function gameCard(gx, grid) {
      var c = card(gx); c.classList.add("click"); c.tabIndex = 0; c.setAttribute("role", "button");
      c.onclick = function () { open(c, gx); };
      c.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); open(c, gx); } };
      grid.appendChild(c); cur.push({ c: c, x: gx });
    }
    // Empty box: one-tap searches (live games, today, the teams you follow), then what you opened lately.
    function chips() {
      var row = el("div", "fchips"), anyLive = all.some(function (e) { return e.x.g.s === "live"; });
      (anyLive ? [["\u25CF Live now", "live now"]] : []).concat([["Today", "today"]]).concat(C.followed.slice(0, 4).map(function (n) { return [n, n]; })).forEach(function (c) {
        var b = el("button", "fchip" + (c[1] === "live now" ? " lv" : ""), c[0]); b.type = "button";
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // keep the keyboard where it is
        b.onclick = function () { buzz(4); inp.value = c[1]; inp.dispatchEvent(new Event("input", { bubbles: true })); };
        row.appendChild(b);
      });
      res.appendChild(row);
    }
    // One query, start to finish. The search language (search.js) turns the words into filters ("monday night
    // football", "pats tonight", "close games", "on espn") plus words left to match; games come from what's loaded,
    // from the best team matches' schedules, and from a day or league fetched just for this search. Nothing found:
    // fix a typo, then loosen the words, then offer one-tap starts; the list is never just empty.
    function fill(over, note, depth) {
      var raw0 = inp.value.trim(), raw = (over || raw0).toLowerCase(); res.textContent = ""; cur = [];
      if (!raw) { hint.hidden = false; chips(); drawRecent(res); return; }
      hint.hidden = true;
      var P = parseQ(raw), shown = 0, waiting = false;
      if (note) res.appendChild(el("p", "find-fix", note));
      if (P.chips.length) { var ir = el("div", "find-int"); ir.appendChild(el("span", null, "Showing")); P.chips.forEach(function (c) { ir.appendChild(el("b", null, c)); }); res.appendChild(ir); }
      // games on hand
      var hits = pool().filter(function (e) { return P.test(e.x, e.w); });
      var rk = { live: 0, up: 1, final: 2 }, now = Date.now();
      if (P.status === "final") hits.sort(function (a, b) { return Date.parse(b.x.g.t) - Date.parse(a.x.g.t); });
      else if (P.timed) hits.sort(function (a, b) { return rk[a.x.g.s] - rk[b.x.g.s] || (a.x.g.s === "final" ? Date.parse(b.x.g.t) - Date.parse(a.x.g.t) : Date.parse(a.x.g.t) - Date.parse(b.x.g.t)); });
      else hits.sort(function (a, b) { return (isFollowed(b.x.g) ? 1 : 0) - (isFollowed(a.x.g) ? 1 : 0) || rk[a.x.g.s] - rk[b.x.g.s] || Math.abs(Date.parse(a.x.g.t) - now) - Math.abs(Date.parse(b.x.g.t) - now); });
      var lim = P.intent ? 24 : 12, seen = {}, grid = el("div", "grid");
      hits.slice(0, lim).forEach(function (e) { seen[e.x.lk + "_" + e.x.g.id] = 1; gameCard(e.x, grid); });
      // what isn't on hand: a named day or league is fetched once the typing pauses
      if (planFetch(P, raw)) waiting = true;
      // the best team matches' own schedules (a matchup searches its first team and keeps games against the second)
      var tq = P.sep && P.groups.length >= 2 ? P.groups[0][0] : P.tq, TS = tq ? searchState(tq) : null;
      var tms = TS ? mergeTeams(TS.q, TS.r).filter(function (t) { return !t.dl && t.id && leagueOf(t.lk) && TS.sq.ok(pathOfTeam(t)); }).slice(0, 2) : [], pend = [];
      tms.forEach(function (t) {
        var T = findSched(t);
        if (!T) { pend.push(t); return; }
        var lbl = (leagueOf(t.lk) || {}).label || "";
        var xs = (T.games || []).map(function (g) { var sg = schedGame(g, T, t.lk); return sg && { lk: t.lk, g: sg, ll: lbl }; }).filter(Boolean);
        var picks;
        if (P.intent || P.groups.length > 1) {   // keep the schedule games the words describe: "pats monday", "bruins vs leafs"
          picks = xs.filter(function (x) { return P.test(x, hayW(x)); });
          var lv = picks.filter(function (x) { return x.g.s === "live"; }), up = picks.filter(function (x) { return x.g.s === "up"; }).sort(function (a, b) { return byTime(a.g, b.g); }), fn = picks.filter(function (x) { return x.g.s === "final"; }).sort(function (a, b) { return byTime(b.g, a.g); });
          picks = P.status === "final" ? fn.slice(0, 3) : lv.concat(up.slice(0, 2)).concat(fn.slice(0, P.status === "up" ? 0 : 1));
        } else { var ids = schedPicks(T).map(function (g) { return g.id; }); picks = xs.filter(function (x) { return ids.indexOf(x.g.id) >= 0; }); }
        picks.forEach(function (x) { var k = t.lk + "_" + x.g.id; if (seen[k]) return; seen[k] = 1; SG[k] = x.g; gameCard(x, grid); });
      });
      clearTimeout(ctl.st);   // schedules only after a typing pause, so "b", "bo", "bos"... don't each fetch a team
      if (pend.length && tq.length >= 3) {
        waiting = true;
        ctl.st = setTimeout(function () {
          if (FIND !== ov || inp.value.trim().toLowerCase() !== raw0.toLowerCase()) return;
          Promise.all(pend.map(function (t) { findSched(t, true); return FG[t.lk + "_" + t.id].p; })).then(function () { if (FIND === ov && inp.value.trim().toLowerCase() === raw0.toLowerCase()) fill(); });
        }, 350);
      }
      // leagues the words name (tap for the tab); one that isn't loaded loads behind (its games then appear via _fresh)
      var lgs = leagueHits(tq || raw);   // with only filter words left ("golf", "f1 this weekend"), the words as typed still name leagues
      P.lkf.forEach(function (k) { var l = leagueOf(k); if (l && lgs.indexOf(l) < 0) lgs.push(l); });
      lgs = lgs.slice(0, 4);
      if (lgs.length) {
        res.appendChild(el("h4", "find-sh", lgs.length > 1 ? "Leagues" : "League"));
        var lw = el("div", "find-tms"); lgs.forEach(function (l) { lw.appendChild(leagueRow(l)); }); res.appendChild(lw);
        clearTimeout(ctl.lt);
        var cold = lgs.filter(function (l) { return l.lazy && !S.lgState[l.key]; }).slice(0, 3);
        if (cold.length) { waiting = true; ctl.lt = setTimeout(function () { if (FIND === ov && inp.value.trim().toLowerCase() === raw0.toLowerCase()) cold.forEach(function (l) { loadLeague(l.key); }); }, 350); }
      }
      if (grid.firstChild) {
        res.appendChild(el("h4", "find-sh", "Games")); res.appendChild(grid); shown += grid.children.length;
        if (hits.length > lim) res.appendChild(el("p", "find-h", "+" + (hits.length - lim) + " more \u00b7 add a word to narrow it"));
      } else if (waiting) res.appendChild(el("p", "find-h find-wait", P.intent ? "Looking that up\u2026" : "Looking up their schedule\u2026"));
      else if (P.intent && !tq && !lgs.length) { res.appendChild(el("p", "find-h", "Nothing " + (P.chips[0] && /^On /.test(P.chips[0]) ? "" : "matches ") + P.chips.join(" \u00b7 ") + " right now. Try one of these:")); chips(); ctl.done = true; return; }
      var n = tq ? drawHits(res, tq, ctl, { nt: 8, heads: true, strict: lgs.length > 0 }) : (ctl.done = true, 0);
      shown += n + lgs.length;
      if (shown || waiting || !ctl.done) return;
      // Nothing at all. 1: a typo ("celitcs", "patriats"). 2: loosen the words. 3: one-tap starts.
      depth = depth || 0;
      if (depth < 1 && window.SQ) { var fix = SQ.repair(raw, vocab()); if (fix && fix !== raw) return fill(fix, "Showing results for \u201c" + fix + "\u201d", depth + 1); }
      var ws = raw.split(/\s+/);
      if (depth < 3 && ws.length > 1) { var loose = ws.slice(0, -1).join(" "); return fill(loose, "No exact match for \u201c" + raw0 + "\u201d. Closest: \u201c" + loose + "\u201d", depth + 1); }
      res.appendChild(el("p", "find-h", "Nothing matches \u201c" + raw0 + "\u201d. Try a team, a league, or one of these:"));
      chips();
    }
    inp.oninput = function () { if (FIND === ov) fill(); };
    inp.onkeydown = function (e) {
      // Enter opens the top result on a keyboard; on a phone the Search key just tucks the keyboard away to show the list.
      if (e.key === "Enter") { e.preventDefault(); if (TOUCH) { inp.blur(); return; } if (cur.length) open(cur[0].c, cur[0].x); else { var r = res.querySelector(".find-tm"); if (r) r.onclick(); } }
      if (e.key === "Escape") { e.preventDefault(); closeFind(); }
    };
    fill();
    // Scrolling the results puts the phone keyboard away, so the whole list is in view.
    // Only a finger-driven scroll counts: results shrinking as you type also move scrollTop.
    var sy0 = 0, tch = false;
    ov.addEventListener("touchstart", function () { tch = true; sy0 = ov.scrollTop; }, { passive: true });
    ov.addEventListener("touchend", function () { tch = false; }, { passive: true });
    ov.addEventListener("scroll", function () { if (tch && D0.activeElement === inp && Math.abs(ov.scrollTop - sy0) > 24) inp.blur(); }, { passive: true });
    // With the phone keyboard up, the list can still scroll its last result into view (padding = keyboard height).
    var vv = window.visualViewport;
    if (vv) { ov._kb = function () { ov.style.paddingBottom = Math.max(20, Math.round(innerHeight - vv.height - vv.offsetTop) + 20) + "px"; }; vv.addEventListener("resize", ov._kb); }
    document.body.appendChild(ov); FIND = ov; document.body.classList.add("find-on");
    var place = function () { ov.style.top = Math.max(0, rail.getBoundingClientRect().bottom) + "px"; };
    place(); requestAnimationFrame(function () { place(); ov.classList.add("in"); });
  }
  // The black-hole portal: the chosen card spirals into a vortex, the vortex swallows the screen, the game page emerges from it.
  var NOVT = false;
  function portal(c, x) {
    if (RM) { closeFind(); openGame(x); return; }
    var r = c.getBoundingClientRect(), ov = el("div", "portal"), hole = el("div", "hole"), ghost = c.cloneNode(true);
    ghost.className = "card pghost"; ghost.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;--dx:" + (innerWidth / 2 - (r.left + r.width / 2)) + "px;--dy:" + (innerHeight / 2 - (r.top + r.height / 2)) + "px";
    ov.appendChild(hole); ov.appendChild(ghost); document.body.appendChild(ov);
    c.style.visibility = "hidden"; buzz(12);
    requestAnimationFrame(function () { ov.classList.add("in"); });
    setTimeout(function () {
      closeFind(); NOVT = true; openGame(x);
      var out = $("out"); out.classList.add("emerge"); setTimeout(function () { out.classList.remove("emerge"); }, 700);
      ov.classList.add("out"); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); NOVT = false; }, 600);
    }, 620);
  }
  // Picker for the extra leagues, grouped by sport.
  var MAIN = ["nfl", "nba", "nhl", "mlb"], GRP = { ncaafb: "Football", epl: "Soccer", ucl: "Soccer", afl: "Australian football" };
  function pickLeague(l) {
    S.tab = l.key; S.more = false; S.view = null; S.settings = false; clearHash();
    try { localStorage.setItem("sb-tab", S.tab); } catch (e) {}
    if (l.lazy) loadLeague(l.key);
    render(); window.scrollTo(0, 0);
  }
  // Type-ahead picker for every league that is not one of the main four.
  function morePanel() {
    var box = el("div", "more"), inp = el("input", "msearch"), res = el("div", "mres"), cur = [];
    inp.type = "search"; inp.placeholder = "Search leagues"; inp.autocomplete = "off"; inp.setAttribute("aria-label", "Search leagues");
    function fill() {
      var q = inp.value.trim().toLowerCase(), groups = {}, order = []; cur = []; res.textContent = "";
      LG.forEach(function (l) {
        if (MAIN.indexOf(l.key) >= 0) return;
        var g = l.grp || GRP[l.key] || "Other";
        if (q && (l.label + " " + g + " " + l.key).toLowerCase().indexOf(q) < 0) return;
        if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(l); cur.push(l);
      });
      if (!cur.length) res.appendChild(el("p", "rb", "No leagues match \u201C" + inp.value.trim() + "\u201D."));
      order.forEach(function (g) {
        res.appendChild(el("h4", null, g));
        var row = el("div", "opts");
        groups[g].forEach(function (l) {
          var b = el("button", "tab", l.label); b.type = "button";
          b.setAttribute("aria-selected", S.tab === l.key ? "true" : "false");
          b.onclick = function () { pickLeague(l); };
          row.appendChild(b);
        });
        res.appendChild(row);
      });
    }
    inp.oninput = fill;
    inp.onkeydown = function (e) { if (e.key === "Enter" && cur.length) { e.preventDefault(); pickLeague(cur[0]); } };
    box.appendChild(clearable(inp)); box.appendChild(res); fill();
    if (!TOUCH) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0);   // on a phone the keyboard would cover the list you came to browse
    return box;
  }
  function stampTick() {
    var s = $("stamp"), d = $("dot");
    if (!S.last) { s.textContent = ""; $("refresh").title = S.loading ? "Loading scores" : "No scores yet"; d.className = "dot"; return; }
    [].forEach.call(document.querySelectorAll("[data-cd]"), function (n) {
      var t = countdown(n.getAttribute("data-cd"), !!n.getAttribute("data-long"));
      n.textContent = t ? " · " + t : "";
    });
    var m = Math.max(0, Math.round((Date.now() - S.last) / 60000));
    s.textContent = m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d";
    d.className = "dot " + (m <= 5 ? "fresh" : "stale"); $("refresh").title = "Updated " + (m < 1 ? "just now" : s.textContent + " ago");
    var bad = S.failed.map(function (k) { return leagueOf(k).label; }), nl = 0, fl = false;
    var hot = false;
    allGames().forEach(function (x) { if (x.g.s === "live") { nl++; if (isFollowed(x.g)) fl = true; if (!hot && isClose(x)) hot = true; } });
    if (RAIL) { RAIL.btns[0].classList.toggle("lv", fl); RAIL.btns[3].classList.toggle("lv", hot); }   // red dots: Following while one of your teams plays, Top games while any game is close and late
    document.title = (nl ? "\u25CF " + nl + " live \u00b7 " : "") + C.title;
    $("foot").textContent = (bad.length ? "Couldn\u2019t load " + bad.join(", ") + ". " : "") + "Live games refresh every minute. Pull down for the latest.";
  }

  // ---------- loading ----------
  // full = true loads yesterday through the next few days; otherwise just yesterday and today.
  // Core leagues always load. Extra leagues load when opened, or always if you follow a team there or pinned a game there.
  function wantLeagues() {
    var pinL = PINS.map(function (k) { return k.split("_")[0]; });
    return LG.filter(function (l) { return !l.lazy || EAGER.indexOf(l.key) >= 0 || pinL.indexOf(l.key) >= 0 || S.lgState[l.key] === "done"; }).map(function (l) { return l.key; });
  }
  function loadLeague(key) {
    var st = S.lgState[key];
    if (st === "loading" || st === "done") return;
    S.lgState[key] = "loading";
    var offs = [];
    for (var i = -1; i <= C.daysAhead; i++) offs.push(i);
    var fin = function (ok, r) {
      if (ok) { keepY(key, r.byLeague[key]); S.games[key] = trim(r.byLeague[key]); S.lgState[key] = "done"; saveCache(); emit("data", key); } else S.lgState[key] = "failed";
      if (!S.settings && (!S.view || S.view.person)) renderSoon();
    };
    ESPN.fetchScores(offs, [key]).then(function (r) { fin(r.failed.indexOf(key) < 0, r); }, function () { fin(false); });
    if (!S.view && !S.settings) render();
  }
  // The saved-scores copy is written when the browser is idle, never in the middle of painting a refresh.
  var SCQ = 0;
  function flushCache() { if (!SCQ) return; SCQ = 0; try { localStorage.setItem("sb-cache", JSON.stringify({ at: S.last, g: S.games, yf: S.yf })); } catch (e) {} }
  function saveCache() {
    if (SCQ) return;
    SCQ = window.requestIdleCallback ? requestIdleCallback(flushCache, { timeout: 1500 }) : setTimeout(flushCache, 120);
  }
  window.addEventListener("pagehide", flushCache);
  function activeLeagues() {
    var o = {};
    allGames().forEach(function (x) { if (x.g.s === "live" || (x.g.s === "up" && Math.abs(new Date(x.g.t) - Date.now()) < 35 * 60000)) o[x.lk] = 1; });
    return Object.keys(o);
  }
  function load(full, only) {
    if (S.loading) { var q0 = S.again; S.again = !q0 ? [full, only] : [q0[0] || full, q0[1] && only ? q0[1].concat(only) : null]; return; }
    S.loading = true;
    var spT = !S.ready ? setTimeout(function () { if (!S.ready) splash(0, true); }, 350) : 0;
    var btn = $("refresh"); btn.disabled = true; btn.setAttribute("aria-busy", "true"); stampTick();
    document.body.classList.add("ld");
    var offsets = [];
    for (var i = -1; i <= (full ? C.daysAhead : 0); i++) offsets.push(i);
    if (only && !only.length) only = null;
    var userFull = full && !only;   // a refresh of everything (pull, the button, a long absence), not a single league
    if (!only) only = wantLeagues();
    var cl = leagueOf(S.tab);
    if (cl && cl.lazy && S.lgState[cl.key] === "failed") { S.lgState[cl.key] = ""; loadLeague(cl.key); }
    ESPN.fetchScores(offsets, only).then(function (r) {
      var before = JSON.stringify([S.games, S.yesterday]);
      var prev = {};
      allGames().forEach(function (x) { if (isFollowed(x.g)) prev[x.g.id] = x.g; });
      if (userFull) Object.keys(S.teams).forEach(function (n) { if (S.teams[n].done) S.teams[n].stale = true; });   // refetched as they're shown; nothing blanks
      LG.forEach(function (l) {
        if (only && only.indexOf(l.key) < 0) return;       // quick refresh: leave leagues with nothing live alone
        if (r.failed.indexOf(l.key) >= 0) return;          // keep the last good data for a league that errored
        var byId = {};
        (full ? [] : S.games[l.key]).forEach(function (g) { byId[g.id] = g; });
        r.byLeague[l.key].forEach(function (g) { byId[g.id] = g; });
        var merged = Object.keys(byId).map(function (k) { return byId[k]; });
        keepY(l.key, merged);
        S.games[l.key] = trim(merged);
      });
      S.failed = r.failed;
      S.yesterday = buildYesterday(new Date(r.updated));
      S.last = Date.parse(r.updated) || Date.now();
      var firstLoad = !S.fresh;
      S.fresh = true; S.ready = true;
      PINS = PINS.filter(function (k) {
        var x = allGames().filter(function (q) { return pinKey(q) === k; })[0];
        if (!x && only.indexOf(k.split("_")[0]) < 0) return true;
        return x && !(x.g.s === "final" && Date.now() - new Date(x.g.t) > 12 * 3600000);
      });
      savePins();
      if (!firstLoad && (PREF.alerts || PREF.notify)) allGames().forEach(function (x) {
        var g = x.g, p = prev[g.id];
        if (!p || !isFollowed(g)) return;
        var line = g.a[0] + " " + g.a[2] + ", " + g.h[0] + " " + g.h[2];
        if (g.s === "final" && p.s !== "final") { if (PREF.alerts) toast("Final: " + line); notify("Final: " + line, x.ll); }
        else if (!PREF.alerts) return;
        else if (g.s === "live" && p.s === "up") toast("Game started: " + g.a[0] + " at " + g.h[0]);
        else if (g.s === "live" && (p.h[2] !== g.h[2] || p.a[2] !== g.a[2])) toast("Score: " + line);
      });
      loadLeaders(); emit("data", null);
      var changed = JSON.stringify([S.games, S.yesterday]) !== before;
      if (changed || firstLoad) saveCache();

      if (S.view && S.view.team) { if (full && S.view.team.name) loadTeam(S.view.team.name, S.view.team.lk, S.view.team.id, true); }   // pull to refresh on a team page refreshes the team
      else if (S.view && S.view.person) { if (changed) render(); }
      else if (S.view) {
        var v = S.view, nx = allGames().filter(function (q) { return q.lk === v.x.lk && q.g.id === v.x.g.id; })[0];
        if (nx) {
          var moved = JSON.stringify(nx.g) !== JSON.stringify(v.x.g);
          v.x = nx;
          if (nx.g.s !== "final") loadDetail();
          if (moved) render();
        }
      } else if (changed || firstLoad || S.tab === "teams") {
        if (!S.settings) render();
      }
      if (firstLoad) syncFromHash();
    }).catch(function () {
      $("stamp").textContent = "off"; $("refresh").title = "Could not reach the score server"; $("dot").className = "dot stale";
    }).then(function () {
      S.loading = false; btn.disabled = false; btn.removeAttribute("aria-busy"); stampTick();
      document.body.classList.remove("ld"); clearTimeout(spT); splashOff();
      if (window.ptrDone) window.ptrDone();
      if (S.again) { var ag = S.again; S.again = null; setTimeout(function () { load(ag[0], ag[1]); }, 0); }
    });
  }
  function anyLive() { return allGames().some(function (x) { return x.g.s === "live"; }); }

  // ---------- start ----------
  document.title = C.title;
  (function () {
    var t = $("title"), w = C.title.split(" "), last = w.pop(); t.textContent = "";
    if (w.length) { var a = document.createElement("span"); a.className = "t1"; a.textContent = w.join(" "); t.appendChild(a); }
    var b = document.createElement("span"); b.className = "t2"; b.textContent = last; t.appendChild(b);
    t.setAttribute("aria-label", C.title);
  })();
  // The splash can replay: on the M mark, and whenever the app has nothing to show yet while it loads.
  var SPT = 0;
  function splash(ms, hold) {
    var sp = $("sp"); if (!sp || RM && !hold) return;
    sp.classList.remove("off"); clearTimeout(SPT);
    [].forEach.call(sp.querySelectorAll(".m,.sh,.w,.t"), function (n) { n.style.animation = "none"; void n.offsetWidth; n.style.animation = ""; });
    if (!hold) SPT = setTimeout(splashOff, ms || 1000);
  }
  function splashOff() { var sp = $("sp"); if (sp) sp.classList.add("off"); clearTimeout(SPT); }
  // The logo always lands on Following: it closes search and the long-press menu first, then resets the view.
  $("mark").onclick = function () { buzz(8); if (FIND) closeFind(); lpClose(); splash(1000); S.tab = "pinned"; S.view = null; S.settings = false; S.more = false; clearHash(); try { localStorage.setItem("sb-tab", "pinned"); } catch (e) {} render(); window.scrollTo(0, 0); };
  // Tapping the title goes home (Following tab).
  (function () {
    var ti = $("title"), home = function () {
      S.tab = "pinned"; S.view = null; S.settings = false; clearHash();
      try { localStorage.setItem("sb-tab", "pinned"); } catch (e) {}
      render(); window.scrollTo(0, 0);
    };
    ti.style.cursor = "pointer"; ti.tabIndex = 0; ti.setAttribute("role", "link");
    ti.onclick = home;
    ti.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); home(); } };
  })();
  $("refresh").onclick = function () { load(true); };
  // A hash change the app didn't just make is a gesture or the browser's Back: no cross-fade. Leaving a page that way
  // also keeps S.depth in step, so a later Back can't step out of the app.
  window.addEventListener("hashchange", function () {
    GEST = Date.now() - NAV > 1200; NAV = 0;
    if (!/^#(game|team|who)\//.test(location.hash)) S.depth = 0; else if (GEST && S.depth > 0) S.depth--;
    try { syncFromHash(); } finally { GEST = false; }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && LPM) { lpClose(); return; }
    if (e.key === "Escape" && TIPB && TIPB.classList.contains("in")) { tipHide(); return; }
    if (e.key === "Escape" && FIND) { closeFind(); return; }
    if (e.key === "Escape" && S.more) { S.more = false; render(); return; }
    if ((e.key === "Escape" || e.key === "ArrowLeft") && S.view && !e.metaKey && !e.altKey) { closeGame(); return; }
    var t = e.target, tg = t && t.tagName; if (e.metaKey || e.ctrlKey || e.altKey || tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT" || (t && t.isContentEditable) || document.body.classList.contains("pm-open")) return;
    if (e.key === "r" && !S.loading) load(true); else if (e.key === "p") openProf(); else if (e.key === "t") window.scrollTo({ top: 0, behavior: "smooth" });
    else if (e.key === "1") goTab("pinned"); else if (e.key === "2") goTab("yesterday"); else if (e.key === "3") goTab("teams"); else if (e.key === "4") goTab("top");
    else if (e.key === "/") { e.preventDefault(); if (!S.more) { S.more = true; S.view = null; S.settings = false; clearHash(); render(); } }
    else if (e.key === "f") { e.preventDefault(); if (S.view) closeGame(); if (S.settings) { S.settings = false; render(); } var n = 0; (function tf() { if (FINDQ && FINDQ.offsetParent) FINDQ.focus(); else if (n++ < 30) setTimeout(tf, 50); })(); }
  });
  // Swipe in from the left edge of a game page to go back, where the system has no back swipe of its own. iOS does
  // (Safari and home-screen apps alike), and running both stacked two Backs: the second one landed on an old entry.
  (function () {
    if (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Mac/.test(navigator.platform) && navigator.maxTouchPoints > 1)) return;
    var x0 = null, y0 = 0, h0 = "";
    window.addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = S.view && !FIND && t.clientX < 28 ? t.clientX : null; y0 = t.clientY; h0 = location.hash; }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (x0 == null) return; var t = e.changedTouches[0], go = t.clientX - x0 > 70 && Math.abs(t.clientY - y0) < 50; x0 = null;
      // iOS's own back swipe may already have gone back during this same touch: then there's nothing left to do
      if (go && S.view && location.hash === h0) closeGame(true);
    }, { passive: true });
  })();
  // Swipe right on the search screen to close it. The results follow the finger and fade; let go past about a quarter
  // of the screen (or flick) and it slides away, otherwise it springs back. Works from anywhere on the results (they
  // never scroll sideways); a mostly vertical move is left to scrolling.
  (function () {
    var sx = null, sy = 0, st = 0, dx = 0, on = false, past = false;
    var reset = function (f) { if (f) { f.classList.remove("drag"); f.style.transform = ""; f.style.opacity = ""; } sx = null; on = false; };
    window.addEventListener("touchstart", function (e) {
      sx = null; if (!FIND || e.touches.length > 1 || (e.target && e.target.tagName === "INPUT")) return;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); dx = 0; on = false; past = false;
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (sx == null || !FIND) return;
      var t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
      if (!on) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { sx = null; return; }   // a scroll, not a swipe
        if (mx > 12 && mx > Math.abs(my) * 1.5) { on = true; FIND.classList.add("drag"); try { FINDQ.blur(); } catch (er) {} } else return;
      }
      dx = Math.max(0, mx - 12);
      FIND.style.transform = "translateX(" + dx + "px)"; FIND.style.opacity = String(Math.max(0.3, 1 - dx / innerWidth));
      var p = dx > Math.min(110, innerWidth * 0.28); if (p !== past) { past = p; if (p) buzz(8); }
    }, { passive: true });
    var end = function () {
      if (sx == null) return; var f = FIND;
      if (!on || !f) { sx = null; return; }
      var flick = dx > 40 && dx / Math.max(1, Date.now() - st) > 0.6;
      if (past || flick) { f.classList.remove("drag"); f.style.transform = "translateX(100%)"; f.style.opacity = "0"; sx = null; on = false; closeFind(); }
      else reset(f);
    };
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", function () { reset(FIND); }, { passive: true });
  })();
  // Collapsible sections open and close with a short height tween instead of snapping (native toggle under reduced motion).
  (function () {
    var out = $("out"), E = "cubic-bezier(.2,.7,.2,1)";
    out.addEventListener("click", function (e) {
      var sm = e.target.closest && e.target.closest("summary"); if (!sm || RM) return;
      var d = sm.parentNode, body = sm.nextElementSibling; if (!d || d.tagName !== "DETAILS" || !body || d._an) return;
      if (e.target !== sm && e.target.closest("button,a,input")) return;
      e.preventDefault();
      var done = function () { body.style.overflow = ""; d._an = 0; };
      if (d.open) {
        var h0 = body.offsetHeight; d._an = 1; body.style.overflow = "hidden";
        var a = body.animate([{ height: h0 + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 190, easing: E });
        a.onfinish = a.oncancel = function () { d.open = false; done(); };
      } else {
        d.open = true; var h1 = body.offsetHeight; if (!h1) return; d._an = 1; body.style.overflow = "hidden";
        var b = body.animate([{ height: "0px", opacity: 0 }, { height: h1 + "px", opacity: 1 }], { duration: 230, easing: E });
        b.onfinish = b.oncancel = done;
      }
    });
  })();
  // Rail hides while scrolling down (more room for scores), returns on scroll up.
  (function () {
    var ly = 0, tk = false, rl = $("rail");
    window.addEventListener("scroll", function () {
      if (tk) return; tk = true;
      requestAnimationFrame(function () {
        tk = false;
        var y = window.pageYOffset, d = y - ly;
        if (Math.abs(d) < 8) return;
        rl.classList.toggle("hide", d > 0 && y > 160);
        ly = y;
      });
    }, { passive: true });
  })();
  window.addEventListener("offline", function () { toast("You're offline — showing saved scores"); });
  window.addEventListener("online", function () { toast("Back online"); if (!S.loading) load(false); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && Date.now() - S.last > 60000) load(Date.now() - S.last > 600000);
  });
  // Background refresh only when something is happening: every 30s while a followed game is live, every minute for
  // other live games or a followed game about to start, and then only for the leagues involved. Idle = no requests.
  function notify(title, body) {
    if (!PREF.notify || !("Notification" in window) || Notification.permission !== "granted") return;
    var o = { body: body, icon: (document.querySelector("link[rel~=apple-touch-icon]") || {}).href, tag: "sb-" + title, silent: false };
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification(title, o); }, function () { new Notification(title, o); });
      else new Notification(title, o);
    } catch (e) {}
  }
  var FOLLIVE = false;
  function pollGap() {
    var now = Date.now(), fol = false, live = false, soon = false;
    allGames().forEach(function (x) {
      var g = x.g;
      if (g.s === "live") { live = true; if (isFollowed(g)) fol = true; }
      else if (g.s === "up" && isFollowed(g)) { var d = new Date(g.t) - now; if (d < 5 * 60000 && d > -30 * 60000) soon = true; }
    });
    FOLLIVE = fol || soon;
    if (S.view && S.view.x && S.view.x.g.s === "live" && !document.hidden) return 20000;   // watching a game: keep it moving
    return fol ? 30000 : live ? C.liveRefreshSeconds * 1000 : soon ? 60000 : 0;
  }
  setInterval(function () {
    if (S.loading) return;
    if (document.hidden && !(PREF.notify && FOLLIVE)) return;   // in the background, keep polling only to deliver a final-score notification
    var gap = pollGap();
    if (gap && Date.now() - S.last >= gap - 1000) load(false, activeLeagues());
  }, 10000);
  setInterval(stampTick, 30000);
  window.SB_SET = function () { S.settings = true; S.view = null; clearHash(); render(); window.scrollTo(0, 0); };
  // Public surface for add-ons and future features (read-only state, hooks, and a few actions). See README.md.
  window.SB = { v: FV.replace(/^v=/, ""), on: on, state: S, config: C, render: renderSoon, open: openGame, tab: goTab, toast: toast, allGames: allGames, isFollowed: isFollowed, el: el, clearable: clearable };
  // Pull down at the top of the page to refresh (home-screen apps have no browser refresh).
  (function () {
    var ptr = $("ptr"), ring = ptr.querySelector(".ring"), lbl = ptr.querySelector(".pl"), y0 = null, pull = 0, armed = false, TH = 80;
    function show(y, text, cls) { ptr.style.opacity = "1"; ptr.style.transform = "translate(-50%," + y + "px)"; lbl.textContent = text; ptr.className = cls || ""; }
    function hide() { ptr.style.opacity = "0"; ptr.style.transform = "translate(-50%,-30px)"; ptr.className = ""; }
    // Called when a refresh finishes: flash "Updated" if the refresh came from a pull.
    window.ptrDone = function () {
      if (!ptr.classList.contains("busy")) return;
      show(14, "Updated", "ok"); setTimeout(hide, 900);
    };
    window.addEventListener("touchstart", function (e) { y0 = window.scrollY <= 0 && !S.loading && !FIND && !ONB ? e.touches[0].clientY : null; pull = 0; armed = false; }, { passive: true });   // not under the search or team-picker sheets
    window.addEventListener("touchmove", function (e) {
      if (y0 == null) return;
      pull = Math.max(0, e.touches[0].clientY - y0);
      if (pull < 8) { hide(); return; }
      var ready = pull >= TH;
      show(Math.min(pull * 0.5, 56), ready ? "Release to refresh" : "Pull to refresh", ready ? "armed" : "");
      ring.style.transform = "rotate(" + pull * 3 + "deg)";
      if (ready && !armed) { try { if (navigator.vibrate) navigator.vibrate(12); } catch (e2) {} }
      armed = ready;
    }, { passive: true });
    window.addEventListener("touchend", function () {
      if (y0 != null && pull >= TH) { show(30, "Refreshing…", "busy"); ring.style.transform = ""; load(true); }
      else hide();
      y0 = null; armed = false;
    });
  })();

  // A shared link (?add=...) offers to add someone else's teams and people.
  (function () {
    var m = /[?&]add=([\w\-+/]+)/.exec(location.search); if (!m) return;
    var d = null; try { d = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) {}
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    if (!d || (!Array.isArray(d.t) && !Array.isArray(d.p))) return;
    var nt = (d.t || []).filter(function (n) { return typeof n === "string" && n.length < 60 && C.followed.indexOf(n) < 0; }).slice(0, 30);
    var np = (d.p || []).filter(function (n) { return typeof n === "string" && n.length < 60 && !fpHas(n); }).slice(0, 30);
    if (!nt.length && !np.length) { toast("You already follow everything in that link"); return; }
    var bar = el("div", "addbar"), tx = el("span", null, "Add " + [nt.length ? nt.length + " team" + (nt.length > 1 ? "s" : "") : "", np.length ? np.length + " " + (np.length > 1 ? "people" : "person") : ""].filter(Boolean).join(" and ") + " from this link?");
    var ok = el("button", "ok", "Add"), no = el("button", null, "No");
    ok.onclick = function () { bar.remove(); if (nt.length) setFollowed(C.followed.concat(nt)); if (np.length) setFp(C.fp.concat(np)); toast("Added"); };
    no.onclick = function () { bar.remove(); };
    bar.appendChild(tx); bar.appendChild(ok); bar.appendChild(no); document.body.appendChild(bar);
  })();
  // ---------- first open: pick your teams ----------
  // Once ever, for a brand-new visitor (FIRST: nothing saved yet), after the splash: a sheet with a type-ahead over every
  // team ESPN has (the same search as Find). Rows toggle; Done makes the picks the followed list (replacing the
  // built-in defaults) with one reload; Skip keeps the defaults. The account prompt waits a full minute after it closes.
  var ONB = null, ONB_END = 0;
  function pickTeams() {
    if (ONB) return;
    try { localStorage.setItem("sb-onb", "1"); } catch (e) {}
    var ov = el("div", "onb"), b = el("div", "onb-b"), picked = [], ctl = {};
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Pick your teams");
    b.appendChild(el("h2", "onb-t", "Who do you root for?"));
    b.appendChild(el("p", "onb-s", "Pick your teams. Their games go to the top, and Following shows just them. Change it anytime in My teams."));
    var inp = el("input", "onb-q"), chips = el("div", "onb-c"), res = el("div", "onb-r");
    inp.type = "search"; inp.placeholder = "Search any team, any sport"; inp.autocomplete = "off"; inp.enterKeyHint = "search"; inp.setAttribute("aria-label", "Search teams");
    b.appendChild(clearable(inp)); b.appendChild(chips); b.appendChild(res);
    var row = el("div", "onb-f"), skip = el("button", "pm-b", "Skip"), done = el("button", "pm-b pri", "Done");
    skip.type = done.type = "button"; row.appendChild(skip); row.appendChild(done); b.appendChild(row);
    ov.appendChild(b);
    var key = function (t) { return t.lk + "_" + t.id + "_" + t.name; };
    var has = function (t) { return picked.some(function (p) { return key(p) === key(t); }); };
    // A pick updates its row and the chips in place (no list rebuild, so nothing re-animates under your finger).
    function toggle(t) {
      buzz(5); if (has(t)) picked = picked.filter(function (p) { return key(p) !== key(t); }); else picked.push(t);
      var on = has(t);
      [].forEach.call(res.querySelectorAll(".onb-row"), function (r) { if (r._k === key(t)) { r.classList.toggle("on", on); r.setAttribute("aria-pressed", on ? "true" : "false"); r.lastChild.textContent = on ? "\u2713" : "+"; } });
      drawChips();
    }
    function teamPick(t) {
      var on = has(t), r = el("button", "onb-row" + (on ? " on" : "")), lb = el("span", "ab" + (t.lg && PREF.logos ? " lg" : "")), ab = t.ab || t.name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 3).toUpperCase();
      r.type = "button"; r.setAttribute("aria-pressed", on ? "true" : "false");
      if (t.lg && PREF.logos) lb.appendChild(logoImg(t.lg, ab)); else lb.textContent = ab;
      var w = el("span", "find-tw"); w.appendChild(el("b", null, t.name)); w.appendChild(el("small", null, t.ll || ""));
      r.appendChild(lb); r.appendChild(w); r.appendChild(el("span", "onb-ck", on ? "\u2713" : "+"));
      r.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // keep the keyboard up while picking
      r._k = key(t); r.onclick = function () { toggle(t); };
      return r;
    }
    function drawChips() {
      chips.textContent = "";
      picked.forEach(function (t) { var dup = picked.filter(function (p) { return p.name === t.name; }).length > 1, c = el("button", "fchip on", t.name + (dup ? " \u00b7 " + t.ll : "") + " \u00d7"); c.type = "button"; c.addEventListener("pointerdown", function (e) { e.preventDefault(); }); c.onclick = function () { toggle(t); }; chips.appendChild(c); });
      done.textContent = picked.length ? "Done \u00b7 " + picked.length : "Done";
      var h = res.querySelector(".onb-h"); if (h) h.textContent = picked.length ? "Add more, or tap Done." : "Try \u201cYankees\u201d, \u201cArsenal\u201d or \u201cDuke basketball\u201d.";
    }
    function draw() {
      drawChips();
      var q = inp.value.trim().toLowerCase(); res.textContent = "";
      if (!q) { res.appendChild(el("p", "find-h onb-h", picked.length ? "Add more, or tap Done." : "Try \u201cYankees\u201d, \u201cArsenal\u201d or \u201cDuke basketball\u201d.")); return; }
      var st = searchState(q), teams = mergeTeams(st.q, st.r).filter(function (t) { return st.sq.ok(pathOfTeam(t)); }).slice(0, 8);
      teams.forEach(function (t) { res.appendChild(teamPick(t)); });
      ctl.done = !st.need;
      if (st.need) {
        var nq = st.need; if (!teams.length) res.appendChild(el("p", "find-h find-wait", "Searching every sport\u2026"));
        clearTimeout(ctl.t); ctl.q = nq;
        ctl.t = setTimeout(function () { ESPN.search(nq).then(function () { if (ctl.q === nq && ONB === ov) draw(); }, function () {}); }, 220);
      } else if (!teams.length) res.appendChild(el("p", "find-h", "No teams match \u201c" + inp.value.trim() + "\u201d."));
    }
    function close() { ONB = null; ONB_END = Date.now(); ov.classList.remove("in"); document.body.classList.remove("onb-on"); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 240); }
    skip.onclick = close;
    done.onclick = function () {
      if (picked.length) { picked.forEach(regTeam); setFollowed(picked.map(function (t) { return t.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; })); toast("Following " + picked.length + " team" + (picked.length > 1 ? "s" : "")); }
      close();
    };
    inp.oninput = draw;
    inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") close(); };
    teamIndex().then(function () { if (ONB === ov) draw(); });
    draw(); D0.body.appendChild(ov); ONB = ov; document.body.classList.add("onb-on");
    requestAnimationFrame(function () { ov.classList.add("in"); });
  }
  if (FIRST && !location.hash) (function wait() {   // after the splash and the first scores, never over a shared link
    var sp = $("sp");
    if (!S.ready || (sp && !sp.classList.contains("off"))) { setTimeout(wait, 300); return; }
    setTimeout(pickTeams, 500);
  })();
  // After about a minute of use with no account, offer one, once ever (sb-acct-ask). Scores never need an account;
  // it only saves the Collection Log and joins the leaderboard, and the card says exactly that.
  (function () {
    var has = function (k) { try { return !!localStorage.getItem(k); } catch (e) { return true; } };
    if (has("sb-active") || has("sb-acct-ask")) return;
    var tryShow = function () {
      if (has("sb-active") || has("sb-acct-ask")) return;
      if (ONB || (ONB_END && Date.now() - ONB_END < 60000)) { setTimeout(tryShow, ONB ? 15000 : 60000 - (Date.now() - ONB_END)); return; }   // never on top of, or right after, the team picker
      if (document.hidden || FIND || LPM || D0.body.classList.contains("pm-open") || D0.querySelector(".addbar")) { setTimeout(tryShow, 30000); return; }   // not mid-something; try again later
      try { localStorage.setItem("sb-acct-ask", "1"); } catch (e) {}
      var bar = el("div", "addbar acct"), tx = el("div", "acct-t");
      tx.appendChild(el("b", null, "Want to keep your cards?"));
      tx.appendChild(el("span", null, "An account saves your Collection Log and puts you on the leaderboard. That\u2019s all it\u2019s for \u2014 scores work without one."));
      var row = el("div", "acct-b"), ok = el("button", "ok", "Make an account"), no = el("button", null, "No thanks");
      ok.type = no.type = "button";
      ok.onclick = function () { bar.remove(); openProf(); };
      no.onclick = function () { bar.remove(); };
      row.appendChild(ok); row.appendChild(no); bar.appendChild(tx); bar.appendChild(row); D0.body.appendChild(bar);
    };
    setTimeout(tryShow, 60000);
  })();
  // Show the last saved scores instantly (marked with how old they are) while fresh ones load.
  try {
    var cc = JSON.parse(localStorage.getItem("sb-cache") || "null");
    if (cc && cc.g && Date.now() - cc.at < 3 * 86400000) {
      var wl = wantLeagues();
      LG.forEach(function (l) { if (cc.g[l.key] && wl.indexOf(l.key) >= 0) S.games[l.key] = cc.g[l.key]; });
      if (cc.yf) S.yf = cc.yf;
      S.last = cc.at; S.ready = true; S.yesterday = buildYesterday(new Date());
    }
  } catch (e) {}
  render(); stampTick();
  if (S.ready) { syncFromHash(); loadLeaders(); }
  load(true);
  var l0 = leagueOf(S.tab); if (l0 && l0.lazy) loadLeague(S.tab);
  // Offline-ready app shell and cached logos (sw.js). Failure is harmless.
  // The fun layer (random celebrations, easter eggs) loads after everything else, when the browser is idle.
  var funQ = [], funLoading = false;
  function addScript(src, cb) { var s = document.createElement("script"); s.src = src + "?" + FV; s.async = true; s.onload = cb; document.head.appendChild(s); }
  function ensureFun(cb) {
    if (window.FUN) { cb(); return; }
    funQ.push(cb); if (funLoading) return; funLoading = true;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "fun.css?" + FV; document.head.appendChild(l);
    addScript("fun.js", function () {
      if (S.gvq && window.FUN) { var fc = FUN.col(); fc.gv = (fc.gv || 0) + S.gvq; S.gvq = 0; FUN.saveCol(); }
      var q = funQ; funQ = []; q.forEach(function (f) { f(); });
    });
  }
  function openProf(v) {
    ensureFun(function () {
      if (window.PROF) { PROF.open(v); return; }
      addScript("profile.js", function () { PROF.open(v); });
    });
  }
  try { if (localStorage.getItem("sb-active") && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  // The search language (search.js, ~10KB) loads on an idle moment after start, so the first search is instant.
  setTimeout(function () { (window.requestIdleCallback || setTimeout)(function () { ensureSQ(); }, { timeout: 4000 }); }, 2500);
  window.SB_LOAD = function (cb) { ensureFun(function () { if (window.PROF) cb(); else addScript("profile.js", cb); }); };
  $("prof").onclick = function () { openProf(); };
  try { // header button shows the signed-in profile's initial
    var pa = localStorage.getItem("sb-active"), pp = pa && JSON.parse(localStorage.getItem("sb-profiles") || "{}")[pa];
    if (pp) { $("prof").textContent = pp.n.charAt(0).toUpperCase(); $("prof").className = "on"; $("who").textContent = pp.n; $("who").hidden = false; $("who").className = localStorage.getItem("sb-lb") ? "on" : ""; }
    $("who").onclick = function () { openProf(); };
  } catch (e) {}
  window.addEventListener("load", function () {
    var go = function () { ensureFun(function () {}); try { if (localStorage.getItem("sb-lb") && localStorage.getItem("sb-active")) setTimeout(function () { SB_LOAD(function () { PROF.pull(); }); }, 3000); } catch (e) {} };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2000);
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { try { navigator.serviceWorker.register("sw.js?" + FV).catch(function () {}); } catch (e) {} });
    // The app shell opens from the saved copy for speed; when the worker finds a newer build behind it, offer the reload.
    try { navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.type === "update") toast("New version ready · tap to reload", 20000, function () { location.reload(); }); }); } catch (e) {}
  }
})();
