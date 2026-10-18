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

  // One game in the shape the UI uses: {id, lk, s, t, h:[name, abbr, score], a:[...], c, n}
  function normalize(ev, lk) {
    var comp = (ev.competitions && ev.competitions[0]) || {};
    var cs = comp.competitors || [];
    var home = cs.filter(function (c) { return c.homeAway === "home"; })[0];
    var away = cs.filter(function (c) { return c.homeAway === "away"; })[0];
    if (!home || !away) return null;
    var st = stateOf(ev);
    function side(c) {
      var n = st === "up" || c.score == null || c.score === "" ? null : Number(c.score);
      return [c.team.displayName, c.team.abbreviation, n];
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
      var out = { periods: null, tables: [], plays: [], preview: null };
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

      var src = (d.plays && d.plays.length ? d.plays : d.scoringPlays) || [];
      out.plays = src.slice(-25).reverse().map(function (p) {
        var per = p.period && p.period.number != null ? (p.period.displayValue || p.period.number) : "";
        var ck = p.clock && p.clock.displayValue ? p.clock.displayValue : "";
        return { t: [per, ck].filter(Boolean).join(" "), x: p.text || p.shortText || "" };
      }).filter(function (p) { return p.x; });
      return out;
    });
  }

  window.ESPN = { fetchScores: fetchScores, fetchGame: fetchGame, dayKey: dayKey, DAY: DAY };
})();
