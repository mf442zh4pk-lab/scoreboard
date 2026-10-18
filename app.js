// UI: state, rendering and routing. No ESPN-specific knowledge lives here (see espn.js).
(function () {
  "use strict";
  var C = window.CONFIG, LG = C.leagues, DAY = ESPN.DAY;
  var $ = function (id) { return document.getElementById(id); };

  var S = { tab: "pinned", games: {}, yesterday: null, ready: false, loading: false, last: 0, failed: [], view: null, pushed: false, settings: false, teams: {}, leaders: {} };
  var openState = {};   // remembers which detail sections you opened or closed
  var PINS = [], TC = {};
  try { PINS = JSON.parse(localStorage.getItem("sb-pins") || "[]") || []; } catch (e) {}
  try { TC = JSON.parse(localStorage.getItem("sb-tcache") || "{}") || {}; } catch (e) {}
  function savePins() { try { localStorage.setItem("sb-pins", JSON.stringify(PINS)); } catch (e) {} }
  function pinKey(x) { return x.lk + "_" + x.g.id; }
  function isPinned(x) { return PINS.indexOf(pinKey(x)) >= 0; }
  LG.forEach(function (l) { S.games[l.key] = []; });
  var DEFAULT_FOLLOWED = C.followed.slice();
  try { var saved = localStorage.getItem("sb-tab"); if (saved) S.tab = saved; } catch (e) {}
  try { var sf = JSON.parse(localStorage.getItem("sb-followed") || "null"); if (sf && sf.length) C.followed = sf; } catch (e) {}
  function applyTheme() {
    var t = "auto";
    try { t = localStorage.getItem("sb-theme") || "auto"; } catch (e) {}
    if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  }
  applyTheme();
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.className = "show";
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = ""; }, 6000);
  }

  // ---------- helpers ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
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
  function byTime(a, b) { return new Date(a.t) - new Date(b.t); }
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
  var CLOSE = { nfl: [4, 8], ncaafb: [4, 8], nba: [4, 5], nhl: [3, 1], mlb: [7, 2], afl: [4, 12] };
  function isClose(x) {
    var g = x.g, c = g.c || "", lg = leagueOf(x.lk);
    if (g.s !== "live" || g.h[2] == null || g.a[2] == null) return false;
    var diff = Math.abs(g.h[2] - g.a[2]);
    if (lg && lg.soccer) { var mm = /(\d+)'/.exec(c); return diff <= 1 && (/ET|Extra/i.test(c) || (mm && +mm[1] >= 70)); }
    var r = CLOSE[x.lk]; if (!r) return false;
    var p = /OT|SO\b|ET\b|Extra/i.test(c) ? 99 : 0, m;
    if (!p && (m = /(\d+)(?:st|nd|rd|th)/i.exec(c))) p = +m[1];
    if (!p && (m = /\bQ(\d)/i.exec(c))) p = +m[1];
    return p >= r[0] && diff <= r[1];
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
        name: name, played: true, result: res, gid: g.id, lk: x.lk, abbr: mine[1],
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
  function card(x) {
    var g = x.g, c = el("div", "card" + (isFollowed(g) ? " followed" : ""));
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
      var nmw = el("span", "nmw"); nmw.appendChild(el("span", "nm", r[0][0]));
      if (r[0][3]) nmw.appendChild(el("span", "rec", r[0][3]));
      tm.appendChild(nmw);
      row.appendChild(tm);
      row.appendChild(el("span", "sc", has ? String(r[1]) : "–"));
      c.appendChild(row);
    });
    return c;
  }
  function group(title, cls, items, big) {
    if (!items.length) return null;
    var s = el("section", "grp"), h = el("h2", cls || "");
    if (cls === "live") h.appendChild(el("span", "pulse"));
    if (cls === "close") h.appendChild(el("span", "flame", "\u25B2"));
    h.appendChild(document.createTextNode(title));
    s.appendChild(h);
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
    s.appendChild(gr);
    return s;
  }
  // Start fetching a game's box score as soon as a finger or mouse settles on its card, so the tap opens instantly.
  function prefetchOn(c, x) {
    var t = 0;
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
  function renderYesterday(out) {
    var y = S.yesterday;
    if (!y) { out.appendChild(notice("No recap yet", "Hit Refresh to load yesterday's results.")); return; }
    out.appendChild(el("p", "lg", y.date));
    var played = y.teams.filter(function (t) { return t.played; });
    if (!played.length) { out.appendChild(notice("No games yesterday", "None of your teams played yesterday.")); return; }
    var gr = el("div", "recaps");
    played.forEach(function (t) {
      var a = el("article", "recap");
      var h = el("div", "rh");
      var yh = el("h3", null, t.name), yl = logoFor(t.name);
      if (yl) { var yb = el("span", "ab lg sm"); yb.appendChild(logoImg(yl, "")); yh.insertBefore(yb, yh.firstChild); }
      h.appendChild(yh);
      h.appendChild(el("span", "res" + (t.result === "W" ? " win" : ""), t.result === "W" ? "Won" : t.result === "L" ? "Lost" : "Tied"));
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
  }

  // Top performers for yesterday's recaps (one box-score fetch per finished game, cached).
  function loadLeaders() {
    if (!S.yesterday || S.tab !== "yesterday") return;
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
  function renderTeams(out) {
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
        var fd = formDots(gs); if (fd) a.appendChild(fd);
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
    ESPN.fetchTeams().then(function (v) { Object.keys(v).forEach(function (k) { v[k].forEach(function (t) { names[t.name] = 1; }); }); fill(); });
    f.onsubmit = function (e) {
      e.preventDefault();
      var q = inp.value.trim().toLowerCase();
      var hit = Object.keys(names).filter(function (n) { return n.toLowerCase() === q; })[0];
      if (!hit) { toast("Pick a team from the suggestions so the name matches ESPN."); return; }
      if (C.followed.indexOf(hit) < 0) setFollowed(C.followed.concat([hit]));
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
    out.appendChild(box);
  }

  // One tap: copies a clean score line, ready to paste into Discord or a text.
  function copyScore() {
    var x = S.view.x, g = x.g, em = { nfl: "🏈", ncaafb: "🏈", nba: "🏀", nhl: "🏒", mlb: "⚾", afl: "🏉", epl: "⚽", ucl: "⚽" }[x.lk] || "";
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
    if (lk === "nhl") return i < 3 ? "P" + (i + 1) : "OT";
    if (lk === "mlb") return String(i + 1);
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
  function openGame(x) { S.pushed = true; location.hash = "game/" + x.lk + "/" + x.g.id; }
  function closeGame() {
    if (S.pushed) { S.pushed = false; history.back(); } else { clearHash(); syncFromHash(); }
  }
  function clearHash() { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} S.pushed = false; }
  function syncFromHash() {
    var m = /^#game\/([a-z]+)\/(\d+)$/.exec(location.hash);
    if (!m) { if (S.view) { S.view = null; render(); window.scrollTo(0, 0); } return; }
    if (!S.ready) return;
    var key = m[1] + "_" + m[2];
    if (S.view && S.view.key === key) return;
    var x = allGames().filter(function (q) { return q.lk === m[1] && q.g.id === m[2]; })[0];
    if (!x) { S.view = null; render(); return; }
    S.view = { x: x, key: key, d: ESPN.peekGame(m[1], m[2]), n: undefined };
    render(); window.scrollTo(0, 0); loadDetail(); loadNarr();
  }
  // The written recap/preview (AP via ESPN) loads alongside the box score and is added when it arrives.
  function loadNarr() {
    var v = S.view;
    if (!v) return;
    ESPN.fetchNarrative(v.x.lk, v.x.g.id, v.x.g.s === "final").then(function (n) {
      if (S.view && S.view.key === v.key && n) { S.view.n = n; render(); }
    });
  }
  function loadDetail() {
    var v = S.view;
    if (!v) return;
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
        S.tab = key; S.view = null; S.settings = false; clearHash();
        if (key === "yesterday") loadLeaders();
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
    LG.forEach(function (l) { lgs.appendChild(tab(l.key, l.label, S.games[l.key].length, "tab")); });
    rail.appendChild(main); rail.appendChild(lgs);

    var out = $("out"); out.textContent = "";
    var about = "Following: " + C.followed.join(", ") + ".";
    if (C.noFeed.length) about += " " + C.noFeed.join(", ") + " " + (C.noFeed.length > 1 ? "are" : "is") + " on the list, but there is no data feed for " + (C.noFeed.length > 1 ? "them" : "it") + " yet.";
    $("about").textContent = about;

    if (!S.ready) { out.appendChild(notice("Scores will show up here", "Live games, finals and what is next for your teams load in a moment. Hit Refresh if nothing appears.")); return; }
    if (S.settings) { renderSettings(out); return; }
    if (S.view) { renderDetail(out); return; }
    if (S.tab === "yesterday") { renderYesterday(out); return; }
    if (S.tab === "teams") { renderTeams(out); return; }

    var items = S.tab === "pinned" ? fol : S.tab === "all" ? all : all.filter(function (x) { return x.lk === S.tab; });
    var pins = all.filter(isPinned);
    items = items.filter(function (x) { return !isPinned(x); });
    if (!items.length && !pins.length) { out.appendChild(notice("Nothing on right now", "No games for this view in the latest update.")); return; }
    var big = S.tab === "pinned";
    var close = items.filter(isClose).sort(function (a, b) { return Math.abs(a.g.h[2] - a.g.a[2]) - Math.abs(b.g.h[2] - b.g.a[2]); });
    var live = items.filter(function (x) { return x.g.s === "live" && close.indexOf(x) < 0; });
    var up = items.filter(function (x) { return x.g.s === "up"; }).sort(function (a, b) { return byTime(a.g, b.g); });
    var fin = items.filter(function (x) { return x.g.s === "final"; }).sort(function (a, b) { return byTime(b.g, a.g); });
    [group("Pinned", "pin", pins, big), group("Close games", "close", close, big), group("Live now", "live", live, big), group("Coming up", "", up, big), group("Final", "", fin, big)].forEach(function (s) { if (s) out.appendChild(s); });
  }

  function stampTick() {
    var s = $("stamp"), d = $("dot");
    if (!S.last) { s.textContent = S.loading ? "Loading scores" : "No scores yet"; d.className = "dot"; return; }
    [].forEach.call(document.querySelectorAll("[data-cd]"), function (n) {
      var t = countdown(n.getAttribute("data-cd"), !!n.getAttribute("data-long"));
      n.textContent = t ? " · " + t : "";
    });
    var m = Math.max(0, Math.round((Date.now() - S.last) / 60000));
    s.textContent = "Updated " + (m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " hr ago");
    d.className = "dot " + (m <= 5 ? "fresh" : "stale");
    var bad = S.failed.map(function (k) { return leagueOf(k).label; });
    $("foot").textContent = (bad.length ? "Could not load: " + bad.join(", ") + ". " : "") +
      "Scores refresh by themselves every minute while a game is live. Tap Refresh any time for the latest.";
  }

  // ---------- loading ----------
  // full = true loads yesterday through the next few days; otherwise just yesterday and today.
  function saveCache() { try { localStorage.setItem("sb-cache", JSON.stringify({ at: S.last, g: S.games })); } catch (e) {} }
  function activeLeagues() {
    var o = {};
    allGames().forEach(function (x) { if (x.g.s === "live" || (x.g.s === "up" && Math.abs(new Date(x.g.t) - Date.now()) < 35 * 60000)) o[x.lk] = 1; });
    return Object.keys(o);
  }
  function load(full, only) {
    if (S.loading) return;
    S.loading = true;
    var btn = $("refresh"); btn.disabled = true; btn.textContent = "Refreshing"; stampTick();
    document.body.classList.add("ld");
    var offsets = [];
    for (var i = -1; i <= (full ? C.daysAhead : 0); i++) offsets.push(i);
    if (only && !only.length) only = null;
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
        S.games[l.key] = trim(Object.keys(byId).map(function (k) { return byId[k]; }));
      });
      S.failed = r.failed;
      S.yesterday = buildYesterday(new Date(r.updated));
      S.last = Date.parse(r.updated) || Date.now();
      var firstLoad = !S.fresh;
      S.fresh = true; S.ready = true;
      saveCache();
      PINS = PINS.filter(function (k) {
        var x = allGames().filter(function (q) { return pinKey(q) === k; })[0];
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
      $("stamp").textContent = "Could not reach the score server"; $("dot").className = "dot stale";
    }).then(function () {
      S.loading = false; btn.disabled = false; btn.textContent = "Refresh"; stampTick();
      document.body.classList.remove("ld");
      if (window.ptrDone) window.ptrDone();
    });
  }
  function anyLive() { return allGames().some(function (x) { return x.g.s === "live"; }); }

  // ---------- start ----------
  document.title = C.title;
  $("title").textContent = C.title;
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
  $("gear").onclick = function () { S.settings = !S.settings; S.view = null; clearHash(); render(); };

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
      LG.forEach(function (l) { if (cc.g[l.key]) S.games[l.key] = cc.g[l.key]; });
      S.last = cc.at; S.ready = true; S.yesterday = buildYesterday(new Date());
    }
  } catch (e) {}
  render(); stampTick();
  if (S.ready) { syncFromHash(); loadLeaders(); }
  load(true);
  // Offline-ready app shell and cached logos (sw.js). Failure is harmless.
  if ("serviceWorker" in navigator) window.addEventListener("load", function () { try { navigator.serviceWorker.register("sw.js?v=20").catch(function () {}); } catch (e) {} });
})();
