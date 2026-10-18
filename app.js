// UI: state, rendering and routing. No ESPN-specific knowledge lives here (see espn.js).
(function () {
  "use strict";
  var C = window.CONFIG, LG = C.leagues, DAY = ESPN.DAY;
  var $ = function (id) { return document.getElementById(id); };

  var S = { tab: "pinned", games: {}, yesterday: null, ready: false, loading: false, last: 0, failed: [], view: null, pushed: false };
  var openState = {};   // remembers which detail sections you opened or closed
  LG.forEach(function (l) { S.games[l.key] = []; });
  try { var saved = localStorage.getItem("sb-tab"); if (saved) S.tab = saved; } catch (e) {}

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
    return isNaN(d) ? "" : d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
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
        name: name, played: true, result: res,
        line: hi[0][0] + " " + hi[0][2] + ", " + hi[1][0] + " " + hi[1][2],
        body: (res === "W" ? "Won " : res === "L" ? "Lost " : "Tied ") + Math.max(mine[2], opp[2]) + "-" + Math.min(mine[2], opp[2]) +
          (home ? " at home against " : " on the road at ") + opp[0] + "." + nextUp(all, name),
      };
    });
    return { date: label, teams: teams };
  }

  // ---------- list view ----------
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
      tm.appendChild(el("span", "ab", r[0][1]));
      tm.appendChild(el("span", "nm", r[0][0]));
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
      gr.appendChild(a);
    });
    out.appendChild(gr);
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
    out.appendChild(back);
    var hd = el("div", "dhead"); hd.appendChild(card(v.x)); out.appendChild(hd);
    if (d === undefined) { out.appendChild(el("p", "rmsg", "Loading box score…")); return; }
    if (d === null) { out.appendChild(el("p", "rmsg", "Could not load the box score right now. Try again in a moment.")); return; }

    var up = g.s === "up", list = [];
    var pv = el("div", "sum");
    pv.appendChild(el("p", null, d.preview || (g.a[0] + " visit " + g.h[0] + " " + when(g.t) + ".")));
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
    var tabs = [["pinned", "Following", fol.length], ["yesterday", "What happened yesterday", null], ["all", "All", all.length]]
      .concat(LG.map(function (l) { return [l.key, l.label, S.games[l.key].length]; }));
    tabs.forEach(function (t) {
      var b = el("button", "tab"); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", t[0] === S.tab ? "true" : "false");
      b.appendChild(document.createTextNode(t[1]));
      if (t[2] != null) b.appendChild(el("span", "n", String(t[2])));
      b.onclick = function () {
        S.tab = t[0]; S.view = null; clearHash();
        try { localStorage.setItem("sb-tab", S.tab); } catch (e) {}
        render();
      };
      rail.appendChild(b);
    });

    var out = $("out"); out.textContent = "";
    var about = "Following: " + C.followed.join(", ") + ".";
    if (C.noFeed.length) about += " " + C.noFeed.join(", ") + " " + (C.noFeed.length > 1 ? "are" : "is") + " on the list, but there is no data feed for " + (C.noFeed.length > 1 ? "them" : "it") + " yet.";
    $("about").textContent = about;

    if (!S.ready) { out.appendChild(notice("Scores will show up here", "Live games, finals and what is next for your teams load in a moment. Hit Refresh if nothing appears.")); return; }
    if (S.view) { renderDetail(out); return; }
    if (S.tab === "yesterday") { renderYesterday(out); return; }

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
    var offsets = [];
    for (var i = -1; i <= (full ? C.daysAhead : 0); i++) offsets.push(i);
    ESPN.fetchScores(offsets).then(function (r) {
      var before = JSON.stringify([S.games, S.yesterday]);
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
      var changed = JSON.stringify([S.games, S.yesterday]) !== before;

      if (S.view) {
        var v = S.view, nx = allGames().filter(function (q) { return q.lk === v.x.lk && q.g.id === v.x.g.id; })[0];
        if (nx) {
          var moved = JSON.stringify(nx.g) !== JSON.stringify(v.x.g);
          v.x = nx;
          if (nx.g.s !== "final") loadDetail();
          if (moved) render();
        }
      } else if (changed || firstLoad) {
        render();
      }
      if (firstLoad) syncFromHash();
    }).catch(function () {
      $("stamp").textContent = "Could not reach the score server"; $("dot").className = "dot stale";
    }).then(function () {
      S.loading = false; btn.disabled = false; btn.textContent = "Refresh"; stampTick();
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
  render(); stampTick(); load(true);
})();
