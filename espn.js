// Data layer: talks to ESPN's free, unofficial JSON endpoints and returns clean objects.
// ESPN can change these without notice, so everything ESPN-specific lives in this file.
(function () {
  "use strict";
  var C = window.CONFIG;
  var BASE = "https://site.api.espn.com/apis/site/v2/sports";
  var DAY = 86400000;

  function getJson(url) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 8000);
    return fetch(url, { signal: ctl.signal }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  // Calendar date (YYYYMMDD) of an instant in the configured timezone.
  function dayKey(d) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: C.timezone, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(d).replace(/-/g, "");
  }

  function stateOf(ev) {
    var s = ev.status && ev.status.type && ev.status.type.state;
    return s === "in" ? "live" : s === "post" ? "final" : "up";
  }

  // Season record text such as "12-4" from a scoreboard competitor.
  function recOf(c) {
    var rs = c.records || [];
    var r = rs.filter(function (z) { return z.type === "total" || z.type === "standingsoverall" || z.name === "overall"; })[0] || rs[0];
    return r && r.summary ? r.summary : "";
  }

  // One game in the shape the UI uses: {id, lk, s, t, h:[name, abbr, score, record, teamId], a:[...], c, n}
  function normalize(ev, lk) {
    var comp = (ev.competitions && ev.competitions[0]) || {};
    var cs = comp.competitors || [];
    var home = cs.filter(function (c) { return c.homeAway === "home"; })[0];
    var away = cs.filter(function (c) { return c.homeAway === "away"; })[0];
    if (!home || !away) return null;
    var st = stateOf(ev);
    function side(c) {
      var n = st === "up" || c.score == null || c.score === "" ? null : Number(c.score);
      return [c.team.displayName, c.team.abbreviation, n, recOf(c), c.team.id];
    }
    var g = { id: ev.id, lk: lk, s: st, t: ev.date, h: side(home), a: side(away) };
    if (st === "live") g.c = (ev.status.type && ev.status.type.shortDetail) || "";
    var note = comp.notes && comp.notes[0] && comp.notes[0].headline;
    if (note) g.n = note;
    return g;
  }

  // Fetch the given day offsets (0 = today) for every league.
  // Resolves {updated, byLeague:{key:[games]}, failed:[league keys that errored]}.
  function fetchScores(offsets) {
    var now = new Date();
    var days = offsets.map(function (n) { return dayKey(new Date(now.getTime() + n * DAY)); });
    var jobs = [];
    C.leagues.forEach(function (lg) {
      days.forEach(function (d) {
        jobs.push({
          lk: lg.key,
          p: getJson(BASE + "/" + lg.path + "/scoreboard?dates=" + d).then(function (j) {
            return (j.events || []).map(function (e) { return normalize(e, lg.key); }).filter(Boolean);
          }, function () { return null; }),
        });
      });
    });
    return Promise.all(jobs.map(function (j) { return j.p; })).then(function (res) {
      var by = {}, okCount = {};
      C.leagues.forEach(function (lg) { by[lg.key] = []; okCount[lg.key] = 0; });
      res.forEach(function (r, i) {
        if (!r) return;
        okCount[jobs[i].lk]++;
        by[jobs[i].lk] = by[jobs[i].lk].concat(r);
      });
      var failed = C.leagues.filter(function (lg) { return !okCount[lg.key]; }).map(function (lg) { return lg.key; });
      return { updated: now.toISOString(), byLeague: by, failed: failed };
    });
  }

  function labelOf(lk) { return C.leagues.filter(function (l) { return l.key === lk; })[0]; }
  function cell(v) { return v == null || v === "" ? "–" : String(v); }

  // Box score, player tables, plays and a matchup preview for one game.
  function fetchGame(lk, id) {
    var lg = labelOf(lk);
    return getJson(BASE + "/" + lg.path + "/summary?event=" + encodeURIComponent(id)).then(function (d) {
      var out = { periods: null, tables: [], plays: [], preview: null, leaders: [] };
      var box = d.boxscore || {};
      var comp = d.header && d.header.competitions && d.header.competitions[0];
      var cs = (comp && comp.competitors) || [];
      var away = cs.filter(function (c) { return c.homeAway === "away"; })[0];
      var home = cs.filter(function (c) { return c.homeAway === "home"; })[0];

      if (away && home) {
        var la = away.linescores || [], lh = home.linescores || [], n = Math.max(la.length, lh.length);
        if (n) {
          var labels = [];
          for (var i = 0; i < n; i++) labels.push(String(i + 1));
          var val = function (ls, k) { return ls[k] ? Number(ls[k].displayValue != null ? ls[k].displayValue : ls[k].value) : null; };
          var row = function (c, ls) { return [c.team.abbreviation].concat(labels.map(function (_, k) { return val(ls, k); })); };
          out.periods = { labels: labels, rows: [row(away, la), row(home, lh)] };
        }
        var rec = function (c) {
          var r = c.record && (c.record.filter(function (z) { return z.type === "total"; })[0] || c.record[0]);
          return r && (r.summary || r.displayValue) ? " (" + (r.summary || r.displayValue) + ")" : "";
        };
        var s = away.team.displayName + rec(away) + " visit " + home.team.displayName + rec(home) + ".";
        var pc = d.pickcenter && d.pickcenter[0];
        if (pc && pc.details) s += " Line: " + pc.details + (pc.overUnder ? ", over/under " + pc.overUnder : "") + ".";
        out.preview = s;
      }

      var tm = box.teams || [];
      if (tm.length >= 2) {
        var mp = function (t) { var m = {}; (t.statistics || []).forEach(function (z) { m[z.label || z.name] = z.displayValue; }); return m; };
        var ma = mp(tm[0]), mh = mp(tm[1]);
        var keys = Object.keys(ma).concat(Object.keys(mh).filter(function (k) { return !(k in ma); }));
        if (keys.length) {
          out.tables.push({
            kind: "team", title: "Team stats",
            cols: ["", tm[0].team.abbreviation, tm[1].team.abbreviation],
            rows: keys.map(function (k) { return [k, cell(ma[k]), cell(mh[k])]; }),
          });
        }
      }

      // One table per team per stat group; columns come straight from the feed,
      // so each sport gets its own tailored table (passing, skaters, batting, ...).
      (box.players || []).forEach(function (tp) {
        var abbr = tp.team && tp.team.abbreviation;
        (tp.statistics || []).forEach(function (cat) {
          var labs = cat.labels || cat.keys || [], ath = cat.athletes || [];
          if (!labs.length || !ath.length) return;
          out.tables.push({
            kind: "players", team: abbr, group: cat.type || cat.displayName || cat.name || "players",
            cols: ["Player"].concat(labs),
            rows: ath.map(function (a) { return [(a.athlete && a.athlete.displayName) || "–"].concat((a.stats || []).map(cell)); }),
          });
        });
      });

      // Top performers per team (passing leader, top scorer, ...), straight from the feed.
      (d.leaders || []).forEach(function (tl) {
        var ab = tl.team && tl.team.abbreviation;
        (tl.leaders || []).forEach(function (cat) {
          var top = cat.leaders && cat.leaders[0];
          if (top && top.athlete) out.leaders.push({ team: ab, cat: cat.displayName || cat.name || "", name: top.athlete.displayName, line: top.displayValue || "" });
        });
      });

      var src = (d.plays && d.plays.length ? d.plays : d.scoringPlays) || [];
      out.plays = src.slice(-25).reverse().map(function (p) {
        var per = p.period && p.period.number != null ? (p.period.displayValue || p.period.number) : "";
        var ck = p.clock && p.clock.displayValue ? p.clock.displayValue : "";
        return { t: [per, ck].filter(Boolean).join(" "), x: p.text || p.shortText || "" };
      }).filter(function (p) { return p.x; });
      return out;
    });
  }

  // ---------- teams, standings and schedules ----------
  var V2 = "https://site.api.espn.com/apis/v2/sports";
  var teamsP = null;
  // {leagueKey: [{id, name}]}. Cached for a week so it is only fetched occasionally.
  function fetchTeams() {
    if (teamsP) return teamsP;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem("sb-teams") || "null"); } catch (e) {}
    if (cached && Date.now() - cached.at < 7 * DAY && cached.n === C.leagues.length) return (teamsP = Promise.resolve(cached.v));
    teamsP = Promise.all(C.leagues.filter(function (l) { return !l.noTeams; }).map(function (l) {
      // ESPN's /teams endpoint blocks browsers (CORS); the standings feed lists every team too.
      return getJson(V2 + "/" + l.path + "/standings").then(function (j) {
        var seen = {}, ts = [];
        walk(j, []).forEach(function (g) { g.entries.forEach(function (e) { if (!seen[e.team.id]) { seen[e.team.id] = 1; ts.push({ id: e.team.id, name: e.team.displayName }); } }); });
        return [l.key, ts];
      }, function () { return [l.key, []]; });
    })).then(function (rows) {
      var v = {};
      rows.forEach(function (r) { v[r[0]] = r[1]; });
      if (rows.every(function (r) { return r[1].length; })) {
        try { localStorage.setItem("sb-teams", JSON.stringify({ at: Date.now(), n: C.leagues.length, v: v })); } catch (e) {}
      }
      return v;
    });
    return teamsP;
  }
  function findTeam(name) {
    return fetchTeams().then(function (v) {
      for (var k in v) for (var i = 0; i < v[k].length; i++) if (v[k][i].name === name) return { lk: k, id: v[k][i].id };
      return null;
    });
  }

  function walk(n, out) {
    if (n.standings && n.standings.entries) out.push({ name: n.name, entries: n.standings.entries });
    (n.children || []).forEach(function (c) { walk(c, out); });
    return out;
  }
  function stat(e, name) {
    var s = (e.stats || []).filter(function (z) { return z.name === name || z.type === name; })[0];
    return s ? s.displayValue : null;
  }
  function findStanding(j, tid) {
    var groups = walk(j, []);
    for (var gi = 0; gi < groups.length; gi++) {
      var es = groups[gi].entries, idx = -1;
      es.forEach(function (e, i) { if (String(e.team.id) === String(tid)) idx = i; });
      if (idx < 0) continue;
      var seedOf = function (e) { return parseFloat(stat(e, "playoffSeed") || stat(e, "rank")); };
      var rank = es.every(function (e) { return isFinite(seedOf(e)); }) ? seedOf(es[idx]) : idx + 1;
      var e = es[idx];
      return { group: groups[gi].name, rank: rank, record: stat(e, "overall") || (stat(e, "wins") + "-" + stat(e, "losses")), streak: stat(e, "streak") };
    }
    return null;
  }
  function parseSchedule(j) {
    var me = String((j.team || {}).id);
    var num = function (c) { var s = c.score; if (s == null) return null; var v = typeof s === "object" ? (s.displayValue != null ? s.displayValue : s.value) : s; return v === "" || v == null ? null : Number(v); };
    return (j.events || []).map(function (ev) {
      var comp = (ev.competitions || [])[0] || {};
      var cs = comp.competitors || [];
      var mine = cs.filter(function (c) { return String(c.team.id) === me; })[0];
      var opp = cs.filter(function (c) { return String(c.team.id) !== me; })[0];
      if (!mine || !opp) return null;
      var st = ((comp.status || ev.status || {}).type || {}).state;
      return { id: ev.id, t: ev.date || comp.date, s: st === "in" ? "live" : st === "post" ? "final" : "up", opp: opp.team.displayName, home: mine.homeAway === "home", my: num(mine), op: num(opp) };
    }).filter(Boolean);
  }
  // Standing (rank, record, streak) and schedule for one team.
  function fetchTeamInfo(lk, tid) {
    var lg = labelOf(lk);
    var st = getJson(V2 + "/" + lg.path + "/standings").then(function (j) { return findStanding(j, tid); }, function () { return null; });
    var sc = getJson(BASE + "/" + lg.path + "/teams/" + tid + "/schedule").then(parseSchedule, function () { return []; });
    return Promise.all([st, sc]).then(function (r) { return { standing: r[0], games: r[1] }; });
  }

  window.ESPN = { fetchScores: fetchScores, fetchGame: fetchGame, fetchTeams: fetchTeams, findTeam: findTeam, fetchTeamInfo: fetchTeamInfo, dayKey: dayKey, DAY: DAY };
})();
