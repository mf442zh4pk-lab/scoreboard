/* Delight layer: random celebrations, easter eggs, cameos. Loaded after first paint so it never slows startup. */
(function () {
  "use strict";
  var D = document, RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var $ = function (i) { return D.getElementById(i); };
  function rnd(n) { return Math.floor(Math.random() * n); }
  function R(a, b) { return a + Math.random() * (b - a); }
  function mk(cls, txt, st) { var e = D.createElement("span"); e.className = cls; if (txt) e.textContent = txt; if (st) e.style.cssText = st; e.setAttribute("aria-hidden", "true"); return e; }
  function gone(e, ms) { setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms); }
  var COLS = ["#ffd200", "#ff7a18", "#4ade80", "#38bdf8", "#f472b6", "#a78bfa", "#fb7185"];
  var hist = {};
  function pick(key, arr) {                      // random, but never the same as the last two picks
    var h = hist[key] || (hist[key] = []), c, t = 0;
    do { c = arr[rnd(arr.length)]; t++; } while (h.indexOf(c) >= 0 && t < 12);
    h.push(c); if (h.length > 2) h.shift(); return c;
  }

  // ---------- secrets ----------
  var SECRETS = { title5: "Title tapper", title12: "Trophy shower", foot3: "Upside down", konami: "Retro mode", logos10: "Logo spinner", owl: "Night owl", bottom: "Rock bottom", refresh7: "Dizzy", golden: "Golden card", legend: "Legendary win", bat: "Spooky season", cameo: "Special guest", dbl: "Double tap" };
  var TOTAL = Object.keys(SECRETS).length, store = {};
  try { store = JSON.parse(localStorage.getItem("sb-fun") || "{}") || {}; } catch (e) {}
  function count() { var n = 0; for (var k in SECRETS) if (store[k]) n++; return n; }
  function say(msg) { var t = $("toast"); if (!t) return; t.textContent = msg; t.className = "show"; clearTimeout(say.h); say.h = setTimeout(function () { t.className = ""; }, 3800); }
  function found(k) {
    if (store[k] || !SECRETS[k]) return; store[k] = 1;
    try { localStorage.setItem("sb-fun", JSON.stringify(store)); } catch (e) {}
    say("🔓 Secret found: " + SECRETS[k] + " (" + count() + "/" + TOTAL + ")");
  }

  // ---------- global layer ----------
  var G = null;
  function layer() { if (!G || !G.parentNode) { G = mk("fxg"); D.body.appendChild(G); } return G; }
  function gConfetti(n, chars) {
    var g = layer();
    for (var i = 0; i < n; i++) {
      var p = mk(chars ? "fx-gc e" : "fx-gc", chars ? chars[rnd(chars.length)] : "", "--x:" + R(0, 100).toFixed(1) + "%;--c:" + COLS[rnd(COLS.length)] + ";--t:" + R(1.8, 3.2).toFixed(2) + "s;--dl:" + R(0, 0.9).toFixed(2) + "s;--r:" + rnd(720) + "deg;--sw:" + Math.round(R(-60, 60)) + "px");
      g.appendChild(p); gone(p, 4400);
    }
  }
  function gBurst(x, y, color, n) {
    var g = layer();
    for (var i = 0; i < n; i++) {
      var s = mk("fx-spark", "", "left:" + x + "px;top:" + y + "px;--a:" + Math.round(i * 360 / n) + "deg;--d:" + Math.round(R(50, 90)) + "px;--c:" + color);
      g.appendChild(s); gone(s, 1400);
    }
  }
  function gFireworks() {
    var w = innerWidth, h = innerHeight;
    for (var i = 0; i < 6; i++) (function (i) { setTimeout(function () { gBurst(R(w * .15, w * .85), R(h * .12, h * .5), COLS[rnd(COLS.length)], 16); }, i * 280); })(i);
  }
  function flyer(ch, cls) {
    var g = layer(), f = mk("fx-fly" + (cls ? " " + cls : ""), ch, "--y:" + Math.round(R(12, 60)) + "%");
    g.appendChild(f); gone(f, 5600);
  }
  function ball() {
    var g = layer(), em = pick("ball", ["🏈", "🏀", "🏒", "⚾", "⚽", "🏐", "🥎", "🎾"]);
    var b = mk("fx-ball " + (Math.random() < .5 ? "roll" : "bounce"), "", ""); var inner = D.createElement("b"); inner.textContent = em; b.appendChild(inner);
    g.appendChild(b); gone(b, 3600);
  }

  // ---------- celebrations (inside a card) ----------
  function holder(card) {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
    var h = mk("fxh"); card.appendChild(h); gone(h, 4200); return h;
  }
  function piece(h, cls, txt, vars) { var p = mk(cls, txt, vars); h.appendChild(p); return p; }
  var WIN = {
    confetti: function (h) { for (var i = 0; i < 26; i++) { var a = R(-Math.PI, 0) + R(-.3, .3), d = R(60, 170); piece(h, "fx-conf", "", "--dx:" + Math.round(Math.cos(a) * d) + "px;--dy:" + Math.round(Math.sin(a) * d + 150) + "px;--r:" + rnd(720) + "deg;--c:" + COLS[rnd(COLS.length)] + ";animation-delay:" + rnd(200) + "ms"); } },
    fireworks: function (h) { for (var k = 0; k < 3; k++) { var x = R(18, 82), y = R(15, 60), c = COLS[rnd(COLS.length)]; for (var i = 0; i < 14; i++) piece(h, "fx-spark", "", "left:" + x + "%;top:" + y + "%;--a:" + Math.round(i * 360 / 14) + "deg;--d:" + Math.round(R(28, 52)) + "px;--c:" + c + ";animation-delay:" + k * 380 + "ms"); } },
    emoji: function (h) { var set = pick("emo", [["🏆", "🎉", "⭐"], ["🔥", "💪", "🙌"], ["🍾", "🥳", "🎊"], ["💰", "👑", "✨"]]); for (var i = 0; i < 14; i++) piece(h, "fx-fall", set[i % set.length], "--x:" + R(2, 94).toFixed(0) + "%;--s:" + Math.round(R(16, 26)) + "px;--t:" + R(1.4, 2.4).toFixed(2) + "s;--dl:" + R(0, 1).toFixed(2) + "s;--r:" + rnd(360) + "deg"); },
    balloons: function (h) { var set = ["🎈"]; for (var i = 0; i < 7; i++) piece(h, "fx-bal", set[0], "--x:" + R(4, 90).toFixed(0) + "%;--t:" + R(2, 3.2).toFixed(2) + "s;--dl:" + R(0, .9).toFixed(2) + "s;--sw:" + Math.round(R(-26, 26)) + "px"); },
    shock: function (h) { for (var i = 0; i < 3; i++) piece(h, "fx-ring", "", "--dl:" + i * 0.22 + "s"); },
    trophy: function (h) { piece(h, "fx-troph", "🏆"); },
    stars: function (h) { for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2, d = R(50, 110); piece(h, "fx-conf e", "⭐", "--dx:" + Math.round(Math.cos(a) * d) + "px;--dy:" + Math.round(Math.sin(a) * d) + "px;--r:" + rnd(540) + "deg;left:50%;top:40px"); } },
    shine: function (h) { piece(h, "fx-shine"); },
    popper: function (h) { piece(h, "fx-popper", "🎉"); for (var i = 0; i < 16; i++) piece(h, "fx-conf", "", "left:14px;bottom:10px;top:auto;--dx:" + Math.round(R(20, 200)) + "px;--dy:" + Math.round(R(-190, -40)) + "px;--r:" + rnd(540) + "deg;--c:" + COLS[rnd(COLS.length)]); },
    medal: function (h) { piece(h, "fx-medal", pick("md", ["🥇", "🏅", "👑"])); }
  };
  var LOSE = {
    rain: function (h) { piece(h, "fx-dim"); piece(h, "fx-cloud", "☁️"); for (var i = 0; i < 22; i++) piece(h, "fx-drop", "", "--x:" + R(3, 97).toFixed(0) + "%;--dl:" + R(0, .7).toFixed(2) + "s"); },
    crack: function (h) { h.insertAdjacentHTML("beforeend", '<svg class="fx-crack" viewBox="0 0 100 60" preserveAspectRatio="none"><path pathLength="1" d="M62 0 L55 14 L63 22 L50 34 L58 44 L48 60 M55 14 L40 18 M63 22 L78 26 M50 34 L36 38"/></svg>'); },
    tumble: function (h) { piece(h, "fx-tum", pick("tum", ["🍂", "🌿", "🌵"])); },
    deflate: function (h) { piece(h, "fx-defl", "🎈"); },
    cry: function (h) { piece(h, "fx-cry", "😢"); for (var i = 0; i < 6; i++) piece(h, "fx-drop big", "", "--x:" + R(42, 58).toFixed(0) + "%;--dl:" + (.5 + i * .18).toFixed(2) + "s"); },
    thunder: function (h) { piece(h, "fx-flash"); piece(h, "fx-bolt", "⚡", "--x:" + R(15, 80).toFixed(0) + "%"); },
    wilt: function (h) { piece(h, "fx-wilt", "🥀"); },
    trombone: function (h) { piece(h, "fx-tb", "🎺"); piece(h, "fx-txt", "wah wah wahhh"); },
    ghost: function (h) { piece(h, "fx-ghost", "👻"); }
  };
  var WINK = Object.keys(WIN), LOSEK = Object.keys(LOSE);
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- arriving somewhere new ----------
  var ENTER = ["rise", "rise", "flip", "zoom", "slidel", "slider", "swing", "blur", "drop", "spin", "tilt"];
  function enterFx() { return RM ? "rise" : pick("enter", ENTER); }
  var arrivals = 0;
  function after(out) {
    if (RM) return; arrivals++;
    var cards = shuffle([].slice.call(out.querySelectorAll(".recap.w,.recap.l,.card.followed"))).slice(0, 4), anyWin = false;
    cards.forEach(function (c) {
      var win = c.classList.contains("w") || !!c.querySelector(".pill.final.w"), loss = c.classList.contains("l") || !!c.querySelector(".pill.final.l");
      if (!win && !loss) return;
      if (win) {
        anyWin = true;
        if (Math.random() < .12) return;                                  // sometimes keep the classic confetti
        var cf = c.querySelector(":scope > .cf"); if (cf) cf.parentNode.removeChild(cf);
        WIN[pick("win", WINK)](holder(c));
      } else {
        var k = pick("lose", LOSEK);
        if (Math.random() < .12) { c.classList.add("fx-shake"); setTimeout(function () { c.classList.remove("fx-shake"); }, 700); }
        else LOSE[k](holder(c));
      }
    });
    if (anyWin && Math.random() < .07) { gConfetti(70); found("legend"); }
    var r = Math.random();
    if (r < .10) ball(); else if (r < .17) seasonal(); else if (r < .21) gold(out); else if (r < .24) cameo();
    special();
  }
  var SPECIAL_DONE = false;
  function special() {
    if (SPECIAL_DONE) return; var d = new Date(), m = d.getMonth() + 1, dd = d.getDate();
    if ((m === 1 && dd === 1) || (m === 7 && dd === 4) || (m === 12 && dd === 31)) { SPECIAL_DONE = true; gFireworks(); }
    else if (m === 10 && dd === 31) { SPECIAL_DONE = true; flyer("🎃"); flyer("🦇"); flyer("👻"); found("bat"); }
  }
  function seasonal() {
    var m = new Date().getMonth() + 1;
    if (m === 10) { flyer(pick("sea", ["🦇", "🎃", "👻", "🕷️"])); found("bat"); }
    else if (m === 2) gConfetti(10, ["\u2764\uFE0F"]);
    else if (m === 12 || m === 1) gConfetti(18, ["❄️", "❄", "❅"]);
    else if (m === 2) gConfetti(10, ["❤️"]);
    else if (m === 3) flyer("☘️");
    else if (m === 7) gFireworks();
    else cameo();
  }
  function cameo() { flyer(pick("cam", ["🛸", "🚁", "🪁", "🦄", "🐢", "🚂", "🦅", "🚀", "🏃", "🐕"]), Math.random() < .5 ? "slow" : ""); found("cameo"); }
  function gold(out) {
    var c = out.querySelector(".card,.recap,.story"); if (!c) return;
    c.classList.add("gold"); found("golden"); setTimeout(function () { c.classList.remove("gold"); }, 9000);
  }

  // ---------- poking things ----------
  var taps = { title: [], foot: [], logos: 0, refresh: [], dbl: 0 };
  function recent(arr, win) { var n = Date.now(); arr.push(n); while (arr.length && n - arr[0] > win) arr.shift(); return arr.length; }
  var LOGOFX = ["spin", "bounce", "wobble", "grow", "jelly", "flip"];
  function logoFx(el) { var k = pick("logo", LOGOFX), cls = "lg-" + k; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 1000); }
  var RF = ["spin", "boing", "wig", "flip"];
  D.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest("#title")) {
      var n = recent(taps.title, 2500), ti = $("title");
      if (!RM) { ti.classList.remove("t-wob"); void ti.offsetWidth; ti.classList.add("t-wob"); }
      if (n === 5) { found("title5"); if (!RM) gConfetti(60); }
      if (n >= 12) { taps.title.length = 0; found("title12"); if (!RM) { gConfetti(50, ["🏆", "🥇", "⭐", "🎉"]); gFireworks(); } }
      return;
    }
    if (t.closest("#foot")) {
      if (recent(taps.foot, 2000) >= 3) { taps.foot.length = 0; found("foot3"); if (!RM) { D.body.classList.add("flipped"); setTimeout(function () { D.body.classList.remove("flipped"); }, 2600); } }
      return;
    }
    if (t.closest("#refresh")) {
      var b = $("refresh"), k = pick("rf", RF), cl = "rf-" + k;
      if (!RM) { b.classList.remove(cl); void b.offsetWidth; b.classList.add(cl); setTimeout(function () { b.classList.remove(cl); }, 700); }
      if (recent(taps.refresh, 4000) >= 7) { taps.refresh.length = 0; found("refresh7"); if (!RM) { var h1 = $("title"); h1.classList.add("dizzy"); setTimeout(function () { h1.classList.remove("dizzy"); }, 1600); say("Whoa, easy there 😵‍💫"); } }
      return;
    }
    var lg = t.closest(".ab");
    if (lg && !RM) { logoFx(lg); taps.logos++; if (taps.logos === 10) { found("logos10"); gConfetti(30); } }
  }, true);
  D.addEventListener("dblclick", function (e) {
    var s = e.target.closest && e.target.closest(".sc"); if (!s || RM) return;
    s.classList.remove("sc-roll"); void s.offsetWidth; s.classList.add("sc-roll"); taps.dbl++; if (taps.dbl >= 1) found("dbl");
  });
  var KON = "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a".split(","), ki = 0;
  D.addEventListener("keydown", function (e) {
    ki = (e.key === KON[ki] || e.key.toLowerCase() === KON[ki]) ? ki + 1 : (e.key === KON[0] ? 1 : 0);
    if (ki === KON.length) { ki = 0; var on = D.documentElement.classList.toggle("retro"); found("konami"); say(on ? "🕹️ Retro mode ON" : "Retro mode off"); }
  });
  // reaching the very bottom swaps the footer for a quip
  var QUIPS = ["That's all of it. Go touch grass.", "Nothing down here but a ball and a dream.", "You scrolled all the way down. Respect.", "Bottom of the page. Top of the standings.", "Refs have reviewed the scroll. Call stands.", "Still here? Overtime.", "Halftime show is canceled. Scroll back up.", "Fun fact: this page has no cheerleaders.", "Sir, this is a scoreboard.", "Hydrate. Stretch. Then check scores again."];
  var atBottom = false, tick = 0;
  addEventListener("scroll", function () {
    if (tick) return; tick = requestAnimationFrame(function () {
      tick = 0; var nb = innerHeight + scrollY >= D.documentElement.scrollHeight - 6;
      if (nb && !atBottom && D.documentElement.scrollHeight > innerHeight * 1.4) {
        var f = $("foot"); if (f) { f.dataset.o = f.dataset.o || f.textContent; f.textContent = pick("quip", QUIPS); }
        found("bottom"); if (!RM && Math.random() < .35) ball();
      }
      atBottom = nb;
    });
  }, { passive: true });
  var h = new Date().getHours();
  if (h < 5) { var ti = $("title"); if (ti) ti.classList.add("owl"); found("owl"); }

  window.FUN = { enterFx: enterFx, after: after, count: count, total: TOTAL, reduced: RM };
})();
