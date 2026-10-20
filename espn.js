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
      return [c.team.displayName, c.team.abbreviation, n, recOf(c), c.team.id, logoOf(c.team), c.curatedRank && c.curatedRank.current <= 25 ? c.curatedRank.current : 0];
    }
    var g = { id: ev.id, lk: lk, s: st, t: ev.date, h: side(home), a: side(away) };
    if (st === "live") {
      g.c = (ev.status.type && ev.status.type.shortDetail) || "";
      // Live situation (football: down, distance, ball spot, red zone; baseball: bases, outs, count), kept tiny.
      var q = comp.situation;
      if (q) {
        var z = {};
        if (q.lastPlay && q.lastPlay.text) z.lp = q.lastPlay.text;
        if (q.possession) z.p = String(q.possession);
        if (q.downDistanceText) z.dd = q.downDistanceText;
        if (q.possessionText) z.pt = q.possessionText;
        if (q.isRedZone) z.rz = 1;
        if (q.homeTimeouts != null) z.ht = q.homeTimeouts; if (q.awayTimeouts != null) z.at = q.awayTimeouts;
        if (q.outs != null) { z.o = q.outs; z.b = [q.onFirst ? 1 : 0, q.onSecond ? 1 : 0, q.onThird ? 1 : 0]; z.bs = (q.balls || 0) + "-" + (q.strikes || 0); }
        if (q.batter && q.batter.athlete) z.bat = q.batter.athlete.shortName || q.batter.athlete.displayName;
        if (q.pitcher && q.pitcher.athlete) z.pit = q.pitcher.athlete.shortName || q.pitcher.athlete.displayName;
        if (Object.keys(z).length) g.q = z;
      }
    }
    else if (st === "final" && /OT|SO\b|ET\b|AET|Pen/i.test((ev.status.type && ev.status.type.shortDetail) || "")) g.o = 1;
    var note = comp.notes && comp.notes[0] && comp.notes[0].headline;
    if (note) g.n = note;
    var bc = (comp.broadcasts && comp.broadcasts[0]) || (comp.geoBroadcasts && comp.geoBroadcasts[0]);
    var bn = bc && ((bc.names && bc.names[0]) || (bc.media && bc.media.shortName));
    if (bn) g.b = bn;
    return g;
  }

  // Event sports (UFC cards, race weekends): one game-shaped record per event, with the fights or sessions in x.
  function evState(c) { var s = c.status && c.status.type && c.status.type.state; return s === "in" ? "in" : s === "post" ? "post" : "pre"; }
  function byOrder(c) { return (c.competitors || []).slice().sort(function (p, q) { return (p.order || 0) - (q.order || 0); }); }
  function cname(c) { return (c.athlete && (c.athlete.displayName || c.athlete.fullName)) || (c.team && c.team.displayName) || "–"; }
  function normEvent(ev, lg) {
    var comps = ev.competitions || [], st = stateOf(ev);
    var v = ev.venues && ev.venues[0] || (comps[0] && comps[0].venue) || null;
    var venue = v ? [v.fullName, v.address && v.address.city].filter(Boolean).join(", ") : "";
    var g = { id: ev.id, lk: lg.key, s: st, t: ev.date, h: [ev.name, "", null, "", ""], a: ["", "", null, "", ""], ev: lg.kind };
    if (st === "live") g.c = (ev.status.type && ev.status.type.shortDetail) || "";
    var x = { venue: venue };
    if (lg.kind === "mma") {
      x.fights = comps.map(function (c) {
        var cs = byOrder(c), win = -1;
        cs.forEach(function (z, i) { if (z.winner) win = i; });
        var m = "";
        (c.details || []).forEach(function (d) {
          var t = d.type && d.type.text || "", mm = /Winner\s+(\w+)/i.exec(t);
          if (mm && !m) m = /ko/i.test(mm[1]) ? "KO/TKO" : /sub/i.test(mm[1]) ? "Submission" : /dec/i.test(mm[1]) ? "Decision" : mm[1];
        });
        var rec = function (z) { var r = (z.records || []).filter(function (q) { return q.type === "total"; })[0]; return r ? r.summary : ""; };
        var stt = c.status || {};
        return { w: (c.type && (c.type.abbreviation || c.type.text)) || "", n: cs.map(cname), r: cs.map(rec), win: win, s: evState(c), m: m, rd: stt.period || 0, tm: stt.displayClock || "", live: stt.type && stt.type.shortDetail || "", ft: !!stt.featured };
      }).reverse();
    } else if (lg.kind === "golf") {
      var c0 = comps[0] || {}, gst = c0.status || ev.status || {}, rows = [];
      (c0.competitors || []).forEach(function (z) {
        var ls = (z.linescores || []).filter(function (l) { return l && l.period != null; }), last = ls[ls.length - 1], hl = last && last.linescores ? last.linescores.length : 0;
        var rd = ls.map(function (l) { var v = l.value != null ? Number(l.value) : null; return v != null && isFinite(v) ? v : null; });
        rows.push({ n: cname(z), o: z.order || 999, sc: z.score != null ? String(z.score) : "", r: rd, rp: ls.map(function (l) { return l.displayValue != null ? String(l.displayValue) : ""; }), th: hl > 0 && hl < 18 ? hl : 0, fl: (z.athlete && z.athlete.flag && z.athlete.flag.alt) || "" });
      });
      rows.sort(function (p, q) { return p.o - q.o; });
      rows.forEach(function (r, i) {
        var f = i; while (f > 0 && rows[f - 1].sc === r.sc) f--;
        var e = i; while (e < rows.length - 1 && rows[e + 1].sc === r.sc) e++;
        r.p = (e > f ? "T" : "") + (f + 1);
      });
      x.rows = rows.map(function (r) { return [r.n, r.p, r.sc, r.r, r.rp, r.th, r.fl]; });
      x.rnd = gst.period || 0; x.det = (gst.type && (gst.type.detail || gst.type.shortDetail)) || "";
      x.end = ev.endDate || "";
    } else {
      x.sess = comps.map(function (c) {
        var s = evState(c);
        return { n: (c.type && (c.type.abbreviation || c.type.text)) || "Race", s: s, t: c.date, rows: s === "pre" ? [] : byOrder(c).map(function (z, i) { return [z.order || i + 1, cname(z)]; }) };
      });
    }
    var pp = {};
    if (x.fights) x.fights.forEach(function (f) { f.n.forEach(function (n) { if (n && n !== "–") pp[n] = 1; }); });
    if (x.sess) x.sess.forEach(function (z) { z.rows.forEach(function (r) { pp[r[1]] = 1; }); });
    if (x.rows) x.rows.forEach(function (r) { pp[r[0]] = 1; });
    g.pp = Object.keys(pp);
    g.x = x;
    return g;
  }

  // Fetch the given day offsets (0 = today) for every league.
  // Resolves {updated, byLeague:{key:[games]}, failed:[league keys that errored]}.
  function fetchScores(offsets, only) {
    var now = new Date();
    var LGS = only ? C.leagues.filter(function (l) { return only.indexOf(l.key) >= 0; }) : C.leagues;
    var days = offsets.map(function (n) { return dayKey(new Date(now.getTime() + n * DAY)); });
    var jobs = [];
    LGS.forEach(function (lg) {
      if (lg.kind) {
        var rg = lg.range || [-7, 14];
        jobs.push({
          lk: lg.key,
          p: getJson(BASE + "/" + lg.path + "/scoreboard?dates=" + dayKey(new Date(now.getTime() + rg[0] * DAY)) + "-" + dayKey(new Date(now.getTime() + rg[1] * DAY))).then(function (j) {
            return (j.events || []).map(function (e) { return normEvent(e, lg); }).filter(Boolean);
          }, function () { return null; }),
        });
        return;
      }
      // Team sports only answer one day per request (a dates=A-B range comes back empty), so it stays one call per day.
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
      var failed = LGS.filter(function (lg) { return !okCount[lg.key]; }).map(function (lg) { return lg.key; });
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

  function recapOf(d, away, home, leaders, lg) {
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
        var pn = gp.period && Number(gp.period.number), ck = gp.clock && gp.clock.displayValue, when = "";
        if (pn) {
          var sfx = ["th", "st", "nd", "rd"][(pn % 100 > 10 && pn % 100 < 14) ? 0 : pn % 10 < 4 ? pn % 10 : 0];
          var unit = /hockey/.test(lg.path) ? "period" : /baseball/.test(lg.path) ? "inning" : /soccer/.test(lg.path) ? "half" : "quarter";
          if (pn > (unit === "quarter" ? 4 : unit === "period" ? 3 : unit === "half" ? 2 : 99)) when = "in overtime";
          else when = "in the " + pn + sfx + " " + unit;
          if (ck && unit !== "inning") when = ck + " left " + when;
        }
        line.push("The go-ahead score: " + gp.text + (when ? " (" + when + ")" : "") + ".");
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

  // "Get caught up" for a game in progress: where it stands, how each period went, how the lead has moved, the latest scores.
  function catchOf(d, away, home, leaders, lg, st) {
    var A = away.team, H = home.team, as = Number(away.score), hs = Number(home.score), secs = [];
    var det = (st.type && (st.type.detail || st.type.shortDetail)) || "In progress", tie = as === hs, ld = as > hs ? A : H;
    var head = det + ": " + (tie ? A.displayName + " and " + H.displayName + " are tied " + as + "-" + hs + "." : ld.displayName + " lead " + Math.max(as, hs) + "-" + Math.min(as, hs) + ".");
    var unit = /hockey/.test(lg.path) ? "P" : /baseball/.test(lg.path) ? "Inn " : /soccer/.test(lg.path) ? "H" : "Q";
    var la = away.linescores || [], lh = home.linescores || [], n = Math.max(la.length, lh.length), parts = [];
    var val = function (ls, k) { var z = ls[k]; if (!z) return null; var v = Number(z.displayValue != null ? z.displayValue : z.value); return isFinite(v) ? v : null; };
    for (var i = 0; i < n; i++) { var a = val(la, i), h = val(lh, i); if (a != null && h != null) parts.push(unit + (i + 1) + " " + A.abbreviation + " " + a + ", " + H.abbreviation + " " + h); }
    if (parts.length) secs.push({ h: "Period by period", p: parts.join(" · ") });
    var sp = (d.scoringPlays || []).filter(function (p) { return isFinite(Number(p.awayScore)) && isFinite(Number(p.homeScore)); });
    if (sp.length > 1) {
      var cur = 0, ch = 0, ties = 0, mA = 0, mH = 0;
      sp.forEach(function (p) {
        var m = Number(p.homeScore) - Number(p.awayScore), sd = m === 0 ? 0 : m > 0 ? 1 : -1;
        if (sd === 0) ties++;
        if (sd !== 0 && cur !== 0 && sd !== cur) ch++;
        if (sd !== 0) cur = sd;
        if (m > mH) mH = m; if (-m > mA) mA = -m;
      });
      var ln = [];
      if (ch === 0 && (mA === 0 || mH === 0)) ln.push((mA ? A : mH ? H : ld).displayName + " has led from the first score.");
      else ln.push("The lead has changed hands " + ch + (ch === 1 ? " time" : " times") + (ties ? " and the score has been tied " + ties + (ties === 1 ? " time." : " times.") : "."));
      if (mA || mH) ln.push("Biggest leads: " + (mA ? A.abbreviation + " by " + mA : "") + (mA && mH ? ", " : "") + (mH ? H.abbreviation + " by " + mH : "") + ".");
      secs.push({ h: "How it has gone", p: ln.join(" ") });
    }
    // Latest plays skip the filler (faceoffs, stoppages, timeouts, period starts) and repeats, so the three shown matter.
    var NOISE = /faceoff|stoppage|timeout|time out|start of|end of|beginning of|period start|period end|official|delay|substitution|jump ball|challenge/i, seenP = {};
    var last = sp.length ? sp : (d.plays || []).filter(function (p) {
      if (!p || !p.text || NOISE.test(p.text)) return false;
      var k = p.text + "|" + (p.clock && p.clock.displayValue); if (seenP[k]) return false; seenP[k] = 1; return true;
    });
    last = last.slice(-3).reverse().map(function (p) {
      var pn = p.period && p.period.number != null ? (p.period.displayValue || p.period.number) : "", ck = p.clock && p.clock.displayValue ? p.clock.displayValue : "";
      return (p.text || p.shortText || "") + ([pn, ck].filter(Boolean).length ? " (" + [pn, ck].filter(Boolean).join(" ") + ")" : "");
    }).filter(Boolean);
    if (last.length) secs.push({ h: sp.length ? "Latest scoring" : "Latest plays", p: last.join(" \u2022 ") });
    var by = {}, order = [];
    leaders.forEach(function (l) { if (!by[l.team]) { by[l.team] = []; order.push(l.team); } if (by[l.team].length < 2) by[l.team].push(l.name + " " + l.line + (l.cat ? " (" + l.cat.replace(/ Leader$/i, "") + ")" : "")); });
    if (order.length) secs.push({ h: "Standouts so far", p: order.map(function (t) { return t + ": " + by[t].join("; ") + "."; }).join(" ") });
    return { head: head, secs: secs };
  }

  // Box score, player tables, plays and a matchup preview (or, once final, a recap) for one game.
  function fetchGameRaw(lk, id) {
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
      if (comp && comp.status && comp.status.type && comp.status.type.state === "in" && away && home) { try { out.catch = catchOf(d, away, home, out.leaders, lg, comp.status); } catch (e) {} }
      if (comp && comp.status && comp.status.type && comp.status.type.completed && away && home) out.recap = recapOf(d, away, home, out.leaders, lg);

      // Season series line ("BOS leads 2-1") and the win-probability curve (home team, 0-100, thinned to about 90 points).
      var ss = d.seasonseries && d.seasonseries[0];
      if (ss && ss.summary) out.h2h = ss.summary;
      var wp = d.winprobability;
      if (wp && wp.length > 4) {
        var stp = Math.max(1, Math.ceil(wp.length / 90)), pts = [];
        for (var wi = 0; wi < wp.length; wi += stp) pts.push(Math.round((wp[wi].homeWinPercentage || 0) * 100));
        var lp = Math.round((wp[wp.length - 1].homeWinPercentage || 0) * 100);
        if (stp > 1) pts.push(lp);
        out.wp = pts;
      }

      var src = (d.plays && d.plays.length ? d.plays : d.scoringPlays) || [];
      out.plays = src.slice(-25).reverse().map(function (p) {
        var per = p.period && p.period.number != null ? (p.period.displayValue || p.period.number) : "";
        var ck = p.clock && p.clock.displayValue ? p.clock.displayValue : "";
        return { t: [per, ck].filter(Boolean).join(" "), x: p.text || p.shortText || "" };
      }).filter(function (p) { return p.x; });
      return out;
    });
  }

  // Remember box scores: finished games for the whole session, others for 20 seconds. Lets a tap open instantly
  // when the card was prefetched, and shares one request between the list, Yesterday and the detail page.
  var gc = {};
  function fetchGame(lk, id, fresh) {
    var k = lk + "_" + id, e = gc[k];
    if (e && !fresh && (e.fin || Date.now() - e.at < 20000)) return e.p;
    e = { at: Date.now(), fin: false };
    e.p = fetchGameRaw(lk, id);
    gc[k] = e;
    e.p.then(function (d) { e.d = d; e.fin = !!d.recap; }, function () { if (gc[k] === e) delete gc[k]; });
    return e.p;
  }
  function peekGame(lk, id) { var e = gc[lk + "_" + id]; return e && e.d; }

  // ---------- written recaps and previews (AP stories carried by ESPN) ----------
  // One league news request (cached 5 min) lists the Recap/Preview articles by game id; the full text is fetched only for
  // the game you open, and saved on the phone so reopening it is instant. Nothing here runs for the score lists.
  var newsC = {}, storyC = {}, NK = "sb-narr";
  // One news request per league, shared by recap/preview lookups and the "in the news" list (cached 5 minutes).
  var rawC = {};
  function rawNews(lk) {
    var e = rawC[lk];
    if (e && Date.now() - e.at < 300000) return e.p;
    e = { at: Date.now() };
    e.p = getJson(BASE + "/" + labelOf(lk).path + "/news?limit=100").catch(function (x) { delete rawC[lk]; throw x; });
    rawC[lk] = e;
    return e.p;
  }
  function leagueNews(lk) {
    var e = newsC[lk];
    if (e && Date.now() - e.at < 300000) return e.p;
    e = { at: Date.now() };
    e.p = rawNews(lk).then(function (j) {
      var m = {};
      (j.articles || []).forEach(function (a) {
        if (a.type !== "Recap" && a.type !== "Preview") return;
        (a.categories || []).forEach(function (c) {
          if (c.type !== "event") return;
          var id = String(c.eventId || (c.event && c.event.id) || "");
          if (!id) return;
          (m[id] = m[id] || {})[a.type] = { id: a.id, h: a.headline, link: a.links && a.links.web && a.links.web.href };
        });
      });
      return m;
    }, function () { delete newsC[lk]; return {}; });
    newsC[lk] = e;
    return e.p;
  }
  // Notable non-score news for a league from the last two days: breaking items first, then features. Betting and fantasy pieces are left out.
  function fetchNews(lk) {
    return rawNews(lk).then(function (j) {
      var now = Date.now(), seen = {};
      return (j.articles || []).filter(function (a) {
        if (a.type !== "HeadlineNews" && a.type !== "Story") return false;
        var w = a.links && a.links.web && a.links.web.href, t = Date.parse(a.published);
        if (!a.headline || !w || !isFinite(t) || now - t > 2 * DAY || a.premium) return false;
        if (/betting|fantasy|picks|odds|power-rankings|bracket/i.test(w) || /how to bet|fantasy|odds|prop|picks|rankings/i.test(a.headline)) return false;
        if (seen[a.headline]) return false; seen[a.headline] = 1; return true;
      }).sort(function (p, q) { return (q.type === "HeadlineNews" ? 1 : 0) - (p.type === "HeadlineNews" ? 1 : 0) || Date.parse(q.published) - Date.parse(p.published); })
        .slice(0, 4).map(function (a) { return { h: a.headline, d: a.description || "", t: Date.parse(a.published), link: a.links.web.href }; });
    }).catch(function () { return []; });
  }
  function savedNarr() { try { return JSON.parse(localStorage.getItem(NK) || "{}"); } catch (e) { return {}; } }
  function saveNarr(id, v) {
    try {
      var s = savedNarr(); s[id] = v;
      var ks = Object.keys(s); if (ks.length > 60) delete s[ks[0]];
      localStorage.setItem(NK, JSON.stringify(s));
    } catch (e) {}
  }
  // Story text comes as plain text with blank lines between paragraphs and a few inline tags.
  function paragraphs(html) {
    var t = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html").body.textContent || "";
    return t.split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, " ").trim(); })
      .filter(function (p) { return p && !/^-{3,}/.test(p); }).slice(0, 16);
  }
  // Resolves {type, h, link, paras} for the game's recap (finished games) or preview, or null when ESPN has none yet.
  function fetchNarrative(lk, id, fin) {
    var want = fin ? "Recap" : "Preview", ck = lk + "_" + id + "_" + want, c = storyC[ck];
    if (c && (c.v || Date.now() - c.at < 180000)) return c.p;
    var sv = savedNarr()[ck];
    if (sv) { c = storyC[ck] = { at: Date.now(), v: true, p: Promise.resolve(sv) }; return c.p; }
    c = storyC[ck] = { at: Date.now(), v: false };
    c.p = leagueNews(lk).then(function (m) {
      var a = m[String(id)] && m[String(id)][want];
      if (!a) return null;
      return getJson("https://content.core.api.espn.com/v1/sports/news/" + a.id).then(function (j) {
        var h = j.headlines && j.headlines[0], ps = h && h.story ? paragraphs(h.story) : [];
        if (!ps.length) return null;
        var out = { type: want, h: a.h, link: a.link, paras: ps };
        c.v = true; if (fin) saveNarr(ck, out);
        return out;
      });
    }).catch(function () { return null; });
    return c.p;
  }

  // ---------- teams, standings and schedules ----------
  var V2 = "https://site.api.espn.com/apis/v2/sports";
  var teamsP = {};
  // {leagueKey: [{id, name}]}. Cached for a week. lazy=true covers the extra leagues (fetched only when needed).
  function fetchTeams(lazy) {
    var pk = lazy ? "l" : "c";
    if (teamsP[pk]) return teamsP[pk];
    var ck = lazy ? "sb-tm2" : "sb-tm", ls = C.leagues.filter(function (l) { return !l.noTeams && !!l.lazy === !!lazy; });
    try { localStorage.removeItem(lazy ? "sb-teams2" : "sb-teams"); } catch (e) {}   // the older index without abbreviations and logos
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(ck) || "null"); } catch (e) {}
    if (cached && Date.now() - cached.at < 7 * DAY && cached.n === ls.length) return (teamsP[pk] = Promise.resolve(cached.v));
    teamsP[pk] = Promise.all(ls.map(function (l) {
      // ESPN's /teams endpoint blocks browsers (CORS); the standings feed lists every team too.
      return getJson(V2 + "/" + l.path + "/standings").then(function (j) {
        var seen = {}, ts = [];
        walk(j, []).forEach(function (g) { g.entries.forEach(function (e) { if (!seen[e.team.id]) { seen[e.team.id] = 1; ts.push({ id: e.team.id, name: e.team.displayName, ab: e.team.abbreviation || "", lg: logoOf(e.team) }); } }); });
        return [l.key, ts];
      }, function () { return [l.key, []]; });
    })).then(function (rows) {
      var v = {};
      rows.forEach(function (r) { v[r[0]] = r[1]; });
      if (lazy || rows.every(function (r) { return r[1].length; })) {
        try { localStorage.setItem(ck, JSON.stringify({ at: Date.now(), n: ls.length, v: v })); } catch (e) {}
      }
      return v;
    });
    return teamsP[pk];
  }
  function findIn(v, name) {
    for (var k in v) for (var i = 0; i < v[k].length; i++) if (v[k][i].name === name) return { lk: k, id: v[k][i].id };
    return null;
  }
  // A followed team's league and id: the core index first, then one search request (never the old sweep of every
  // league's standings). Only hits in a league the app knows (config or added) count.
  function pathKey(path) { var l = C.leagues.filter(function (x) { return x.path === path; })[0]; return l ? l.key : null; }
  function findTeam(name) {
    return fetchTeams().then(function (v) {
      return findIn(v, name) || search(name).then(function (r) {
        var hit = r.teams.filter(function (t) { return t.name === name && pathKey(t.sport + "/" + t.slug); })[0];
        return hit ? { lk: pathKey(hit.sport + "/" + hit.slug), id: hit.id } : null;
      }, function () { return null; });
    });
  }

  // ---------- search: every team and athlete ESPN knows, one small request per query ----------
  // type=team,player trims the reply from ~60KB (articles, clips) to about 1KB. Answers are kept ten minutes.
  var SRCH = "https://site.api.espn.com/apis/search/v2", srC = {};
  function smallImg(u) { var m = /^https?:\/\/a\.espncdn\.com(\/i\/teamlogos\/.+)$/.exec(u || ""); return m ? "https://a.espncdn.com/combiner/i?img=" + m[1] + "&w=64&h=64" : (u || ""); }
  function search(q) {
    var k = String(q || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (k.length < 2) return Promise.resolve({ teams: [], people: [] });
    var e = srC[k];
    if (e && Date.now() - e.at < 600000) return e.p;
    e = { at: Date.now() }; srC[k] = e;
    e.p = getJson(SRCH + "?limit=10&type=team,player&query=" + encodeURIComponent(k)).then(function (j) {
      var teams = [], people = [];
      (j.results || []).forEach(function (r) {
        (r.contents || []).forEach(function (c) {
          var tm = /~t:(\d+)/.exec(c.uid || ""), at = /~a:(\d+)/.exec(c.uid || ""), img = (c.image && c.image.default) || "";
          var base = { name: String(c.displayName || "").trim(), sport: c.sport || "", slug: c.defaultLeagueSlug || "" };
          if (r.type === "team" && tm) teams.push(Object.assign(base, { id: tm[1], ll: c.subtitle || c.description || "", lg: smallImg(img) }));
          else if (r.type === "player" && at) people.push(Object.assign(base, { id: at[1], sub: c.subtitle || "", d: c.description || "", img: img, web: (c.link && c.link.web) || "" }));
        });
      });
      e.d = { teams: teams, people: people };
      return e.d;
    }, function (x) { if (srC[k] === e) delete srC[k]; throw x; });
    return e.p;
  }
  // The finished answer for a query, if there is one, so a re-render can paint it without waiting.
  function peekSearch(q) { var e = srC[String(q || "").toLowerCase().replace(/\s+/g, " ").trim()]; return e && e.d; }

  function walk(n, out) {
    if (n.standings && n.standings.entries) out.push({ name: n.name, entries: n.standings.entries });
    (n.children || []).forEach(function (c) { walk(c, out); });
    return out;
  }
  function stat(e, name) {
    var s = (e.stats || []).filter(function (z) { return z.name === name || z.type === name; })[0];
    return s ? s.displayValue : null;
  }
  // Where a team sits in the whole league: every entry across every group, once per team, ranked by win% (points per game
  // for the points leagues). {pos, n} so the team page can say "top quarter" or "bottom tenth".
  function leagueRank(groups, tid, usePts) {
    var seen = {}, all = [];
    groups.forEach(function (g) { g.entries.forEach(function (e) {
      var id = String(e.team.id); if (seen[id]) return; seen[id] = 1;
      var w = parseFloat(stat(e, "wins")), l = parseFloat(stat(e, "losses")), t = parseFloat(stat(e, "ties") || stat(e, "otLosses") || 0) || 0, gp = parseFloat(stat(e, "gamesPlayed")) || (w + l + t);
      var sc = usePts ? (gp ? parseFloat(stat(e, "points")) / gp : NaN) : parseFloat(stat(e, "winPercent"));
      if (!isFinite(sc) && gp) sc = (w + 0.5 * t) / gp;
      if (isFinite(sc)) all.push([id, sc]);
    }); });
    if (all.length < 4) return null;
    all.sort(function (a, b) { return b[1] - a[1]; });
    var pos = -1; all.forEach(function (r, i) { if (r[0] === String(tid)) pos = i + 1; });
    return pos > 0 ? { pos: pos, n: all.length } : null;
  }
  function findStanding(j, tid, usePts) {
    var groups = walk(j, []), lr = leagueRank(groups, tid, usePts);
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
        return { n: x.team.abbreviation || x.team.shortDisplayName || x.team.displayName, rank: isFinite(sd) ? sd : i + 1, rec: rec, ex: ex == null ? "" : ex, k: stat(x, "streak") || "", lg: logoOf(x.team), me: i === idx, id: String(x.team.id), nm: x.team.displayName };
      }).sort(function (p, q) { return p.rank - q.rank; });
      return { group: ({ "American Football Conference": "AFC", "National Football Conference": "NFC" })[groups[gi].name] || groups[gi].name, rank: rank, record: stat(e, "overall") || (stat(e, "wins") + "-" + stat(e, "losses")), streak: stat(e, "streak"), logo: logoOf(e.team), rows: rows, exLabel: hasPts ? "PTS" : "PCT", lr: lr, gb: stat(e, "gamesBehind") };
    }
    return null;
  }
  function bcName(comp) {
    var bc = (comp.broadcasts && comp.broadcasts[0]) || (comp.geoBroadcasts && comp.geoBroadcasts[0]);
    return (bc && ((bc.names && bc.names[0]) || (bc.media && bc.media.shortName))) || "";
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
      return { id: ev.id, st: (ev.seasonType || {}).type, t: ev.date || comp.date, s: st === "in" ? "live" : st === "post" ? "final" : "up", opp: opp.team.displayName, home: mine.homeAway === "home", my: num(mine), op: num(opp), b: bcName(comp), o: [opp.team.abbreviation || "", logoOf(opp.team), String(opp.team.id)] };
    }).filter(Boolean);
  }
  // Standing (rank, record, streak) and schedule for one team.
  var stC = {};   // one standings feed per league, kept five minutes, so hopping between teams costs one request
  function standingsOf(lg, fresh) {
    var e = stC[lg.key];
    if (e && !fresh && Date.now() - e.at < 300000) return e.p;
    e = { at: Date.now(), p: getJson(V2 + "/" + lg.path + "/standings") }; stC[lg.key] = e;
    e.p.catch(function () { if (stC[lg.key] === e) delete stC[lg.key]; });
    return e.p;
  }
  // One team's schedule ({ games, me }), kept two minutes: Find shows a team's games from it, and the team page opened
  // right after reuses it instead of asking again.
  var scC = {};
  function scheduleOf(lk, tid, fresh) {
    var lg = labelOf(lk), k = lk + "_" + tid, e = scC[k];
    if (e && !fresh && Date.now() - e.at < 120000) return e.p;
    var url = BASE + "/" + lg.path + "/teams/" + tid + "/schedule", me = null;
    // In the offseason ESPN's default schedule can be just the playoffs, so also pull the regular season then.
    var p = getJson(url).then(function (j) { var t = j.team || {}; me = [t.displayName || "", t.abbreviation || "", logoOf(t) || (t.logo || ""), String(t.id || tid)]; return parseSchedule(j); }).then(function (gs) {
      if (!gs.length || gs.some(function (g) { return g.st === 2; })) return gs;
      return getJson(url + "?seasontype=2").then(parseSchedule, function () { return []; }).then(function (reg) {
        var seen = {};
        return reg.concat(gs).filter(function (g) { if (seen[g.id]) return false; seen[g.id] = 1; return true; });
      });
    }).then(function (gs) { return { games: gs, me: me }; });
    e = scC[k] = { at: Date.now(), p: p };
    p.catch(function () { if (scC[k] === e) delete scC[k]; });
    return p;
  }
  function fetchTeamInfo(lk, tid, fresh) {
    var lg = labelOf(lk);
    var st = standingsOf(lg, fresh).then(function (j) { return findStanding(j, tid, /hockey|australian|soccer/.test(lg.path)); }, function () { return null; });
    var sc = scheduleOf(lk, tid, fresh).then(null, function () { return { games: [], me: null }; });
    // Before a regular season starts ESPN's standings are preseason numbers (a 4-0 "1st" before opening night), so in the
    // big four: once the regular schedule is known, preseason games drop out, and until a regular-season game has been
    // played there are no standings, just pre: true (the app says when the season starts).
    return Promise.all([st, sc]).then(function (r) {
      var gs = r[1].games || [], pre = false;
      if (/^(football|basketball|hockey|baseball)\//.test(lg.path) && gs.some(function (g) { return g.st === 2; })) {
        gs = gs.filter(function (g) { return g.st !== 1; });
        pre = !gs.some(function (g) { return (g.st === 2 || g.st === 3) && g.s !== "up"; });
      }
      return { standing: pre ? null : r[0], games: gs, me: r[1].me, pre: pre };
    });
  }

  window.ESPN = { fetchScores: fetchScores, fetchGame: fetchGame, peekGame: peekGame, fetchNarrative: fetchNarrative, fetchNews: fetchNews, fetchTeams: fetchTeams, findTeam: findTeam, fetchTeamInfo: fetchTeamInfo, scheduleOf: scheduleOf, search: search, peekSearch: peekSearch, dayKey: dayKey, DAY: DAY };
})();
