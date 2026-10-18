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
  // ESPN serves 500px logos; ask its image resizer for a small one so pages stay light.
  function logoOf(t) {
    var u = t && (t.logo || (t.logos && t.logos[0] && t.logos[0].href));
    if (!u) return "";
    var m = /^https?:\/\/a\.espncdn\.com(\/i\/teamlogos\/.+)$/.exec(u);
    return m ? "https://a.espncdn.com/combiner/i?img=" + m[1] + "&w=64&h=64" : u;
  }
  function normalize(ev, lk) {
    var comp = (ev.competitions && ev.competitions[0]) || {};
    var cs = comp.competitors || [];
    var home = cs.filter(function (c) { return c.homeAway === "home"; })[0];
    var away = cs.filter(function (c) { return c.homeAway === "away"; })[0];
    if (!home || !away) return null;
    var st = stateOf(ev);
    function side(c) {
      var n = st === "up" || c.score == null || c.score === "" ? null : Number(c.score);
      return [c.team.displayName, c.team.abbreviation, n, recOf(c), c.team.id, logoOf(c.team)];
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

  // Written-out preview sections built from pregame data: form, odds, players to watch, injuries, setting.
  function narrative(d, away, home) {
    var secs = [];
    var abbrOf = {}; abbrOf[String(away.team.id)] = away.team.displayName; abbrOf[String(home.team.id)] = home.team.displayName;

    // Recent form from each team's last five games.
    var forms = [], moods = [];
    (d.lastFiveGames || []).forEach(function (lf) {
      var evs = (lf.events || []).slice().sort(function (a, b) { return new Date(a.gameDate) - new Date(b.gameDate); });
      var res = evs.map(function (e) { return e.gameResult; }).filter(Boolean);
      if (!res.length) return;
      var w = res.filter(function (r) { return r === "W"; }).length, l = res.filter(function (r) { return r === "L"; }).length, t = res.length - w - l;
      var last = evs[evs.length - 1], ch = res[res.length - 1], run = 0;
      for (var i = res.length - 1; i >= 0 && res[i] === ch; i--) run++;
      var mine = String(last.homeTeamId) === String(lf.team.id) ? last.homeTeamScore : last.awayTeamScore;
      var theirs = String(last.homeTeamId) === String(lf.team.id) ? last.awayTeamScore : last.homeTeamScore;
      var score = Math.max(mine, theirs) + "-" + Math.min(mine, theirs);
      var verb = ch === "W" ? "beating " : ch === "L" ? "losing to " : "drawing with ";
      var line = lf.team.displayName + " have gone " + w + "-" + l + (t ? "-" + t : "") + " in their last " + res.length + " (" + res.join("") + "), most recently " + verb + (last.opponent && last.opponent.displayName) + " " + score + ".";
      if (run >= 2 && ch !== "T") { line += " That is " + run + " straight " + (ch === "W" ? "wins." : "losses."); moods.push({ name: lf.team.displayName, ch: ch, run: run }); }
      forms.push(line);
    });
    if (forms.length) secs.push({ h: "Recent form", p: forms.join(" ") });

    // Odds and ESPN's predictor.
    var pc = d.pickcenter && d.pickcenter[0], odds = [];
    if (pc && pc.details) odds.push("The line is " + pc.details + (pc.overUnder ? " with a total of " + pc.overUnder : "") + (pc.provider && pc.provider.name ? " (" + pc.provider.name + ")" : "") + ".");
    var pr = d.predictor;
    if (pr && pr.homeTeam && pr.awayTeam) {
      var hp = parseFloat(pr.homeTeam.gameProjection), ap = parseFloat(pr.awayTeam.gameProjection);
      if (isFinite(hp) && isFinite(ap) && hp !== ap) {
        var top = hp > ap ? pr.homeTeam : pr.awayTeam;
        odds.push("ESPN's matchup predictor gives " + abbrOf[String(top.id)] + " a " + Math.max(hp, ap) + "% chance.");
      }
    }
    if (odds.length) secs.push({ h: "Odds and outlook", p: odds.join(" ") });

    // Momentum angle on top.
    var up = moods.filter(function (m) { return m.ch === "W"; })[0], down = moods.filter(function (m) { return m.ch === "L"; })[0];
    if (up && down) secs.unshift({ h: "Storyline", p: up.name + " come in hot, while " + down.name + " are trying to stop a slide. Something has to give." });
    else if (up) secs.unshift({ h: "Storyline", p: up.name + " bring momentum into this one." });
    else if (down) secs.unshift({ h: "Storyline", p: down.name + " are looking to snap a losing streak." });

    // Season leaders.
    var ld = [];
    (d.leaders || []).forEach(function (tl) {
      var parts = (tl.leaders || []).slice(0, 2).map(function (c) {
        var top = c.leaders && c.leaders[0];
        return top && top.athlete ? top.athlete.displayName + " (" + (c.displayName || c.name) + ": " + top.displayValue + ")" : null;
      }).filter(Boolean);
      if (parts.length && tl.team) ld.push(tl.team.abbreviation + ": " + parts.join(", "));
    });
    if (ld.length) secs.push({ h: "Players to watch", p: ld.join(". ") + "." });

    // Injuries that matter this week.
    var inj = [];
    (d.injuries || []).forEach(function (ti) {
      var list = (ti.injuries || []).filter(function (i) { return /out|doubtful|questionable|day/i.test(i.status || "") && !/reserve/i.test(i.status || ""); }).slice(0, 4).map(function (i) {
        var pos = i.athlete && i.athlete.position && i.athlete.position.abbreviation;
        return i.athlete.displayName + " (" + (pos ? pos + ", " : "") + i.status + ")";
      });
      if (list.length && ti.team) inj.push(ti.team.abbreviation + ": " + list.join(", "));
    });
    if (inj.length) secs.push({ h: "Injuries", p: inj.join(". ") + "." });

    // Series, venue, weather and TV.
    var ss = d.seasonseries && d.seasonseries[0] && d.seasonseries[0].summary;
    var gi = d.gameInfo || {}, v = gi.venue, set = [];
    if (ss) set.push("Season series: " + ss + ".");
    if (v && v.fullName) set.push("At " + v.fullName + (v.address && v.address.city ? " in " + v.address.city : "") + (gi.weather && gi.weather.temperature ? " (" + gi.weather.temperature + "°F)" : "") + ".");
    var bc = ((d.header && d.header.competitions && d.header.competitions[0] && d.header.competitions[0].broadcasts) || []).map(function (b) { return b.media && b.media.shortName; }).filter(Boolean);
    if (bc.length) set.push("TV: " + bc.filter(function (x, i) { return bc.indexOf(x) === i; }).join(", ") + ".");
    if (set.length) secs.push({ h: "Where and when", p: set.join(" ") });
    return secs;
  }

  function recapOf(d, away, home, leaders) {
    var as = Number(away.score), hs = Number(home.score);
    if (!isFinite(as) || !isFinite(hs)) return null;
    var win = hs > as ? home : away, lose = win === home ? away : home;
    var ws = Math.max(as, hs), ls = Math.min(as, hs), tie = as === hs;
    var secs = [];
    var art = d.article;
    var head = (art && art.headline) || (tie ? away.team.displayName + " and " + home.team.displayName + " tied " + as + "-" + hs + "." : win.team.displayName + " beat " + lose.team.displayName + " " + ws + "-" + ls + ".");
    // ESPN's description is cut off mid-sentence, so take the opening paragraph of the article itself.
    var lede = "";
    if (art && art.story) {
      var txt = String(art.story).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"');
      var paras = txt.split(/\n\s*\n/).map(function (z) { return z.replace(/\s+/g, " ").trim(); }).filter(function (z) { return z.length > 40; });
      if (paras[0]) lede = paras[0].replace(/^[A-Z][A-Za-z.,' ]{2,40}\s--\s*/, "").replace(/^[\s—–-]+/, "");
    }
    if (!lede && art && art.description) lede = String(art.description).replace(/^[\s—–-]+/, "").replace(/\.\.\.$/, "…");
    if (lede) secs.push({ h: "The story", p: lede });

    // How it unfolded: lead changes and biggest leads from the scoring plays.
    var sp = (d.scoringPlays || []).filter(function (p) { return isFinite(Number(p.awayScore)) && isFinite(Number(p.homeScore)); });
    if (sp.length > 2 && !tie) {
      var lead = 0, changes = 0, maxW = 0, maxL = 0, ties = 0, gp = null, pw = false;
      sp.forEach(function (p) {
        var m = Number(p.homeScore) - Number(p.awayScore), side = m === 0 ? 0 : m > 0 ? 1 : -1;
        if (side === 0) ties++;
        if (side !== 0 && lead !== 0 && side !== lead) changes++;
        if (side !== 0) lead = side;
        var wm = win === home ? m : -m;
        if (wm > 0 && !pw) gp = p;
        pw = wm > 0;
        if (wm > maxW) maxW = wm;
        if (-wm > maxL) maxL = -wm;
      });
      var line = [];
      if (changes === 0 && maxL === 0) line.push(win.team.displayName + " led from the first score to the last.");
      else line.push("The lead changed hands " + changes + (changes === 1 ? " time" : " times") + ".");
      if (maxW) line.push(win.team.abbreviation + "'s biggest lead was " + maxW + (maxW === 1 ? " point" : " points") + (maxL ? ", and " + lose.team.abbreviation + " led by as many as " + maxL + "." : "."));
      // The score that put the winner ahead for good.
      if (gp && gp.text) {
        var gt = [gp.period && gp.period.number != null ? (gp.period.displayValue || gp.period.number) : "", gp.clock && gp.clock.displayValue].filter(Boolean).join(" ");
        line.push("The go-ahead score: " + gp.text + (gt ? " (" + gt + ")" : "") + ".");
      }
      secs.push({ h: "How it unfolded", p: line.join(" ") });
    }

    // Top performers from the feed's game leaders (up to three per team).
    var by = {}, order = [];
    leaders.forEach(function (l) {
      if (!by[l.team]) { by[l.team] = []; order.push(l.team); }
      if (by[l.team].length < 3) by[l.team].push(l.name + " " + l.line + (l.cat ? " (" + l.cat.replace(/ Leader$/i, "") + ")" : ""));
    });
    if (order.length) secs.push({ h: "Top performers", p: order.map(function (t) { return t + ": " + by[t].join("; ") + "."; }).join(" ") });

    return { head: head, secs: secs };
  }

  // Box score, player tables, plays and a matchup preview (or, once final, a recap) for one game.
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
        var split = function (c, t) { var r = (c.record || []).filter(function (z) { return z.type === t; })[0]; return r ? (r.summary || r.displayValue) : ""; };
        var s = away.team.displayName + rec(away) + " visit " + home.team.displayName + rec(home) + ".";
        if (split(away, "road") && split(home, "home")) s += " " + away.team.abbreviation + " is " + split(away, "road") + " on the road; " + home.team.abbreviation + " is " + split(home, "home") + " at home.";
        out.preview = s;
        out.narrative = narrative(d, away, home);
        var art = d.article;
        if (art && art.headline && art.links && art.links.web && art.links.web.href) out.link = { text: art.headline, href: art.links.web.href };
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

      // Finished games: a written recap from ESPN's own recap blurb, the scoring flow and the game leaders.
      if (comp && comp.status && comp.status.type && comp.status.type.completed && away && home) out.recap = recapOf(d, away, home, out.leaders);

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
  function findStanding(j, tid, usePts) {
    var groups = walk(j, []);
    for (var gi = 0; gi < groups.length; gi++) {
      var es = groups[gi].entries, idx = -1;
      es.forEach(function (e, i) { if (String(e.team.id) === String(tid)) idx = i; });
      if (idx < 0) continue;
      var seedOf = function (e) { return parseFloat(stat(e, "playoffSeed") || stat(e, "rank")); };
      var rank = es.every(function (e) { return isFinite(seedOf(e)); }) ? seedOf(es[idx]) : idx + 1;
      var e = es[idx];
      // Whole table for the standings view: sorted by seed/rank, with a points or win% column.
      var hasPts = !!usePts;
      var rows = es.map(function (x, i) {
        var sd = seedOf(x);
        var rec = (stat(x, "overall") || (stat(x, "wins") + "-" + stat(x, "losses"))).split(",")[0];
        var ex = hasPts ? stat(x, "points") : (stat(x, "winPercent") || stat(x, "gamesBehind"));
        return { n: x.team.abbreviation || x.team.shortDisplayName || x.team.displayName, rank: isFinite(sd) ? sd : i + 1, rec: rec, ex: ex == null ? "" : ex, k: stat(x, "streak") || "", lg: logoOf(x.team), me: i === idx };
      }).sort(function (p, q) { return p.rank - q.rank; });
      return { group: groups[gi].name, rank: rank, record: stat(e, "overall") || (stat(e, "wins") + "-" + stat(e, "losses")), streak: stat(e, "streak"), logo: logoOf(e.team), rows: rows, exLabel: hasPts ? "PTS" : "PCT" };
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
      return { id: ev.id, st: (ev.seasonType || {}).type, t: ev.date || comp.date, s: st === "in" ? "live" : st === "post" ? "final" : "up", opp: opp.team.displayName, home: mine.homeAway === "home", my: num(mine), op: num(opp) };
    }).filter(Boolean);
  }
  // Standing (rank, record, streak) and schedule for one team.
  function fetchTeamInfo(lk, tid) {
    var lg = labelOf(lk);
    var st = getJson(V2 + "/" + lg.path + "/standings").then(function (j) { return findStanding(j, tid, /hockey|australian|soccer/.test(lg.path)); }, function () { return null; });
    var url = BASE + "/" + lg.path + "/teams/" + tid + "/schedule";
    // In the offseason ESPN's default schedule can be just the playoffs, so also pull the regular season then.
    var sc = getJson(url).then(parseSchedule, function () { return []; }).then(function (gs) {
      if (!gs.length || gs.some(function (g) { return g.st === 2; })) return gs;
      return getJson(url + "?seasontype=2").then(parseSchedule, function () { return []; }).then(function (reg) {
        var seen = {};
        return reg.concat(gs).filter(function (g) { if (seen[g.id]) return false; seen[g.id] = 1; return true; });
      });
    });
    return Promise.all([st, sc]).then(function (r) { return { standing: r[0], games: r[1] }; });
  }

  window.ESPN = { fetchScores: fetchScores, fetchGame: fetchGame, fetchTeams: fetchTeams, findTeam: findTeam, fetchTeamInfo: fetchTeamInfo, dayKey: dayKey, DAY: DAY };
})();
