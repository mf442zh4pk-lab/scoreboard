// UI: state, rendering and routing. No ESPN-specific knowledge lives here (see espn.js).
(function () {
  "use strict";
  var C = window.CONFIG, LG = C.leagues, DAY = ESPN.DAY;
  var D0 = document, $ = function (id) { return document.getElementById(id); };

  var S = { tab: "pinned", games: {}, yesterday: null, ready: false, loading: false, last: 0, failed: [], view: null, pushed: false, settings: false, teams: {}, leaders: {}, lgState: {}, more: false, yf: {}, ysub: "teams", ymore: {} };
  var openState = {};   // remembers which detail sections you opened or closed
  var PINS = [], TC = {}, EAGER = [], RK = "", RT = 0;
  try { EAGER = JSON.parse(localStorage.getItem("sb-eager") || "[]") || []; } catch (e) {}
  function addEager(k) { if (EAGER.indexOf(k) < 0) { EAGER.push(k); try { localStorage.setItem("sb-eager", JSON.stringify(EAGER)); } catch (e) {} } }
  try { PINS = JSON.parse(localStorage.getItem("sb-pins") || "[]") || []; } catch (e) {}
  try { TC = JSON.parse(localStorage.getItem("sb-tcache") || "{}") || {}; } catch (e) {}
  function savePins() { try { localStorage.setItem("sb-pins", JSON.stringify(PINS)); } catch (e) {} }
  function pinKey(x) { return x.lk + "_" + x.g.id; }
  function isPinned(x) { return PINS.indexOf(pinKey(x)) >= 0; }
  LG.forEach(function (l) { S.games[l.key] = []; });
  var DEFAULT_FOLLOWED = C.followed.slice();
  try { var saved = localStorage.getItem("sb-tab"); if (saved) S.tab = saved; } catch (e) {}
  try { var sy = localStorage.getItem("sb-ysub"); if (sy === "recap" || sy === "teams" || sy === "news") S.ysub = sy; } catch (e) {}
  try { var sf = JSON.parse(localStorage.getItem("sb-followed") || "null"); if (sf && sf.length) C.followed = sf; } catch (e) {}
  function applyTheme() {
    var t = "auto";
    try { t = localStorage.getItem("sb-theme") || "auto"; } catch (e) {}
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  }
  applyTheme();
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.className = "show"; t.onclick = null;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = ""; }, 6000);
  }

  // ---------- helpers ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  // Team name with its top-25 ranking in front ("#5 Georgia Bulldogs"), for text lines; rankedName() does the same for card rows.
  function tn(t) { return (t[6] ? "#" + t[6] + " " : "") + t[0]; }
  function rankedName(t) {
    var s = el("span", "nm");
    if (t[6]) s.appendChild(el("span", "rk", String(t[6])));
    s.appendChild(document.createTextNode(t[0])); return s;
  }
  function isFollowed(g) { return C.followed.indexOf(g.h[0]) >= 0 || C.followed.indexOf(g.a[0]) >= 0; }
  function leagueOf(lk) { return LG.filter(function (l) { return l.key === lk; })[0]; }
  function allGames() {
    var out = [];
    LG.forEach(function (l) { S.games[l.key].forEach(function (g) { out.push({ g: g, lk: l.key, ll: l.label }); }); });
    return out;
  }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (ESPN.dayKey(d) === ESPN.dayKey(new Date())) return "Today " + t;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + " · " + t;
  }
  function byTime(a, b) { return Date.parse(a.t) - Date.parse(b.t); }
  // "in 3h 12m" for a start time; long=true also counts days. Empty when out of range.
  function countdown(iso, long) {
    var ms = new Date(iso) - Date.now();
    if (isNaN(ms)) return "";
    if (ms <= 0) return "starting";
    var d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
    if (d) return long ? "in " + d + "d " + h + "h" : "";
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
      if (lg && lg.kind === "race") return now - new Date(g.t) < 3 * DAY;
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
        body: (res === "W" ? "Won " : res === "L" ? "Lost " : "Tied ") + Math.max(mine[2], opp[2]) + "-" + Math.min(mine[2], opp[2]) +
          (home ? " at home against " : " on the road at ") + opp[0] + "." + nextUp(all, name),
      };
    });
    return { date: label, teams: teams };
  }

  // ---------- list view ----------
  // Team badge: the logo when we have one (lazy, fixed size so nothing jumps), else the abbreviation.
  function logoImg(u, ab) {
    var i = new Image(); i.src = u; i.alt = ""; i.width = 28; i.height = 28; i.loading = "lazy"; i.decoding = "async";
    i.onerror = function () { var p = i.parentNode; if (p) { p.className = "ab"; p.textContent = ab || ""; } };
    return i;
  }
  function badge(t) {
    if (!t[5]) return el("span", "ab", t[1]);
    var b = el("span", "ab lg"); b.appendChild(logoImg(t[5], t[1])); return b;
  }
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
  // Card for an event sport (UFC card, race weekend): title, the main fight or the podium, and a short note.
  function evCard(x) {
    var g = x.g, c = el("div", "card"), top = el("div", "top"), P = g.x || {};
    top.appendChild(el("span", "pill " + g.s, g.s === "live" ? "Live · " + (g.c || "") : g.s === "final" ? "Final" : when(g.t)));
    top.appendChild(el("span", "tag", x.ll));
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
    } else {
      var ses = P.sess || [], race = ses.filter(function (s) { return /^race$/i.test(s.n); })[0] || ses[ses.length - 1];
      if (g.s !== "up" && race && race.rows.length) race.rows.slice(0, 3).forEach(function (r) { c.appendChild(row(r[1], "", String(r[0]), false)); });
      else {
        var nx = ses.filter(function (s) { return s.s === "pre"; })[0];
        c.appendChild(el("div", "evs", (nx ? "Next: " + sessName(nx.n) + " · " + when(nx.t) : "") + (P.venue ? (nx ? " · " : "") + P.venue : "")));
      }
    }
    return c;
  }
  var SESS = { FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3", SS: "Sprint qualifying", SR: "Sprint race", Qual: "Qualifying", Race: "Race" };
  function sessName(n) { return SESS[n] || n; }
  function card(x) {
    if (x.g.ev) return evCard(x);
    var g = x.g, c = el("div", "card" + (isFollowed(g) ? " followed" : "") + (isFollowed(g) ? strCls(streakOf(C.followed.indexOf(g.h[0]) >= 0 ? g.h[0] : g.a[0])) : ""));
    var top = el("div", "top");
    var ptxt = g.s === "live" ? "Live · " + (g.c || "") : g.s === "final" ? "Final" : when(g.t) + (g.b ? " · " + g.b : ""), pcls = "";
    if (g.s === "final" && g.h[2] != null && g.a[2] != null) {
      var fh = C.followed.indexOf(g.h[0]) >= 0, fa = C.followed.indexOf(g.a[0]) >= 0;
      if (fh !== fa) {
        var me = fh ? g.h : g.a, op = fh ? g.a : g.h, wl = me[2] > op[2] ? "W" : me[2] < op[2] ? "L" : "T";
        ptxt = "Final · " + wl; pcls = wl === "W" ? " w" : wl === "L" ? " l" : "";
      }
    }
    var pill = el("span", "pill " + g.s + pcls, ptxt);
    if (g.s === "up") {
      var cdv = countdown(g.t);
      if (cdv) { var cs = el("span", "cd", " · " + cdv); cs.setAttribute("data-cd", g.t); pill.appendChild(cs); }
      if (x.lk === "afl") { try { pill.appendChild(el("span", "cd", " (" + new Date(g.t).toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit" }) + " Brisbane)")); } catch (e) {} }
    }
    top.appendChild(pill);
    top.appendChild(isFollowed(g) ? el("span", "tag fol", "Following · " + x.ll) : el("span", "tag", x.ll + (g.n ? " · " + g.n : "")));
    c.appendChild(top);
    var hs = g.h[2], as = g.a[2], has = g.s !== "up" && hs != null && as != null;
    [[g.a, as, hs], [g.h, hs, as]].forEach(function (r) {
      var row = el("div", "row" + (has && r[1] < r[2] && g.s === "final" ? " lose" : ""));
      var tm = el("div", "tm");
      tm.appendChild(badge(r[0]));
      var nmw = el("span", "nmw"); nmw.appendChild(rankedName(r[0]));
      if (r[0][3]) nmw.appendChild(el("span", "rec", r[0][3]));
      tm.appendChild(nmw);
      row.appendChild(tm);
      if (has) row.appendChild(el("span", "sc", String(r[1])));
      c.appendChild(row);
    });
    return c;
  }
  var UCOL = {};
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
          sb.appendChild(el("span", "lgh-t", l.label)); sb.appendChild(el("span", "lgh-n", String(its.length))); sb.appendChild(el("span", "lgh-c", "\u25BE"));
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
  function gridOf(items, cls, big) {
    var gr = el("div", "grid" + (big ? " big" : ""));
    items.forEach(function (x) {
      var c = card(x);
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
  // Start fetching a game's box score as soon as a finger or mouse settles on its card, so the tap opens instantly.
  function prefetchOn(c, x) {
    var t = 0;
    if (x.g.ev) return;
    var go = function () { ESPN.fetchGame(x.lk, x.g.id).catch(function () {}); };
    var arm = function () { clearTimeout(t); t = setTimeout(go, 60); }, stop = function () { clearTimeout(t); };
    c.addEventListener("mouseenter", arm); c.addEventListener("mouseleave", stop);
    c.addEventListener("touchstart", arm, { passive: true });
    c.addEventListener("touchmove", stop, { passive: true }); c.addEventListener("touchend", stop);
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
    [["teams", "My teams"], ["recap", "Daily recap"], ["news", "News"]].forEach(function (p) {
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
    if (S.ysub === "recap") { renderRecap(out); return; }
    if (S.ysub === "news") { renderNews(out); return; }
    var y = S.yesterday;
    if (!y) { out.appendChild(notice("No recap yet", "Pull down to load yesterday's results.")); return; }
    out.appendChild(el("p", "lg", y.date));
    var played = y.teams.filter(function (t) { return t.played; });
    if (!played.length) { out.appendChild(notice("No games yesterday", "None of your teams played yesterday.")); out.appendChild(overview(y, played)); return; }
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
      a.appendChild(el("div", "rl", "Box score and recap ›"));
      gr.appendChild(a);
    });
    out.appendChild(gr);
    out.appendChild(overview(y, played));
  }

  // ---------- Daily recap: yesterday's biggest stories first, then every result by league ----------
  var HEAT = { nfl: 100, nba: 90, ncaafb: 80, mlb: 70, ucl: 70, epl: 65, nhl: 65, ncaamb: 55, wnba: 50, afl: 40, mls: 35, ufl: 30 };
  var TIGHT = { nfl: 3, ncaafb: 3, nba: 3, wnba: 3, ncaamb: 3, ncaawb: 3, ufl: 3, afl: 6, mlb: 1, nhl: 1, ncaah: 1, ncaawh: 1, ncaabsb: 1, ncaasb: 1 };
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
        if (l.kind === "race" ? Date.now() - new Date(g.t) > 3 * DAY : ESPN.dayKey(new Date(g.t)) !== yk) return;
        var x = { g: g, lk: l.key, ll: l.label, lg: l };
        if (g.ev) { x.heat = l.kind === "mma" ? 75 : 80; out.push(x); return; }
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
  // "Kansas City Chiefs edge Buffalo Bills 27-24 in overtime"
  function headline(x) {
    var g = x.g, lg = x.lg;
    if (g.ev) {
      var P = g.x || {};
      if (g.ev === "mma") { var f = (P.fights || [])[0]; return f && f.win >= 0 ? f.n[f.win] + " wins the main event" + (f.m ? " by " + f.m : "") : g.h[0]; }
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
  function trunc(s, n) { if (s.length <= n) return s; var t = s.slice(0, n), i = t.lastIndexOf(" "); return t.slice(0, i > n * 0.6 ? i : n) + "…"; }
  function openX(c, x) {
    c.classList.add("click"); c.tabIndex = 0; c.setAttribute("role", "button");
    c.onclick = function () { openGame(x); };
    c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGame(x); } };
    prefetchOn(c, x);
  }
  // ESPN's AP recap for a finished game: a short lede that expands to the first few paragraphs. Fills in when it arrives (cached), nothing if ESPN has none.
  function narrBlock(x, onHead, max) {
    if (x.g.ev) return null;
    var box = el("div", "narr"); box.hidden = true;
    ESPN.fetchNarrative(x.lk, x.g.id, true).then(function (n) {
      if (!n || !n.paras || !n.paras.length) return;
      if (onHead) onHead(n);
      var p0 = n.paras[0].replace(/^[A-Z][A-Z.,'\u2019 ]{2,40}\s*(?:--|\u2014|\u2013)+\s*(?:\(AP\)\s*)?(?:--|\u2014|\u2013)*\s*/, "");
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
    top.appendChild(isFollowed(g) ? el("span", "tag fol", "Following · " + x.ll) : el("span", "tag", x.ll + (g.n ? " · " + g.n : "")));
    c.appendChild(top);
    var h = el("h3", "st-h", headline(x)); c.appendChild(h);
    if (!g.ev) {
      var hs = g.h[2], as = g.a[2];
      [[g.a, as, hs], [g.h, hs, as]].forEach(function (r) {
        var row = el("div", "row" + (r[1] < r[2] ? " lose" : "")), tm = el("div", "tm");
        tm.appendChild(badge(r[0]));
        var nmw = el("span", "nmw"); nmw.appendChild(rankedName(r[0]));
        if (r[0][3]) nmw.appendChild(el("span", "rec", r[0][3]));
        tm.appendChild(nmw); row.appendChild(tm); row.appendChild(el("span", "sc", String(r[1]))); c.appendChild(row);
      });
    } else {
      var f = (g.x && g.x.fights || [])[0];
      if (g.ev === "mma" && f) c.appendChild(el("p", "st-p", g.h[0] + ". " + f.n.join(" vs ") + (g.x.fights.length > 1 ? " and " + (g.x.fights.length - 1) + " more fights." : "")));
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
      hb.appendChild(el("span", "lgh-t", l.label)); hb.appendChild(el("span", "lgh-n", String(list.length))); hb.appendChild(el("span", "lgh-c", "\u25BE"));
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
        if (isFollowed(g)) tg.appendChild(el("span", "mk fol", "\u2605"));
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
      var cnt = el("span", "lgh-n", ""); hb.appendChild(el("span", "lgh-t", l.label)); hb.appendChild(cnt); hb.appendChild(el("span", "lgh-c", "\u25BE"));
      hb.onclick = function () {
        var shut = box.classList.toggle("shut"); hb.setAttribute("aria-expanded", shut ? "false" : "true");
        if (shut) NCOL[l.key] = 1; else delete NCOL[l.key];
        try { localStorage.setItem("sb-ncol", JSON.stringify(NCOL)); } catch (e) {}
      };
      box.appendChild(hb);
      var body = el("div", "lgb news"); box.appendChild(body); sec.appendChild(box);
      ESPN.fetchNews(l.key).then(function (ns) {
        if (ns.length) {
          cnt.textContent = String(ns.length);
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
        if (S.tab === "yesterday" && !S.view && !S.settings) render();
      }, function () { delete S.leaders[t.gid]; });
    });
  }

  // ---------- my teams (record, standing, schedule) ----------
  function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function loadTeam(name) {
    if (S.teams[name] && !S.teams[name].stale) return;
    // Show the last saved copy right away; the fresh one replaces it when it arrives.
    S.teams[name] = TC[name] ? Object.assign({ done: true, stale: true }, TC[name]) : { loading: true };
    ESPN.findTeam(name).then(function (f) {
      if (!f) return { missing: true };
      return ESPN.fetchTeamInfo(f.lk, f.id);
    }).then(function (i) {
      S.teams[name] = Object.assign({ done: true }, i);
      if (!i.missing) { TC[name] = i; try { localStorage.setItem("sb-tcache", JSON.stringify(TC)); } catch (e) {} }
    }, function () { if (!S.teams[name] || !S.teams[name].stale) S.teams[name] = { done: true, error: true }; else S.teams[name].stale = false; })
      .then(function () { if (S.tab === "teams" && !S.view && !S.settings) render(); });
  }
  function gameList(label, gs) {
    var w = el("div", "tgl"), h4 = el("h4", null, label); w.appendChild(h4);
    if (label === "Next" && gs[0] && gs[0].s === "up") { var cdn = countdown(gs[0].t, true); if (cdn) { var cs2 = el("span", "cd", " · " + cdn); cs2.setAttribute("data-cd", gs[0].t); cs2.setAttribute("data-long", "1"); h4.appendChild(cs2); } }
    if (!gs.length) { w.appendChild(el("p", "rb", label === "Next" ? "No upcoming games found." : "No results yet.")); return w; }
    gs.forEach(function (g) {
      var r = el("div", "tg");
      r.appendChild(el("span", "tgd", g.s === "final" ? new Date(g.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : when(g.t)));
      r.appendChild(el("span", "tgo", (g.home ? "vs " : "at ") + g.opp));
      if (g.b && g.s === "up") r.appendChild(el("span", "tgb", g.b));
      if (g.s === "final" && g.my != null && g.op != null) {
        var res = g.my > g.op ? "W" : g.my < g.op ? "L" : "T";
        r.appendChild(el("span", "tgr" + (res === "W" ? " win" : ""), res + " " + g.my + "-" + g.op));
      } else if (g.s === "live") r.appendChild(el("span", "tgr", "Live"));
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
  function standTable(name, st) {
    if (!st.rows || !st.rows.length) return null;
    var d = el("details", "stn");
    d.open = !!S.stOpen[name];
    d.appendChild(el("summary", null, "Standings · " + st.group));
    var box = el("div", "stbox"), t = el("table"), hd = el("tr");
    ["#", "Team", "Record", st.exLabel, "Strk"].forEach(function (c, i) { hd.appendChild(el("th", i === 1 ? "l" : null, c)); });
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
    sm.appendChild(el("span", "tsub", s.l5.w + "-" + s.l5.l + (s.l5.t ? "-" + s.l5.t : "") + " in last " + s.l5.n + " \u00b7 season " + recStr(s.W, s.L, s.T)));
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
  // Active win streaks across the teams you follow, longest first.
  function heatCheck(rows) {
    if (!rows.length) return null;
    var hot = rows.filter(function (r) { return r.s.cur.t === "W" && r.s.cur.n >= 1 && !r.off; }).sort(function (p, q) { return q.s.cur.n - p.s.cur.n || q.s.heat - p.s.heat; });
    var cold = rows.filter(function (r) { return hot.indexOf(r) < 0; });
    var box = el("section", "heat"); box.appendChild(el("h2", null, "Active win streaks"));
    if (!hot.length) box.appendChild(el("p", "rb", "No one you follow is on a win streak right now."));
    else {
      var ul = el("ol", "hl"), mx = hot[0].s.cur.n;
      hot.forEach(function (r, i) {
        var li = el("li");
        li.appendChild(el("span", "hn", String(i + 1)));
        var mid = el("div", "hm"); mid.appendChild(el("div", "hname", r.name));
        var bar = el("div", "hbar"), fill = el("i", "up"); fill.style.width = Math.max(8, Math.round(r.s.cur.n / mx * 100)) + "%"; bar.appendChild(fill); mid.appendChild(bar);
        li.appendChild(mid);
        var rt = el("div", "hr"); rt.appendChild(el("b", null, (r.s.cur.n >= 5 ? "\uD83D\uDD25 " : "") + "W" + r.s.cur.n)); rt.appendChild(el("span", "tsub", "best " + r.s.best));
        li.appendChild(rt); ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (cold.length) box.appendChild(el("p", "hcold", "No active streak: " + cold.map(function (r) { return r.name + (r.s.cur.t === "L" && r.s.cur.n > 1 ? " (L" + r.s.cur.n + ")" : ""); }).join(", ")));
    return box;
  }
  function renderTeams(out) {
    var heatRows = [], heatSlot = el("div"); out.appendChild(heatSlot);
    var gr = el("div", "recaps");
    C.followed.forEach(function (name) {
      loadTeam(name);
      var T = S.teams[name] || {};
      var a = el("article", "recap"), h = el("div", "rh");
      var h3 = el("h3", null, name);
      if (T.standing && T.standing.logo) { var lb = el("span", "ab lg sm"); lb.appendChild(logoImg(T.standing.logo, "")); h3.insertBefore(lb, h3.firstChild); }
      h.appendChild(h3);
      if (T.standing) h.appendChild(el("span", "res rc", T.standing.record));
      a.appendChild(h);
      var gsAll = T.games || [];
      var off = !!T.done && gsAll.some(function (g) { return g.s === "final"; }) && !gsAll.some(function (g) { return g.s !== "final"; });
      if (off) a.className = "recap off";
      if (T.standing) a.appendChild(el("div", "rl", (off ? "Season recap · " : "") + ordinal(T.standing.rank) + " in " + T.standing.group + (!off && T.standing.streak ? " · streak " + T.standing.streak : "")));
      if (!T.done) a.appendChild(el("p", "rb", "Loading…"));
      else if (T.missing || T.error) a.appendChild(el("p", "rb", "Could not load this team right now."));
      else {
        var gs = T.games || [];
        var stt = T.standing && standTable(name, T.standing);
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
          a.appendChild(gameList("Next", ups.slice(0, 5)));
          if (ups.length > 5) {
            var sd = el("details", "stn"), sb = el("div", "stbox");
            sd.appendChild(el("summary", null, "Full schedule · " + ups.length + " games")); sd.appendChild(sb);
            sd.addEventListener("toggle", function () { if (sd.open && !sb.firstChild) sb.appendChild(gameList("All upcoming", ups)); });
            a.appendChild(sd);
          }
          a.appendChild(gameList("Last", gs.filter(function (g) { return g.s === "final"; }).sort(function (x, y) { return byTime(y, x); }).slice(0, 3)));
        }
      }
      gr.appendChild(a);
    });
    var hc = heatCheck(heatRows); if (hc) heatSlot.appendChild(hc);
    out.appendChild(gr);
  }

  // ---------- settings ----------
  function setFollowed(list) {
    C.followed = list;
    try { localStorage.setItem("sb-followed", JSON.stringify(list)); } catch (e) {}
    S.teams = {}; S.yesterday = buildYesterday(new Date()); loadLeaders(); render(); load(true);
  }
  function renderSettings(out) {
    var box = el("div", "set");
    box.appendChild(el("h3", null, "Teams you follow"));
    var ul = el("ul", "fl");
    C.followed.forEach(function (n) {
      var li = el("li"); li.appendChild(el("span", null, n));
      var x = el("button", null, "Remove"); x.type = "button";
      x.onclick = function () { setFollowed(C.followed.filter(function (q) { return q !== n; })); };
      li.appendChild(x); ul.appendChild(li);
    });
    box.appendChild(ul);
    var names = {};
    allGames().forEach(function (x) { names[x.g.h[0]] = 1; names[x.g.a[0]] = 1; });
    var f = el("form", "add"), inp = el("input"), dl = el("datalist"), add = el("button", null, "Add");
    inp.placeholder = "Add a team (start typing)"; inp.setAttribute("list", "teamnames"); inp.setAttribute("aria-label", "Team name");
    dl.id = "teamnames"; add.type = "submit";
    function fill() { dl.textContent = ""; Object.keys(names).sort().forEach(function (n) { var o = el("option"); o.value = n; dl.appendChild(o); }); }
    fill();
    var addNames = function (v) { Object.keys(v).forEach(function (k) { v[k].forEach(function (t) { names[t.name] = 1; }); }); fill(); };
    ESPN.fetchTeams().then(addNames); ESPN.fetchTeams(true).then(addNames);
    f.onsubmit = function (e) {
      e.preventDefault();
      var q = inp.value.trim().toLowerCase();
      var hit = Object.keys(names).filter(function (n) { return n.toLowerCase() === q; })[0];
      if (!hit) { toast("Pick a team from the suggestions so the name matches ESPN."); return; }
      if (C.followed.indexOf(hit) < 0) {
        setFollowed(C.followed.concat([hit]));
        ESPN.findTeam(hit).then(function (f) { var fl = f && leagueOf(f.lk); if (fl && fl.lazy) { addEager(f.lk); loadLeague(f.lk); } });
      }
    };
    f.appendChild(inp); f.appendChild(add); f.appendChild(dl); box.appendChild(f);

    box.appendChild(el("h3", null, "Theme"));
    var seg = el("div", "seg"), cur = "auto";
    try { cur = localStorage.getItem("sb-theme") || "auto"; } catch (e) {}
    [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].forEach(function (o) {
      var b = el("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", o[0] === cur ? "true" : "false");
      b.onclick = function () { try { localStorage.setItem("sb-theme", o[0]); } catch (e) {} applyTheme(); render(); };
      seg.appendChild(b);
    });
    box.appendChild(seg);

    box.appendChild(el("h3", null, "Reset"));
    var rs = el("button", null, "Back to default teams"); rs.type = "button";
    rs.onclick = function () { try { localStorage.removeItem("sb-followed"); } catch (e) {} setFollowed(DEFAULT_FOLLOWED.slice()); };
    box.appendChild(rs);
    if (window.FUN) { box.appendChild(el("h3", null, "Collection Log")); box.appendChild(el("p", "hcold", FUN.count() + " of " + FUN.total + " cards found. Hint: poke things, visit at odd hours, try a classic cheat code."));
      var cb = el("button", null, "Open profile and Collection Log"); cb.type = "button"; cb.onclick = function () { openProf("log"); }; box.appendChild(cb);
      box.appendChild(el("h3", null, "New card reveal"));
      var rv = el("div", "seg"), rc = "f"; try { rc = localStorage.getItem("sb-rv") || "f"; } catch (e) {}
      [["f", "Full show"], ["q", "Quick toast"]].forEach(function (o) {
        var b = el("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", o[0] === rc ? "true" : "false");
        b.onclick = function () { try { if (o[0] === "f") localStorage.removeItem("sb-rv"); else localStorage.setItem("sb-rv", "q"); } catch (e) {} [].forEach.call(rv.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); };
        rv.appendChild(b);
      });
      box.appendChild(rv); }
    out.appendChild(box);
  }

  // One tap: copies a clean score line, ready to paste into Discord or a text.
  function copyScore() {
    var x = S.view.x, g = x.g, pa = (leagueOf(x.lk) || {}).path || "", em = /^football/.test(pa) ? "🏈" : /^basketball/.test(pa) ? "🏀" : /^hockey/.test(pa) ? "🏒" : /^baseball/.test(pa) ? "⚾" : /^australian/.test(pa) ? "🏉" : /^soccer/.test(pa) ? "⚽" : /^volleyball/.test(pa) ? "🏐" : /^lacrosse/.test(pa) ? "🥍" : /^field-hockey/.test(pa) ? "🏑" : "";
    if (g.ev) {
      var top = g.ev === "mma" ? (g.x.fights[0] && g.x.fights[0].win >= 0 ? g.x.fights[0].n[g.x.fights[0].win] + " won the main event" : "") : (((g.x.sess.filter(function (s) { return /^race$/i.test(s.n); })[0] || { rows: [] }).rows[0] || [])[1] || "");
      var etx = (g.ev === "mma" ? "🥊 " : "🏁 ") + g.h[0] + " · " + (g.s === "final" ? "Final" + (top ? " · " + (g.ev === "mma" ? top : "Winner: " + top) : "") : g.s === "live" ? g.c || "Live" : when(g.t));
      try { navigator.clipboard.writeText(etx).then(function () { toast("Copied: " + etx); }, function () { toast("Could not copy"); }); } catch (e) { toast("Could not copy"); }
      return;
    }
    var txt = g.s === "up" ? g.a[0] + " at " + g.h[0] + " · " + when(g.t)
      : g.a[0] + " " + g.a[2] + ", " + g.h[0] + " " + g.h[2] + " · " + (g.s === "final" ? "Final" : g.c || "Live");
    txt = (em ? em + " " : "") + txt;
    try { navigator.clipboard.writeText(txt).then(function () { toast("Copied: " + txt); }, function () { toast("Could not copy"); }); }
    catch (e) { toast("Could not copy"); }
  }
  function shareGame() {
    var g = S.view.x.g, data = { title: g.a[0] + " at " + g.h[0], url: location.href };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    try { navigator.clipboard.writeText(location.href).then(function () { toast("Link copied"); }, function () { toast("Could not copy the link"); }); }
    catch (e) { toast("Could not copy the link"); }
  }

  // ---------- detail view ----------
  function tbl(t) {
    var tw = el("div", "tw"), tb = el("table"), hd = el("thead"), hr = el("tr");
    t.cols.forEach(function (c, i) { hr.appendChild(el("th", i === 0 ? "l" : null, c)); });
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
    w.appendChild(el("p", null, g.h[1] + " " + last + "% · " + g.a[1] + " " + (100 - last) + "%  (line up = " + g.h[1] + " favored)"));
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
  function renderEvent(out, g) {
    var P = g.x || {};
    if (P.venue) out.appendChild(el("p", "rb", P.venue));
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
    } else {
      var ses = (P.sess || []).slice().reverse();
      ses.forEach(function (s, i) {
        var title = sessName(s.n) + " · " + (s.s === "post" ? "Final" : s.s === "in" ? "Live" : when(s.t));
        var body = s.rows.length ? tbl({ cols: ["Pos", "Driver"], rows: s.rows }) : el("p", "rb", "Starts " + when(s.t) + ".");
        out.appendChild(sec(title, body, i === 0 || s.s === "in", false));
      });
    }
  }
  function renderDetail(out) {
    var v = S.view, g = v.x.g, d = v.d, lg = leagueOf(v.x.lk);
    var back = el("button", "back", "← All scores"); back.type = "button"; back.onclick = closeGame;
    var nav = el("div", "navbar"); nav.appendChild(back);
    var acts = el("div", "acts");
    var cpb = el("button", "back", "Copy"); cpb.type = "button"; cpb.onclick = copyScore; acts.appendChild(cpb);
    var pnb = el("button", "back", isPinned(v.x) ? "★ Pinned" : "☆ Pin"); pnb.type = "button";
    pnb.onclick = function () {
      var k = pinKey(v.x), i = PINS.indexOf(k);
      if (i >= 0) PINS.splice(i, 1); else PINS.push(k);
      savePins(); pnb.textContent = i >= 0 ? "☆ Pin" : "★ Pinned"; toast(i >= 0 ? "Unpinned" : "Pinned to the top of every list");
    };
    acts.appendChild(pnb);
    var shb = el("button", "back", "Share ↗"); shb.type = "button"; shb.onclick = shareGame; acts.appendChild(shb);
    nav.appendChild(acts);
    out.appendChild(nav);
    var hd = el("div", "dhead"); hd.appendChild(card(v.x)); out.appendChild(hd);
    if (g.ev) { renderEvent(out, g); return; }
    if (d === undefined) { out.appendChild(el("p", "rmsg", "Loading box score…")); return; }
    if (d === null) { out.appendChild(el("p", "rmsg", "Could not load the box score right now. Try again in a moment.")); return; }

    var up = g.s === "up", list = [], prim = [], secd = [];
    var pv = el("div", "sum");
    var rc = g.s === "final" && d.recap && d.recap.secs.length ? d.recap : null;
    var nv = v.n && (v.n.type === "Recap") === (g.s === "final") ? v.n : null;
    if (nv) {
      pv.appendChild(el("p", "nh", nv.h));
      nv.paras.forEach(function (t) { pv.appendChild(el("p", "ap", t)); });
      var sl = el("p", "src", "Story: AP, via ESPN"), sa = nv.link && el("a", null, " Read on ESPN ↗");
      if (sa) { sa.href = nv.link; sa.target = "_blank"; sa.rel = "noopener"; sl.appendChild(sa); }
      pv.appendChild(sl);
    } else pv.appendChild(el("p", null, rc ? rc.head : (d.preview || (g.a[0] + " visit " + g.h[0] + " " + when(g.t) + "."))));
    if (d.h2h) pv.appendChild(el("p", "h2h", "Season series · " + d.h2h));
    (rc ? rc.secs : (d.narrative || [])).forEach(function (n) {
      var w = el("div", "nar"); w.appendChild(el("h4", null, n.h)); w.appendChild(el("p", null, n.p)); pv.appendChild(w);
    });
    if (d.link && !nv) {
      var lw = el("div", "nar"), la = el("a", null, (rc ? "ESPN recap: " : "ESPN preview: ") + d.link.text + " ↗");
      la.href = d.link.href; la.target = "_blank"; la.rel = "noopener"; lw.appendChild(la); pv.appendChild(lw);
    }
    // Followed teams' finished games get a one-tap YouTube search for the full-game highlights (no extra requests).
    if (rc && isFollowed(g)) {
      var yq = g.a[0] + " vs " + g.h[0] + " full game highlights " + new Date(g.t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      var yw = el("div", "nar"), ya = el("a", null, "▶ Full game highlights on YouTube ↗");
      ya.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(yq); ya.target = "_blank"; ya.rel = "noopener";
      yw.appendChild(ya); pv.appendChild(yw);
    }
    var preview = sec(rc || nv && g.s === "final" ? "Game recap" : "Matchup preview", pv, up || !!rc || !!nv, false);
    if (up || rc) list.push(preview);

    if (d.wp && d.wp.length > 4) prim.push(sec("Win probability", wpChart(d.wp, g), true, false));
    if (d.periods) {
      var rows = d.periods.rows.map(function (r) {
        var tot = 0;
        for (var i = 1; i < r.length; i++) if (typeof r[i] === "number") tot += r[i];
        return r.concat([tot]);
      });
      prim.push(sec(lg && lg.soccer ? "Score by half" : "Score by period", tbl({ cols: [""].concat(d.periods.labels.map(function (_, i) { return perLabel(v.x.lk, i); }), ["T"]), rows: rows }), true, false));
    }
    d.tables.filter(function (t) { return t.kind === "team"; }).forEach(function (t) {
      prim.push(sec(up ? "Season team stats" : t.title, tbl(t), true, false));
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

    if (d.plays.length) {
      var sc = el("div", "plays"); sc.tabIndex = 0;
      d.plays.forEach(function (p) {
        var r = el("div", "play");
        r.appendChild(el("span", "pt", p.t));
        r.appendChild(el("span", "px", p.x));
        sc.appendChild(r);
      });
      secd.push(sec("Recent plays", sc, true, false));
    }
    // Two tiers: the main numbers first, minor categories and the play log tucked into the second one.
    [tier("Primary stats", prim, true), tier("Secondary stats", secd, g.s === "live")].forEach(function (t) { if (t) list.push(t); });
    if (!up && !rc) list.push(preview);

    var bar = el("div", "allbar");
    var b1 = el("button", null, "Expand all"), b2 = el("button", null, "Collapse all");
    b1.type = b2.type = "button";
    var setAll = function (o) { list.forEach(function (s) { s.open = o; [].forEach.call(s.querySelectorAll("details"), function (c) { c.open = o; }); }); };
    b1.onclick = function () { setAll(true); };
    b2.onclick = function () { setAll(false); };
    bar.appendChild(b1); bar.appendChild(b2);
    out.appendChild(bar);
    list.forEach(function (s) { out.appendChild(s); });
  }

  // ---------- routing (#game/<league>/<id>) so the phone's Back button works ----------
  function openGame(x) { S.sy = window.pageYOffset; S.pushed = true; location.hash = "game/" + x.lk + "/" + x.g.id; }
  function closeGame() {
    if (S.pushed) { S.pushed = false; history.back(); } else { clearHash(); syncFromHash(); }
  }
  function clearHash() { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} S.pushed = false; }
  function syncFromHash() {
    var m = /^#game\/([a-z0-9]+)\/([\w-]+)$/.exec(location.hash);
    if (!m) { if (S.view) { S.view = null; render(); window.scrollTo(0, S.sy || 0); S.sy = 0; } return; }
    if (!S.ready) return;
    var key = m[1] + "_" + m[2];
    if (S.view && S.view.key === key) return;
    var x = allGames().filter(function (q) { return q.lk === m[1] && q.g.id === m[2]; })[0];
    if (!x) { S.view = null; render(); return; }
    S.view = { x: x, key: key, d: ESPN.peekGame(m[1], m[2]), n: undefined };
    if (window.FUN && FUN.team) FUN.team(x.lk, x.g);
    render(); window.scrollTo(0, 0); loadDetail(); loadNarr();
  }
  // The written recap/preview (AP via ESPN) loads alongside the box score and is added when it arrives.
  function loadNarr() {
    var v = S.view;
    if (!v || v.x.g.ev) return;
    ESPN.fetchNarrative(v.x.lk, v.x.g.id, v.x.g.s === "final").then(function (n) {
      if (S.view && S.view.key === v.key && n) { S.view.n = n; render(); }
    });
  }
  function loadDetail() {
    var v = S.view;
    if (!v || v.x.g.ev) return;
    ESPN.fetchGame(v.x.lk, v.x.g.id).then(function (d) {
      if (S.view && S.view.key === v.key && JSON.stringify(d) !== JSON.stringify(S.view.d)) { S.view.d = d; render(); }
    }, function () {
      if (S.view && S.view.key === v.key && S.view.d === undefined) { S.view.d = null; render(); }
    });
  }

  // ---------- main render ----------
  function render() {
    var rail = $("rail"); rail.textContent = "";
    var all = allGames(), fol = all.filter(function (x) { return isFollowed(x.g); });
    // Two groups: your personal views as big tiles, then the league filters as small chips.
    function tab(key, label, count, cls, icon) {
      var b = el("button", cls); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", key === S.tab && !S.settings ? "true" : "false");
      if (icon) { var ic = el("span", "ico", icon); ic.setAttribute("aria-hidden", "true"); b.appendChild(ic); }
      b.appendChild(el("span", "lbl", label));
      if (count != null) b.appendChild(el("span", "n", String(count)));
      b.onclick = function () {
        S.tab = key; S.view = null; S.settings = false; S.more = false; clearHash();
        if (key === "yesterday") loadLeaders();
        var lz = leagueOf(key); if (lz && lz.lazy) loadLeague(key);
        try { localStorage.setItem("sb-tab", S.tab); } catch (e) {}
        render();
      };
      return b;
    }
    var main = el("div", "rail-main"), lgs = el("div", "rail-lg");
    main.appendChild(tab("pinned", "Following", null, "tab big", "★"));
    main.appendChild(tab("yesterday", "Yesterday", null, "tab big", "↺"));
    main.appendChild(tab("teams", "My teams", null, "tab big", "⚑"));
    lgs.appendChild(el("span", "rail-lbl", "Leagues"));
    lgs.appendChild(tab("all", "All", all.length, "tab"));
    LG.forEach(function (l) { if (MAIN.indexOf(l.key) >= 0 || l.key === S.tab) lgs.appendChild(tab(l.key, l.label, S.games[l.key].length || (l.lazy && S.lgState[l.key] === "loading" ? null : 0), "tab")); });
    var mb = el("button", "tab more-btn", S.more ? "Close ▴" : "More leagues ▾"); mb.type = "button"; mb.setAttribute("aria-expanded", S.more ? "true" : "false");
    mb.onclick = function () { S.more = !S.more; render(); };
    lgs.appendChild(mb);
    rail.appendChild(main); rail.appendChild(lgs);

    var out = $("out"); out.textContent = "";
    // Entrance animations play when you arrive somewhere new, not on the quiet once-a-minute refreshes.
    var vk = [S.tab, S.ysub, S.view && (S.view.g ? S.view.g.id : S.view.id), S.settings ? 1 : 0].join("|");
    if (vk !== RK) {
      RK = vk; out.classList.add("enter"); clearTimeout(RT);
      out.setAttribute("data-fx", window.FUN ? FUN.enterFx() : "rise");
      if (window.FUN) requestAnimationFrame(function () { FUN.after(out); }); RT = setTimeout(function () { out.classList.remove("enter"); }, 1500);
    }
    else if (!RT) out.classList.remove("enter");

    if (!S.ready) { out.appendChild(notice("Scores will show up here", "Live games, finals and what is next for your teams load in a moment. Pull down to refresh if nothing appears.")); return; }
    if (S.settings) { renderSettings(out); return; }
    if (S.view) { renderDetail(out); return; }
    if (S.more) out.appendChild(morePanel());
    if (S.tab === "yesterday") { renderYesterday(out); return; }
    if (S.tab === "teams") { renderTeams(out); return; }

    var items = S.tab === "pinned" ? fol : S.tab === "all" ? all : all.filter(function (x) { return x.lk === S.tab; });
    var pins = all.filter(isPinned);
    items = items.filter(function (x) { return !isPinned(x); });
    var cl = leagueOf(S.tab), cst = cl && S.lgState[cl.key];
    if (!items.length && !pins.length) {
      out.appendChild(cst === "loading" ? notice("Loading " + cl.label, "Fetching the latest games…") : cst === "failed" ? notice("Could not load " + cl.label, "Pull down to try again.") : notice("Nothing on right now", "No games for this view in the latest update."));
      return;
    }
    var big = S.tab === "pinned";
    var close = items.filter(isClose).sort(function (a, b) { return Math.abs(a.g.h[2] - a.g.a[2]) - Math.abs(b.g.h[2] - b.g.a[2]); });
    var live = items.filter(function (x) { return x.g.s === "live" && close.indexOf(x) < 0; });
    var up = items.filter(function (x) { return x.g.s === "up"; }).sort(function (a, b) { return byTime(a.g, b.g); });
    var fin = items.filter(function (x) { return x.g.s === "final"; }).sort(function (a, b) { return byTime(b.g, a.g); });
    [group("Pinned", "pin", pins, big), group("Close games", "close", close, big), group("Live now", "live", live, big), group("Coming up", "", up, big, true), group("Final", "", fin, big)].forEach(function (s) { if (s) out.appendChild(s); });
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
    inp.type = "search"; inp.placeholder = "Search leagues (soccer, UFC, college\u2026)"; inp.autocomplete = "off"; inp.setAttribute("aria-label", "Search leagues");
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
    box.appendChild(inp); box.appendChild(res); fill();
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0);
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
    var bad = S.failed.map(function (k) { return leagueOf(k).label; });
    $("foot").textContent = (bad.length ? "Could not load: " + bad.join(", ") + ". " : "") +
      "Scores refresh by themselves every minute while a game is live. Pull down, or tap the status light, any time for the latest.";
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
      if (ok) { keepY(key, r.byLeague[key]); S.games[key] = trim(r.byLeague[key]); S.lgState[key] = "done"; saveCache(); } else S.lgState[key] = "failed";
      if (!S.view && !S.settings) render();
    };
    ESPN.fetchScores(offs, [key]).then(function (r) { fin(r.failed.indexOf(key) < 0, r); }, function () { fin(false); });
    if (!S.view && !S.settings) render();
  }
  function saveCache() { try { localStorage.setItem("sb-cache", JSON.stringify({ at: S.last, g: S.games, yf: S.yf })); } catch (e) {} }
  function activeLeagues() {
    var o = {};
    allGames().forEach(function (x) { if (x.g.s === "live" || (x.g.s === "up" && Math.abs(new Date(x.g.t) - Date.now()) < 35 * 60000)) o[x.lk] = 1; });
    return Object.keys(o);
  }
  function load(full, only) {
    if (S.loading) return;
    S.loading = true;
    var btn = $("refresh"); btn.disabled = true; btn.setAttribute("aria-busy", "true"); stampTick();
    document.body.classList.add("ld");
    var offsets = [];
    for (var i = -1; i <= (full ? C.daysAhead : 0); i++) offsets.push(i);
    if (only && !only.length) only = null;
    if (!only) only = wantLeagues();
    var cl = leagueOf(S.tab);
    if (cl && cl.lazy && S.lgState[cl.key] === "failed") { S.lgState[cl.key] = ""; loadLeague(cl.key); }
    ESPN.fetchScores(offsets, only).then(function (r) {
      var before = JSON.stringify([S.games, S.yesterday]);
      var prev = {};
      allGames().forEach(function (x) { if (isFollowed(x.g)) prev[x.g.id] = x.g; });
      if (full) S.teams = {};
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
      saveCache();
      PINS = PINS.filter(function (k) {
        var x = allGames().filter(function (q) { return pinKey(q) === k; })[0];
        if (!x && only.indexOf(k.split("_")[0]) < 0) return true;
        return x && !(x.g.s === "final" && Date.now() - new Date(x.g.t) > 12 * 3600000);
      });
      savePins();
      if (!firstLoad) allGames().forEach(function (x) {
        var g = x.g, p = prev[g.id];
        if (!p || !isFollowed(g)) return;
        var line = g.a[0] + " " + g.a[2] + ", " + g.h[0] + " " + g.h[2];
        if (g.s === "final" && p.s !== "final") toast("Final: " + line);
        else if (g.s === "live" && p.s === "up") toast("Game started: " + g.a[0] + " at " + g.h[0]);
        else if (g.s === "live" && (p.h[2] !== g.h[2] || p.a[2] !== g.a[2])) toast("Score: " + line);
      });
      loadLeaders();
      var changed = JSON.stringify([S.games, S.yesterday]) !== before;

      if (S.view) {
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
      document.body.classList.remove("ld");
      if (window.ptrDone) window.ptrDone();
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
    $("mark").onclick = function () { t.click(); };
  })();
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
  window.addEventListener("hashchange", syncFromHash);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.view) closeGame(); });
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
  function pollGap() {
    var now = Date.now(), fol = false, live = false, soon = false;
    allGames().forEach(function (x) {
      var g = x.g;
      if (g.s === "live") { live = true; if (isFollowed(g)) fol = true; }
      else if (g.s === "up" && isFollowed(g)) { var d = new Date(g.t) - now; if (d < 5 * 60000 && d > -30 * 60000) soon = true; }
    });
    return fol ? 30000 : live ? C.liveRefreshSeconds * 1000 : soon ? 60000 : 0;
  }
  setInterval(function () {
    if (document.hidden || S.loading) return;
    var gap = pollGap();
    if (gap && Date.now() - S.last >= gap - 1000) load(false, activeLeagues());
  }, 10000);
  setInterval(stampTick, 30000);
  window.SB_SET = function () { S.settings = true; S.view = null; clearHash(); render(); };
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
    window.addEventListener("touchstart", function (e) { y0 = window.scrollY <= 0 && !S.loading ? e.touches[0].clientY : null; pull = 0; armed = false; }, { passive: true });
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
  var FV = ((D0.currentScript || {}).src || "").split("?")[1] || "";
  var funQ = [], funLoading = false;
  function addScript(src, cb) { var s = document.createElement("script"); s.src = src + "?" + FV; s.async = true; s.onload = cb; document.head.appendChild(s); }
  function ensureFun(cb) {
    if (window.FUN) { cb(); return; }
    funQ.push(cb); if (funLoading) return; funLoading = true;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "fun.css?" + FV; document.head.appendChild(l);
    addScript("fun.js", function () { var q = funQ; funQ = []; q.forEach(function (f) { f(); }); });
  }
  function openProf(v) {
    ensureFun(function () {
      if (window.PROF) { PROF.open(v); return; }
      addScript("profile.js", function () { PROF.open(v); });
    });
  }
  try { if (localStorage.getItem("sb-active") && navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
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
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { try { navigator.serviceWorker.register("sw.js?v=61").catch(function () {}); } catch (e) {} });
})();
