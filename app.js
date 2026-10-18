// UI: state, rendering and routing. No ESPN-specific knowledge lives here (see espn.js).
(function () {
  "use strict";
  var C = window.CONFIG, LG = C.leagues, DAY = ESPN.DAY;
  var $ = function (id) { return document.getElementById(id); };

  var S = { tab: "pinned", games: {}, yesterday: null, ready: false, loading: false, last: 0, failed: [], view: null, pushed: false, settings: false, teams: {}, leaders: {} };
  var openState = {};   // remembers which detail sections you opened or closed
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
  function card(x) {
    var g = x.g, c = el("div", "card" + (isFollowed(g) ? " followed" : ""));
    var top = el("div", "top");
    top.appendChild(el("span", "pill " + g.s, g.s === "live" ? "Live · " + (g.c || "") : g.s === "final" ? "Final" : when(g.t)));
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
    h.appendChild(document.createTextNode(title));
    s.appendChild(h);
    var gr = el("div", "grid" + (big ? " big" : ""));
    items.forEach(function (x) {
      var c = card(x);
      c.classList.add("click"); c.tabIndex = 0; c.setAttribute("role", "button");
      c.setAttribute("aria-label", "Open box score: " + x.g.a[0] + " at " + x.g.h[0]);
      c.onclick = function () { openGame(x); };
      c.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGame(x); } };
      gr.appendChild(c);
    });
    s.appendChild(gr);
    return s;
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
      h.appendChild(el("h3", null, t.name));
      h.appendChild(el("span", "res" + (t.result === "W" ? " win" : ""), t.result === "W" ? "Won" : t.result === "L" ? "Lost" : "Tied"));
      a.appendChild(h);
      a.appendChild(el("div", "rl", t.line));
      a.appendChild(el("p", "rb", t.body));
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
      gr.appendChild(a);
    });
    out.appendChild(gr);
  }

  // Top performers for yesterday's recaps (one box-score fetch per finished game, cached).
  function loadLeaders() {
    if (!S.yesterday) return;
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
    if (S.teams[name]) return;
    S.teams[name] = { loading: true };
    ESPN.findTeam(name).then(function (f) {
      if (!f) return { missing: true };
      return ESPN.fetchTeamInfo(f.lk, f.id);
    }).then(function (i) { S.teams[name] = Object.assign({ done: true }, i); }, function () { S.teams[name] = { done: true, error: true }; })
      .then(function () { if (S.tab === "teams" && !S.view && !S.settings) render(); });
  }
  function gameList(label, gs) {
    var w = el("div", "tgl"); w.appendChild(el("h4", null, label));
    if (!gs.length) { w.appendChild(el("p", "rb", label === "Next" ? "No upcoming games found." : "No results yet.")); return w; }
    gs.forEach(function (g) {
      var r = el("div", "tg");
      r.appendChild(el("span", "tgd", g.s === "final" ? new Date(g.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : when(g.t)));
      r.appendChild(el("span", "tgo", (g.home ? "vs " : "at ") + g.opp));
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
      [r.rank, r.n, r.rec, r.ex, r.k].forEach(function (v, i) { tr.appendChild(el("td", i === 1 ? "l" : null, String(v))); });
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
        if (off) seasonRecap(a, T);
        else {
          a.appendChild(gameList("Next", gs.filter(function (g) { return g.s !== "final"; }).sort(byTime).slice(0, 5)));
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
  function pretty(s) {
    return s.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ").map(function (w) {
      return w === "defenses" ? "Defensemen" : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(" ");
  }
  // A collapsible section. Open/closed choices are remembered while the page is open.
  function sec(title, node, open, fav) {
    var key = (S.view ? S.view.key : "") + "|" + title;
    if (openState[key] !== undefined) open = openState[key];
    var d = el("details", "sec" + (fav ? " fav" : ""));
    if (open) d.open = true;
    d.appendChild(el("summary", null, title));
    var b = el("div", "body"); b.appendChild(node); d.appendChild(b);
    d.addEventListener("toggle", function () { openState[key] = d.open; });
    return d;
  }
  function renderDetail(out) {
    var v = S.view, g = v.x.g, d = v.d, lg = leagueOf(v.x.lk);
    var back = el("button", "back", "← All scores"); back.type = "button"; back.onclick = closeGame;
    var nav = el("div", "navbar"); nav.appendChild(back);
    var shb = el("button", "back", "Share ↗"); shb.type = "button"; shb.onclick = shareGame; nav.appendChild(shb);
    out.appendChild(nav);
    var hd = el("div", "dhead"); hd.appendChild(card(v.x)); out.appendChild(hd);
    if (d === undefined) { out.appendChild(el("p", "rmsg", "Loading box score…")); return; }
    if (d === null) { out.appendChild(el("p", "rmsg", "Could not load the box score right now. Try again in a moment.")); return; }

    var up = g.s === "up", list = [];
    var pv = el("div", "sum");
    pv.appendChild(el("p", null, d.preview || (g.a[0] + " visit " + g.h[0] + " " + when(g.t) + ".")));
    (d.narrative || []).forEach(function (n) {
      var w = el("div", "nar"); w.appendChild(el("h4", null, n.h)); w.appendChild(el("p", null, n.p)); pv.appendChild(w);
    });
    if (d.link) {
      var lw = el("div", "nar"), la = el("a", null, "ESPN preview: " + d.link.text + " ↗");
      la.href = d.link.href; la.target = "_blank"; la.rel = "noopener"; lw.appendChild(la); pv.appendChild(lw);
    }
    var preview = sec("Matchup preview", pv, up, false);
    if (up) list.push(preview);

    if (d.periods) {
      var rows = d.periods.rows.map(function (r) {
        var tot = 0;
        for (var i = 1; i < r.length; i++) if (typeof r[i] === "number") tot += r[i];
        return r.concat([tot]);
      });
      list.push(sec(lg && lg.soccer ? "Score by half" : "Score by period", tbl({ cols: [""].concat(d.periods.labels, ["T"]), rows: rows }), true, false));
    }
    d.tables.filter(function (t) { return t.kind === "team"; }).forEach(function (t) {
      list.push(sec(up ? "Season team stats" : t.title, tbl(t), true, false));
    });

    // Players: followed team first (first three tables open), then the other team.
    var followedAbbr = [g.a, g.h].filter(function (t) { return C.followed.indexOf(t[0]) >= 0; }).map(function (t) { return t[1]; });
    var players = d.tables.filter(function (t) { return t.kind === "players"; }).map(function (t) {
      var name = pretty(t.group);
      if (name === "Players") {
        var ths = t.cols;
        name = ths.indexOf("IP") >= 0 ? "Pitching" : (ths.indexOf("AB") >= 0 || ths.indexOf("H-AB") >= 0 ? "Batting" : name);
      }
      return { title: t.team + " " + name, node: tbl(t), fav: followedAbbr.indexOf(t.team) >= 0 };
    });
    var favs = players.filter(function (p) { return p.fav; }), others = players.filter(function (p) { return !p.fav; });
    favs.forEach(function (p, i) { list.push(sec(p.title, p.node, i < 3, true)); });
    others.forEach(function (p) { list.push(sec(p.title, p.node, !favs.length && !up && list.length < 5, false)); });

    if (d.plays.length) {
      var sc = el("div", "plays"); sc.tabIndex = 0;
      d.plays.forEach(function (p) {
        var r = el("div", "play");
        r.appendChild(el("span", "pt", p.t));
        r.appendChild(el("span", "px", p.x));
        sc.appendChild(r);
      });
      list.push(sec("Recent plays", sc, g.s === "live", false));
    }
    if (!up) list.push(preview);

    var bar = el("div", "allbar");
    var b1 = el("button", null, "Expand all"), b2 = el("button", null, "Collapse all");
    b1.type = b2.type = "button";
    b1.onclick = function () { list.forEach(function (s) { s.open = true; }); };
    b2.onclick = function () { list.forEach(function (s) { s.open = false; }); };
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
    S.view = { x: x, key: key, d: undefined };
    render(); window.scrollTo(0, 0); loadDetail();
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
    if (!items.length) { out.appendChild(notice("Nothing on right now", "No games for this view in the latest update.")); return; }
    var big = S.tab === "pinned";
    var live = items.filter(function (x) { return x.g.s === "live"; });
    var up = items.filter(function (x) { return x.g.s === "up"; }).sort(function (a, b) { return byTime(a.g, b.g); });
    var fin = items.filter(function (x) { return x.g.s === "final"; }).sort(function (a, b) { return byTime(b.g, a.g); });
    [group("Live now", "live", live, big), group("Coming up", "", up, big), group("Final", "", fin, big)].forEach(function (s) { if (s) out.appendChild(s); });
  }

  function stampTick() {
    var s = $("stamp"), d = $("dot");
    if (!S.last) { s.textContent = S.loading ? "Loading scores" : "No scores yet"; d.className = "dot"; return; }
    var m = Math.max(0, Math.round((Date.now() - S.last) / 60000));
    s.textContent = "Updated " + (m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " hr ago");
    d.className = "dot " + (m <= 5 ? "fresh" : "stale");
    var bad = S.failed.map(function (k) { return leagueOf(k).label; });
    $("foot").textContent = (bad.length ? "Could not load: " + bad.join(", ") + ". " : "") +
      "Scores refresh by themselves every minute while a game is live. Tap Refresh any time for the latest.";
  }

  // ---------- loading ----------
  // full = true loads yesterday through the next few days; otherwise just yesterday and today.
  function load(full) {
    if (S.loading) return;
    S.loading = true;
    var btn = $("refresh"); btn.disabled = true; btn.textContent = "Refreshing"; stampTick();
    document.body.classList.add("ld");
    var offsets = [];
    for (var i = -1; i <= (full ? C.daysAhead : 0); i++) offsets.push(i);
    ESPN.fetchScores(offsets).then(function (r) {
      var before = JSON.stringify([S.games, S.yesterday]);
      var prev = {};
      allGames().forEach(function (x) { if (isFollowed(x.g)) prev[x.g.id] = x.g; });
      if (full) S.teams = {};
      LG.forEach(function (l) {
        if (r.failed.indexOf(l.key) >= 0) return;          // keep the last good data for a league that errored
        var byId = {};
        (full ? [] : S.games[l.key]).forEach(function (g) { byId[g.id] = g; });
        r.byLeague[l.key].forEach(function (g) { byId[g.id] = g; });
        S.games[l.key] = trim(Object.keys(byId).map(function (k) { return byId[k]; }));
      });
      S.failed = r.failed;
      S.yesterday = buildYesterday(new Date(r.updated));
      S.last = Date.parse(r.updated) || Date.now();
      var firstLoad = !S.ready;
      S.ready = true;
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
  $("refresh").onclick = function () { load(true); };
  window.addEventListener("hashchange", syncFromHash);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.view) closeGame(); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && Date.now() - S.last > 60000) load(Date.now() - S.last > 600000);
  });
  setInterval(function () { if (!document.hidden && anyLive()) load(false); }, C.liveRefreshSeconds * 1000);
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

  render(); stampTick(); load(true);
})();
