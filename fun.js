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

  // ---------- collection log ----------
  // [id, category, rarity, emoji, name, flavor, hint]  rarity: C common, U uncommon, R rare, E epic, L legendary, M mythic
  var CATS = { w: "Celebrations", l: "Heartbreaks", e: "Entrances", c: "Cameos", b: "Ball Drops", g: "Gestures", s: "Streaks", x: "Secrets", d: "Calendar", t: "Habits", m: "Milestones", tn: "NFL Teams", tb: "NBA Teams", tm: "MLB Teams", th: "NHL Teams" };
  var RAR = { C: "Common", U: "Uncommon", R: "Rare", E: "Epic", L: "Legendary", M: "Mythic", S: "Signature" };
  var RW = { C: 11, U: 5, R: 2.4, E: 1, L: .35, M: .07, S: 0 };
  var HW = "Open a page where one of your teams just won.", HL = "Open a page where one of your teams just lost.", HE = "Switch tabs and views and watch how the page arrives.", HC = "Sometimes something wanders across the screen.", HB = "Sometimes a ball rolls or bounces by.";
  var CAT = [
    ["w_confetti","w","C","🎊","Confetti Cannon","The classic. Someone's team came through.",HW],
    ["w_emoji","w","C","🥳","Emoji Shower","It's raining good vibes.",HW],
    ["w_shock","w","C","💥","Shockwave","A win you can feel in the pixels.",HW],
    ["w_balloons","w","U","🎈","Balloon Lift","Up, up and away with the W.",HW],
    ["w_stars","w","U","⭐","Star Burst","Every star in the building, at once.",HW],
    ["w_shine","w","U","✨","Glint","A quick shine across a clean win.",HW],
    ["w_trophy","w","R","🏆","Trophy Rise","Lifted straight out of the scoreboard.",HW],
    ["w_popper","w","R","🎉","Party Popper","Pop. Someone's celebrating.",HW],
    ["w_medal","w","R","🥇","Medal Drop","Gold around the neck.",HW],
    ["w_fireworks","w","E","🎆","Fireworks Show","Three bursts over a very good night.",HW],
    ["l_rain","l","C","🌧️","Rain Cloud","Your own personal storm cell.",HL],
    ["l_crack","l","C","💔","Cracked Glass","Some losses leave a mark.",HL],
    ["l_shake","l","C","🫨","Rattled","The card never saw it coming.",HL],
    ["l_tumble","l","U","🍂","Tumbleweed","Nothing left in the offense.",HL],
    ["l_deflate","l","U","🎈","Deflation","All the air, gone.",HL],
    ["l_trombone","l","U","🎺","Sad Trombone","Wah wah wahhh.",HL],
    ["l_cry","l","R","😢","Waterworks","Let it out.",HL],
    ["l_wilt","l","R","🥀","Wilted","The season's looking dry.",HL],
    ["l_thunder","l","E","⚡","Thunderclap","A loss with a lightning bolt attached.",HL],
    ["l_ghost","l","E","👻","Ghosted","The defense just vanished.",HL],
    ["e_rise","e","C","⬆️","Rise","The standard entrance.",HE],
    ["e_blur","e","C","🌫️","Fade Focus","Out of the fog and into focus.",HE],
    ["e_flip","e","U","🔄","Flip In","Cards turn up face first.",HE],
    ["e_zoom","e","U","🔍","Zoom In","Straight from the nosebleeds to courtside.",HE],
    ["e_slidel","e","U","⬅️","Slide Left","Enters stage left.",HE],
    ["e_slider","e","U","➡️","Slide Right","Enters stage right.",HE],
    ["e_tilt","e","U","📐","Tilt","Slightly off. On purpose.",HE],
    ["e_swing","e","R","🎢","Swing","Hung from the rafters, then dropped in.",HE],
    ["e_drop","e","R","⬇️","Drop In","Dunked straight onto the page.",HE],
    ["e_spin","e","R","🌀","Pinwheel","A full rotation on arrival.",HE],
    ["c_kite","c","C","🪁","Kite","Catching a breeze across the page.",HC],
    ["c_runner","c","C","🏃","Streaker","Sprints across. No explanation given.",HC],
    ["c_dog","c","C","🐕","Field Dog","A good boy on the field.",HC],
    ["c_heli","c","U","🚁","Chopper","Traffic report from above.",HC],
    ["c_turtle","c","U","🐢","Slow Turtle","Taking its time. All of it.",HC],
    ["c_eagle","c","U","🦅","Eagle Flyover","Anthem's over. Bird's not.",HC],
    ["c_ufo","c","R","🛸","Visitor","They came for the highlights.",HC],
    ["c_train","c","R","🚂","Hype Train","All aboard.",HC],
    ["c_rocket","c","R","🚀","Rocket","Going to the moon, or at least the end of the page.",HC],
    ["c_unicorn","c","L","🦄","Unicorn","Seen by almost no one.",HC],
    ["b_football","b","C","🏈","Football","Rolls on in.",HB],["b_basketball","b","C","🏀","Basketball","Bounces through.",HB],["b_hockey","b","C","🏒","Puck","Slides by.",HB],["b_baseball","b","C","⚾","Baseball","Pitch comes in.",HB],
    ["b_soccer","b","U","⚽","Soccer Ball","Goal. Of the page.",HB],["b_volley","b","U","🏐","Volleyball","Bump, set.",HB],["b_tennis","b","U","🎾","Tennis Ball","Fault. Let's go again.",HB],["b_softball","b","R","🥎","Softball","The odd one out.",HB],
    ["g_logo_spin","g","C","🌀","Logo Spin","Tap a team logo.","Tap team logos."],["g_logo_bounce","g","C","🏀","Logo Bounce","A boing for a logo.","Tap team logos."],["g_logo_wobble","g","C","🫨","Logo Wobble","Shake it off.","Tap team logos."],
    ["g_logo_grow","g","U","🔎","Logo Grow","Big logo energy.","Tap team logos."],["g_logo_jelly","g","U","🍮","Logo Jelly","Wiggle wiggle.","Tap team logos."],["g_logo_flip","g","R","🪙","Logo Flip","Heads or tails?","Tap team logos."],
    ["g_rf_spin","g","C","🔃","Refresh Spin","Spin it round.","Tap Refresh."],["g_rf_boing","g","U","🦘","Refresh Boing","Springy.","Tap Refresh."],["g_rf_wig","g","U","〰️","Refresh Wiggle","A nervous button.","Tap Refresh."],["g_rf_flip","g","R","🔁","Refresh Flip","Landed on its feet.","Tap Refresh."],
    ["s_heat","s","C","🌡️","Heat Check","You checked the heat.","Open the My teams tab and look at the Trends."],
    ["s_fire3","s","U","🔥","Heating Up","A fiery border for a 3+ game win streak.","Follow a team that wins 3 in a row."],
    ["s_cold3","s","U","🧊","Cold Snap","An icy border for 3+ straight losses.","Follow a team that drops 3 in a row."],
    ["s_fire5","s","R","🌋","On Fire","Five wins running and the border knows it.","Follow a team that wins 5 in a row."],
    ["s_cold5","s","R","❄️","Deep Freeze","Five losses running. Brr.","Follow a team that drops 5 in a row."],
    ["title5","x","C","🏷️","Title Tapper","You poked the title five times.","Tap the title, quickly."],
    ["dbl","x","C","👆","Double Tap","Tap tap.","Double-tap a score."],
    ["cameo","x","C","🎪","Special Guest","Someone dropped by.","Wait for a visitor."],
    ["bottom","x","C","⬇️","Rock Bottom","You scrolled all the way down.","Scroll to the very bottom."],
    ["stamp","x","C","⏱️","Clock Watcher","The little status light has feelings too.","Tap the little status light a few times."],
    ["tour","x","C","🧭","Tour Guide","You visited five different tabs.","Visit lots of tabs in one go."],
    ["dive","x","C","🤿","Deep Dive","Opened a game's full details.","Open a game."],
    ["title12","x","U","🏆","Trophy Shower","Twelve taps earns a parade.","Tap the title a lot."],
    ["foot3","x","U","🙃","Upside Down","The world flipped.","Tap the very bottom of the page, fast."],
    ["logos10","x","U","🎡","Logo Spinner","Ten logo taps.","Tap logos. Many logos."],
    ["refresh7","x","U","😵‍💫","Dizzy","Refresh a bit too hard.","Tap Refresh repeatedly."],
    ["owl","x","U","🦉","Night Owl","Scores don't sleep.","Visit very late at night."],
    ["bat","x","U","🦇","Spooky Season","It's October.","Visit in October."],
    ["goat","x","U","🐐","GOAT","Greatest. Of. All. Typed.","On a keyboard, type the greatest of all time."],
    ["gear","x","U","⚙️","Gear Head","Tightened every bolt.","Give the settings gear some attention."],
    ["whip","x","U","🌪️","Whiplash","Bottom to top in a blink.","Scroll to the bottom and straight back up."],
    ["land","x","U","📱","Sideways","Landscape lover.","Turn your phone sideways."],
    ["konami","x","R","🕹️","Retro Mode","Up up down down...","A classic cheat code."],
    ["golden","x","R","🪙","Golden Card","One card turned to gold.","Sometimes a card shines gold."],
    ["hold","x","R","🧢","Lucky Number","Press and hold on a good luck charm.","Press and hold the title."],
    ["off","x","R","📡","Off The Grid","You went offline.","Lose your connection."],
    ["legend","x","L","👑","Legendary Win","The whole screen celebrates.","A very rare celebration after a win."],
    ["d_ny","d","U","🎆","New Year","Fresh season energy.","Visit on January 1st."],
    ["d_j4","d","U","🗽","Fourth of July","Fireworks and baseball.","Visit on July 4th."],
    ["d_xmas","d","U","🎄","Christmas Day","Basketball and snow.","Visit on December 25th."],
    ["d_val","d","U","💘","Valentine's","Love of the game.","Visit on February 14th."],
    ["d_pi","d","R","🥧","Pi Day","3.14 games to go.","Visit on March 14th."],
    ["d_hween","d","R","🎃","Trick Or Treat","Treat yourself to the scores.","Visit on October 31st."],
    ["d_f13","d","R","🐈‍⬛","Friday the 13th","Unlucky for someone.","Visit on a Friday the 13th."],
    ["d_leap","d","L","🐸","Leap Day","Once every four years.","Visit on February 29th."],
    ["t_lunch","t","C","🥪","Lunch Break","Scores with a sandwich.","Visit around noon."],
    ["t_early","t","U","🌅","Early Bird","Checking scores at sunrise.","Visit between 5 and 7 AM."],
    ["t_mid","t","R","🌙","Midnight Oil","Past the witching hour.","Visit just after midnight."],
    ["t_d7","t","R","📆","Regular","Seven different days.","Come back on seven different days."],
    ["t_d30","t","E","🎟️","Season Ticket","Thirty different days. Dedicated.","Come back on thirty different days."],
    ["m10","m","U","📒","Rookie Collector","Ten cards in the binder.","Collect 10 cards."],
    ["m25","m","R","🗂️","Veteran Collector","Twenty-five and counting.","Collect 25 cards."],
    ["m50","m","L","📚","Hall Of Famer","Fifty cards. Impressive.","Collect 50 cards."],
    ["m100","m","L","🏅","Centurion","One hundred cards. Respect.","Collect 100 cards."],
    ["gt","m","M","🎫","Golden Ticket","One in six hundred, every time the page changes. Nobody finds this on purpose.","It's in the air. Keep moving around."],
    ["all","m","M","💎","Completionist","Every card. Every one.","Find every other card."]
  ];
  var TEAMS = {
    nfl: "Green Bay Packers|Packers|🧀|M\nDallas Cowboys|Cowboys|🤠|L\nNew England Patriots|Patriots|🎖️|L\nPittsburgh Steelers|Steelers|⚙️|L\nSan Francisco 49ers|49ers|⛏️|E\nKansas City Chiefs|Chiefs|🏹|E\nNew York Giants|Giants|🏔️|E\nChicago Bears|Bears|🐻|E\nPhiladelphia Eagles|Eagles|🦅|E\nDenver Broncos|Broncos|🐴|R\nLas Vegas Raiders|Raiders|🏴|R\nWashington Commanders|Commanders|🪖|R\nBaltimore Ravens|Ravens|🪶|R\nSeattle Seahawks|Seahawks|🌊|R\nLos Angeles Rams|Rams|🐏|R\nMiami Dolphins|Dolphins|🐬|R\nIndianapolis Colts|Colts|🏇|U\nBuffalo Bills|Bills|🦬|U\nMinnesota Vikings|Vikings|⚔️|U\nCleveland Browns|Browns|🟤|U\nNew Orleans Saints|Saints|⚜️|U\nTampa Bay Buccaneers|Buccaneers|☠️|U\nCincinnati Bengals|Bengals|🐯|U\nNew York Jets|Jets|✈️|U\nArizona Cardinals|Cardinals|🐦|C\nAtlanta Falcons|Falcons|🪽|C\nCarolina Panthers|Panthers|🐆|C\nDetroit Lions|Lions|🦁|C\nHouston Texans|Texans|🐂|C\nJacksonville Jaguars|Jaguars|🐾|C\nLos Angeles Chargers|Chargers|⚡|C\nTennessee Titans|Titans|🔱|C".split("\n"),
    nba: "Boston Celtics|Celtics|☘️|M\nLos Angeles Lakers|Lakers|🌴|L\nChicago Bulls|Bulls|🐃|L\nGolden State Warriors|Warriors|🌉|L\nSan Antonio Spurs|Spurs|🌵|E\nMiami Heat|Heat|🔥|E\nDetroit Pistons|Pistons|🔧|E\nNew York Knicks|Knicks|🗽|E\nHouston Rockets|Rockets|🚀|E\nPhiladelphia 76ers|76ers|🔔|R\nMilwaukee Bucks|Bucks|🦌|R\nDallas Mavericks|Mavericks|🐎|R\nPhoenix Suns|Suns|☀️|R\nOklahoma City Thunder|Thunder|⛈️|R\nDenver Nuggets|Nuggets|⛰️|R\nCleveland Cavaliers|Cavaliers|🛡️|R\nToronto Raptors|Raptors|🦖|U\nPortland Trail Blazers|Trail Blazers|🌲|U\nOrlando Magic|Magic|🪄|U\nIndiana Pacers|Pacers|🏎️|U\nSacramento Kings|Kings|👑|U\nAtlanta Hawks|Hawks|🦅|U\nLA Clippers|Clippers|⛵|U\nBrooklyn Nets|Nets|🕸️|U\nCharlotte Hornets|Hornets|🐝|C\nMemphis Grizzlies|Grizzlies|🐻‍❄️|C\nNew Orleans Pelicans|Pelicans|🪺|C\nMinnesota Timberwolves|Timberwolves|🐺|C\nUtah Jazz|Jazz|🎷|C\nWashington Wizards|Wizards|🧙|C".split("\n"),
    mlb: "New York Yankees|Yankees|🎩|M\nSt. Louis Cardinals|Cardinals|🐦|L\nBoston Red Sox|Red Sox|🧦|L\nLos Angeles Dodgers|Dodgers|🐕|L\nSan Francisco Giants|Giants|🌉|E\nAthletics|Athletics|🐘|E\nCincinnati Reds|Reds|🔴|E\nChicago Cubs|Cubs|🐻|E\nAtlanta Braves|Braves|🪓|E\nDetroit Tigers|Tigers|🐯|R\nPittsburgh Pirates|Pirates|🏴‍☠️|R\nBaltimore Orioles|Orioles|🪺|R\nPhiladelphia Phillies|Phillies|🔔|R\nHouston Astros|Astros|🪐|R\nNew York Mets|Mets|🍎|R\nMinnesota Twins|Twins|👯|R\nToronto Blue Jays|Blue Jays|🐦|U\nCleveland Guardians|Guardians|🛡️|U\nKansas City Royals|Royals|👑|U\nArizona Diamondbacks|Diamondbacks|🐍|U\nMiami Marlins|Marlins|🐟|U\nLos Angeles Angels|Angels|😇|U\nChicago White Sox|White Sox|⚪|U\nTexas Rangers|Rangers|🤠|U\nTampa Bay Rays|Rays|🌞|C\nColorado Rockies|Rockies|🏔️|C\nMilwaukee Brewers|Brewers|🍺|C\nSeattle Mariners|Mariners|⚓|C\nWashington Nationals|Nationals|🏛️|C\nSan Diego Padres|Padres|⛪|C".split("\n"),
    nhl: "Montréal Canadiens|Canadiens|🍁|M\nDetroit Red Wings|Red Wings|🪽|L\nToronto Maple Leafs|Maple Leafs|🍃|L\nBoston Bruins|Bruins|🐻|L\nChicago Blackhawks|Blackhawks|🪶|E\nPittsburgh Penguins|Penguins|🐧|E\nEdmonton Oilers|Oilers|🛢️|E\nNew York Islanders|Islanders|🏝️|E\nNew York Rangers|Rangers|🗽|E\nPhiladelphia Flyers|Flyers|🛸|R\nNew Jersey Devils|Devils|😈|R\nColorado Avalanche|Avalanche|🏔️|R\nTampa Bay Lightning|Lightning|⚡|R\nLos Angeles Kings|Kings|👑|R\nDallas Stars|Stars|⭐|R\nWashington Capitals|Capitals|🦅|R\nCarolina Hurricanes|Hurricanes|🌀|U\nAnaheim Ducks|Ducks|🦆|U\nSt. Louis Blues|Blues|🎵|U\nCalgary Flames|Flames|🔥|U\nVancouver Canucks|Canucks|🐳|U\nBuffalo Sabres|Sabres|🗡️|U\nOttawa Senators|Senators|🏛️|U\nVegas Golden Knights|Golden Knights|🛡️|U\nFlorida Panthers|Panthers|🐆|C\nNashville Predators|Predators|🐯|C\nWinnipeg Jets|Jets|✈️|C\nMinnesota Wild|Wild|🌲|C\nSan Jose Sharks|Sharks|🦈|C\nColumbus Blue Jackets|Blue Jackets|🧥|C\nSeattle Kraken|Kraken|🦑|C\nUtah Mammoth|Mammoth|🦣|C".split("\n")
  };
  var TCAT = { nfl: "tn", nba: "tb", mlb: "tm", nhl: "th" }, TLBL = { nfl: "NFL", nba: "NBA", mlb: "MLB", nhl: "NHL" }, TK = {};
  var TFL = {
    C: ["A steady presence on the schedule.", "Never far from a scoreboard.", "Part of the everyday slate."],
    U: ["A name that gets noticed.", "Always worth a look at game time.", "Quietly collectible."],
    R: ["A real find in the log.", "Collectors circle this one.", "Hard to pull on any given night."],
    E: ["Big moments live here.", "A banner franchise.", "History lives here."],
    L: ["Banners for days.", "A dynasty's name on the card.", "Legends wore this crest."],
    M: ["Franchise royalty.", "Top of the mountain.", "The rarest crest in the league."]
  };
  function slug(x) { return String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  Object.keys(TEAMS).forEach(function (lk) {
    TEAMS[lk].forEach(function (t, i) {
      var p = t.split("|"), id = "t_" + lk + "_" + slug(p[1]);
      CAT.push([id, TCAT[lk], p[3], p[2], p[0], TFL[p[3]][(i + p[1].length) % 3], "Open a game featuring the " + p[1] + ". The rarer the team, the lower the drop chance."]);
      TK[lk + "|" + slug(p[0])] = id;
    });
  });
  TK["nba|losangelesclippers"] = "t_nba_clippers"; TK["nhl|utahhockeyclub"] = "t_nhl_mammoth"; TK["mlb|oaklandathletics"] = "t_mlb_athletics";
  CAT.push(["mack", "m", "S", "🦬", "Mack", "Glad to have you.", "Create an account."]);
  var IDX = {}; CAT.forEach(function (c, i) { c.n = i + 1; IDX[c[0]] = c; });
  var TOTAL = CAT.length, col = { i: {}, s: {}, d: [] };
  try { var rc = JSON.parse(localStorage.getItem("sb-col") || "null"); if (rc && rc.i) col = rc; } catch (e) {}
  try {                                          // migrate the old secrets store
    var old = JSON.parse(localStorage.getItem("sb-fun") || "null");
    if (old) { for (var ok in old) if (IDX[ok] && !col.i[ok]) col.i[ok] = [Date.now(), 1]; localStorage.removeItem("sb-fun"); }
  } catch (e) {}
  if (!col.s) col.s = {}; if (!col.d) col.d = [];
  var saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem("sb-col", JSON.stringify(col)); } catch (e) {} }, 700); }
  function count() { var n = 0; for (var k in col.i) if (IDX[k]) n++; return n; }
  function say(msg, go, cls) { var t = $("toast"); if (!t) return; t.textContent = msg; t.className = (go ? "show go" : "show") + (cls ? " " + cls : ""); t.onclick = go ? function () { t.className = ""; t.onclick = null; go(); } : null; clearTimeout(say.h); say.h = setTimeout(function () { t.className = ""; t.onclick = null; }, go ? 5500 : 3800); }
  var newQ = [], newT = 0;
  function disc(id, extra) {
    var c = IDX[id]; if (!c) return;
    var e = col.i[id]; if (e) { e[1]++; save(); return; }
    col.i[id] = [Date.now(), 1]; if (extra) col.i[id][2] = extra; save(); newQ.push(c);
    try { if (localStorage.getItem("sb-lb") && window.SB_LOAD) { clearTimeout(disc.lt); disc.lt = setTimeout(function () { SB_LOAD(function () { PROF.sync(); }); }, 8000); } } catch (e) {}
    clearTimeout(newT); newT = setTimeout(function () {
      var q = newQ; newQ = [];
      var cid = q.length === 1 ? q[0][0] : null;
      var quick = false; try { quick = localStorage.getItem("sb-rv") === "q"; } catch (e) {}
      if (!quick && reveal(q)) return;
      var mt = Math.max.apply(null, q.map(tier)); if (mt === 1 && !RM) gConfetti(10, ["✨"]);
      else if (mt >= 2 && quick) vib(30);
      say((q.length === 1 ? "✨ New card: " + q[0][4] + " · " + RAR[q[0][2]] : "✨ " + q.length + " new cards in your Collection Log") + " ›", function () { if (window.SB_LOAD) SB_LOAD(function () { PROF.open("log", cid ? { card: cid } : null); }); }, "r" + "CURELM".charAt(mt));
          }, newQ.some(function (c) { return tier(c) >= 3; }) ? 1100 : 450);
    var n = count(); if (n >= 10) disc("m10"); if (n >= 25) disc("m25"); if (n >= 50) disc("m50"); if (n >= 100) disc("m100");
    if (id !== "all" && n >= TOTAL - 1) disc("all");
  }

  // ---------- new-card reveal (scales with rarity) ----------
  var CH = [0, 0, 250, 850, 1350, 1900, 2500], RVW = ["", "", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "SIGNATURE"], RVC = { R: "#38bdf8", E: "#a78bfa", L: "#ffb020", M: "#ff4d8d", S: "#c4b9f2" }, rvO = null;
  function E(t, c, x) { var e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var MK = '<svg class="mkl" viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7095"/><stop offset="1" stop-color="#2d3a55"/></linearGradient><linearGradient id="kh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b9f2"/><stop offset="1" stop-color="#9b8cd9"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#kg)"/><path d="M126 214C64 214 40 164 46 92c28 48 62 58 136 58v64z" fill="url(#kh)"/><path d="M386 214c62 0 86-50 80-122-28 48-62 58-136 58v64z" fill="url(#kh)"/><path d="M122 410V198h60l74 110 74-110h60v212h-56V292l-56 80h-44l-56-80v118z" fill="#eef1f6"/></svg>';
  function artEl(c, cls, px, got) {             // team cards show their real logo once found
    if (c[0] === "mack") { var mk = E("span", cls + " mkw"); mk.innerHTML = MK; return mk; }
    var e = col.i[c[0]], p = got && e && e[2];
    if (p) {
      var im = E("img", cls + " lg"); im.alt = c[4]; im.loading = "lazy"; im.decoding = "async";
      im.onerror = function () { var s2 = E("span", cls, c[3]); if (im.parentNode) im.parentNode.replaceChild(s2, im); };
      im.src = "https://a.espncdn.com/combiner/i?img=" + p + "&w=" + px + "&h=" + px; return im;
    }
    return E("span", cls, c[3]);
  }
  var TP = { C: .5, U: .35, R: .2, E: .1, L: .05, M: .025 };
  function teamDrop(lk, g) {                     // opening a game rolls once for each team in it, by rarity
    if (!g || !TCAT[lk]) return;
    var rolled, ch = false; try { rolled = JSON.parse(localStorage.getItem("sb-roll") || "[]"); } catch (e) { rolled = []; }
    [g.h, g.a].forEach(function (s) {
      if (!s) return; var id = TK[lk + "|" + slug(s[0])]; if (!id || col.i[id]) return;
      var key = lk + g.id + id; if (rolled.indexOf(key) >= 0) return;
      rolled.push(key); ch = true;
      if (Math.random() < TP[IDX[id][2]]) { var m = /img=([^&]+)/.exec(s[5] || ""); disc(id, m ? decodeURIComponent(m[1]) : ""); }
    });
    if (ch) { try { localStorage.setItem("sb-roll", JSON.stringify(rolled.slice(-300))); } catch (e) {} }
  }
  function tier(c) { return "CURELMS".indexOf(c[2]); }
  function vib(p) { try { if (!RM && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function revealClose() {
    if (!rvO) return; var o = rvO; rvO = null; clearTimeout(o._a); clearTimeout(o._c);
    D.body.classList.remove("rv-on"); o.classList.remove("in"); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 260);
  }
  function reveal(q, replay) {
    var c = q.slice().sort(function (a, b) { return tier(b) - tier(a); })[0], t = tier(c);
    if (t < 2) return false;
    revealClose();
    var o = E("div", "rv r" + c[2] + " t" + t), done = false, ok = false, col2 = RVC[c[2]];
    rvO = o; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "New card: " + c[4]);
    o.appendChild(E("div", "rv-bg"));
    if (t >= 5) { var st = E("div", "rv-st"), sh = []; for (var i = 0; i < 36; i++) sh.push(rnd(100) + "vw " + rnd(100) + "vh 0 " + rnd(2) + "px #fff"); st.style.boxShadow = sh.join(","); o.appendChild(st); }
    o.appendChild(E("div", "rv-fl"));
    var ttl = E("div", "rv-t"); ttl.appendChild(E("div", "rv-s", replay ? "CARD" : "NEW CARD"));
    var w = E("div", "rv-w"); RVW[t].split("").forEach(function (ch, k) { var l = E("i", null, ch); l.style.setProperty("--i", k); w.appendChild(l); }); ttl.appendChild(w); o.appendChild(ttl);
    var cw = E("div", "rv-cw"), chg = E("div", "rv-ch"), flip = E("div", "rv-flip");
    chg.style.setProperty("--sa", [0, 0, 1, 2, 4, 6, 8][t] + "px"); chg.style.setProperty("--ch", CH[t] + "ms");
    flip.appendChild(E("div", "rv-bk", "?"));
    var card = E("div", "tc r" + c[2] + " got"), hd = E("div", "tc-h"); hd.appendChild(E("span", null, "No. " + ("00" + c.n).slice(-3) + " / " + ("00" + TOTAL).slice(-3))); hd.appendChild(E("span", null, CATS[c[1]])); card.appendChild(hd);
    var art = E("div", "tc-art"); art.appendChild(artEl(c, "tc-em", 200, true)); card.appendChild(art);
    card.appendChild(E("h3", "tc-n", c[4]));
    var rb = E("div", "tc-rar"); rb.appendChild(E("i", null, c[2])); rb.appendChild(D.createTextNode(RAR[c[2]])); card.appendChild(rb);
    card.appendChild(E("p", "tc-d", c[5])); card.appendChild(E("span", "tc-foil"));
    flip.appendChild(card); chg.appendChild(flip); cw.appendChild(chg); o.appendChild(cw);
    var ctl = E("div", "rv-c");
    if (!replay) { var b1 = E("button", "pm-b pri", "View in log"); b1.type = "button"; b1.onclick = function () { revealClose(); if (window.SB_LOAD) SB_LOAD(function () { PROF.open("log", { card: c[0] }); }); }; ctl.appendChild(b1); }
    var b2 = E("button", "pm-b", "Continue"); b2.type = "button"; b2.onclick = revealClose; ctl.appendChild(b2); o.appendChild(ctl);
    if (q.length > 1) o.appendChild(E("div", "rv-m", "+" + (q.length - 1) + " more new card" + (q.length > 2 ? "s" : "") + " in your log"));
    if (!RM) chg.classList.add("chg");
    function burst() {
      if (done) return; done = true; clearTimeout(o._c);
      chg.classList.remove("chg"); flip.classList.add("fl"); o.classList.add("go");
      if (!replay) { col.s[c[0]] = 1; save(); }
      if (!RM) {
        var cx = innerWidth / 2, cy = innerHeight * .42;
        if (t >= 3) { o.classList.add("shk"); setTimeout(function () { o.classList.remove("shk"); }, 520); }
        gBurst(cx, cy, col2, [0, 0, 14, 26, 38, 44, 56][t]);
        if (t === 2) { gConfetti(16, ["✨", "💠"]); vib(30); }
        else if (t === 3) { gConfetti(44, ["✨", "🔮", "💜"]); vib([30, 40, 70]); }
        else if (t === 4) { gConfetti(90, ["✨", "⭐", "🪙", "🏆", "👑"]); setTimeout(function () { gBurst(cx, cy, "#fff3b0", 30); }, 220); vib([40, 30, 40, 30, 140]); }
        else { gFireworks(); gConfetti(140, t === 6 ? ["🦬", "✨", "💎", "⭐", "🔷"] : ["💎", "✨", "🌈", "⭐", "🎫", "🔥"]); setTimeout(function () { gBurst(cx, cy, "#ffffff", 40); }, 260); vib([60, 40, 60, 40, 60, 40, 240]); }
      }
      setTimeout(function () { ok = true; o.classList.add("ok"); }, RM ? 0 : 650);
      if (t === 2) o._a = setTimeout(revealClose, 5200); else if (t === 3) o._a = setTimeout(revealClose, 9000);
    }
    o.onclick = function (e) { if (e.target.closest && e.target.closest("button")) return; if (!done) burst(); else if (ok) revealClose(); };
    D.body.appendChild(o); D.body.classList.add("rv-on");
    requestAnimationFrame(function () { o.classList.add("in"); });
    o._c = setTimeout(burst, RM ? 0 : CH[t]);
    return true;
  }
  D.addEventListener("keydown", function (e) { if (e.key === "Escape" && rvO) { e.stopImmediatePropagation(); revealClose(); } }, true);
  var found = disc;
  function wpick(key, arr, idf) {                // weighted by rarity, never the same as the last two
    var h = hist[key] || (hist[key] = []), c, t = 0;
    do {
      var tot = 0, ws = arr.map(function (x) { var d = IDX[idf(x)]; var w = d ? RW[d[2]] : 5; tot += w; return w; }), r = Math.random() * tot, i = 0;
      while (i < arr.length - 1 && r >= ws[i]) { r -= ws[i]; i++; }
      c = arr[i]; t++;
    } while (h.indexOf(c) >= 0 && t < 12);
    h.push(c); if (h.length > 2) h.shift(); disc(idf(c)); return c;
  }
  // days visited
  (function () { var d = new Date(), k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); if (col.d.indexOf(k) < 0) { col.d.push(k); if (col.d.length > 60) col.d.shift(); save(); } })();

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
  var BN = { "🏈": "football", "🏀": "basketball", "🏒": "hockey", "⚾": "baseball", "⚽": "soccer", "🏐": "volley", "🥎": "softball", "🎾": "tennis" };
  function ball() {
    var g = layer(), em = wpick("ball", ["🏈", "🏀", "🏒", "⚾", "⚽", "🏐", "🥎", "🎾"], function (x) { return "b_" + BN[x]; });
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
  var ENTER = ["rise", "flip", "zoom", "slidel", "slider", "swing", "blur", "drop", "spin", "tilt"];
  function enterFx() { return RM ? "rise" : wpick("enter", ENTER, function (k) { return "e_" + k; }); }
  var arrivals = 0;
  function after(out) {
    var st = out.querySelectorAll(".fire3,.fire5,.cold3,.cold5,.heat");
    for (var si = 0; si < st.length; si++) { var cl = st[si].classList; ["fire3", "fire5", "cold3", "cold5"].forEach(function (k) { if (cl.contains(k)) disc("s_" + k); }); if (cl.contains("heat")) disc("s_heat"); }
    if (RM) return; arrivals++;
    if (Math.random() < 1 / 600) { disc("gt"); gConfetti(90, ["🎫", "✨", "💎"]); say("🎫 GOLDEN TICKET"); }
    var cards = shuffle([].slice.call(out.querySelectorAll(".recap.w,.recap.l,.card.followed"))).slice(0, 4), anyWin = false;
    cards.forEach(function (c) {
      var win = c.classList.contains("w") || !!c.querySelector(".pill.final.w"), loss = c.classList.contains("l") || !!c.querySelector(".pill.final.l");
      if (!win && !loss) return;
      if (win) {
        anyWin = true;
        if (Math.random() < .12) return;                                  // sometimes keep the classic confetti
        var cf = c.querySelector(":scope > .cf"); if (cf) cf.parentNode.removeChild(cf);
        WIN[wpick("win", WINK, function (k) { return "w_" + k; })](holder(c));
      } else {
        var k = wpick("lose", LOSEK, function (x) { return "l_" + x; });
        if (Math.random() < .12) { disc("l_shake"); c.classList.add("fx-shake"); setTimeout(function () { c.classList.remove("fx-shake"); }, 700); }
        else LOSE[k](holder(c));
      }
    });
    if (anyWin && Math.random() < .045) { gConfetti(70); found("legend"); }
    var r = Math.random();
    if (r < .07) ball(); else if (r < .12) seasonal(); else if (r < .15) gold(out); else if (r < .17) cameo();
    special();
  }
  var SPECIAL_DONE = false;
  function dates() {
    var d = new Date(), m = d.getMonth() + 1, dd = d.getDate(), h = d.getHours();
    if (m === 1 && dd === 1) disc("d_ny"); if (m === 7 && dd === 4) disc("d_j4"); if (m === 12 && dd === 25) disc("d_xmas");
    if (m === 2 && dd === 14) disc("d_val"); if (m === 3 && dd === 14) disc("d_pi"); if (m === 10 && dd === 31) disc("d_hween");
    if (m === 2 && dd === 29) disc("d_leap"); if (d.getDay() === 5 && dd === 13) disc("d_f13");
    if (h === 12) disc("t_lunch"); if (h >= 5 && h < 7) disc("t_early"); if (h === 0) disc("t_mid");
    if (m === 10) disc("bat");
    if (col.d.length >= 7) disc("t_d7"); if (col.d.length >= 30) disc("t_d30");
  }
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
  var CAMN = { "🛸": "ufo", "🚁": "heli", "🪁": "kite", "🦄": "unicorn", "🐢": "turtle", "🚂": "train", "🦅": "eagle", "🚀": "rocket", "🏃": "runner", "🐕": "dog" };
  function cameo() { flyer(wpick("cam", Object.keys(CAMN), function (x) { return "c_" + CAMN[x]; }), Math.random() < .5 ? "slow" : ""); found("cameo"); }
  function gold(out) {
    var c = out.querySelector(".card,.recap,.story"); if (!c) return;
    c.classList.add("gold"); found("golden"); setTimeout(function () { c.classList.remove("gold"); }, 9000);
  }

  // ---------- poking things ----------
  var taps = { title: [], foot: [], logos: 0, refresh: [], dbl: 0 };
  function recent(arr, win) { var n = Date.now(); arr.push(n); while (arr.length && n - arr[0] > win) arr.shift(); return arr.length; }
  var LOGOFX = ["spin", "bounce", "wobble", "grow", "jelly", "flip"];
  function logoFx(el) { var k = wpick("logo", LOGOFX, function (x) { return "g_logo_" + x; }), cls = "lg-" + k; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(function () { el.classList.remove(cls); }, 1000); }
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
      var b = $("refresh"), k = wpick("rf", RF, function (x) { return "g_rf_" + x; }), cl = "rf-" + k;
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

  // ---------- more things to find ----------
  var seenTabs = {};
  D.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var rb = t.closest("#rail button"); if (rb) { seenTabs[rb.textContent] = 1; if (Object.keys(seenTabs).length >= 5) disc("tour"); }
    if (t.closest("#refresh") && recent(taps.stamp || (taps.stamp = []), 2500) >= 5) { taps.stamp.length = 0; disc("stamp"); say("⏱️ Yes, it's still ticking."); }
    if (t.closest("#gear") && recent(taps.gear || (taps.gear = []), 3000) >= 7) { taps.gear.length = 0; disc("gear"); var g = $("gear"); if (!RM) { g.classList.add("gear-go"); setTimeout(function () { g.classList.remove("gear-go"); }, 1400); } say("⚙️ Loose bolt found."); }
  }, true);
  addEventListener("hashchange", function () { if (/^#game\//.test(location.hash)) disc("dive"); });
  addEventListener("offline", function () { disc("off"); });
  var lm = window.matchMedia && matchMedia("(orientation: landscape) and (pointer: coarse) and (max-height: 520px)");
  if (lm) { var lc = function () { if (lm.matches) disc("land"); }; if (lm.addEventListener) lm.addEventListener("change", lc); lc(); }
  var typed = "";
  D.addEventListener("keydown", function (e) {
    if (!e.key || e.key.length !== 1 || (e.target && /input|textarea/i.test(e.target.tagName))) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (typed === "goat") { disc("goat"); if (!RM) gConfetti(40, ["🐐"]); say("🐐 GOAT"); }
  });
  var hT = 0;
  D.addEventListener("pointerdown", function (e) {
    if (!e.target.closest || !e.target.closest("#title")) return;
    clearTimeout(hT); hT = setTimeout(function () { disc("hold"); say("🧢 Your lucky number today: #" + (1 + rnd(99))); }, 1300);
  });
  ["pointerup", "pointercancel", "scroll"].forEach(function (n) { addEventListener(n, function () { clearTimeout(hT); }, { passive: true }); });
  var bottomAt = 0;
  addEventListener("scroll", function () {
    var nb = innerHeight + scrollY >= D.documentElement.scrollHeight - 6;
    if (nb) bottomAt = Date.now(); else if (scrollY < 40 && bottomAt && Date.now() - bottomAt < 2000) { bottomAt = 0; disc("whip"); }
  }, { passive: true });
  dates();

  window.FUN = { art: artEl, team: teamDrop, reveal: function (c) { reveal([c], true); }, CAT: CAT, CATS: CATS, RAR: RAR, IDX: IDX, col: function () { return col; }, disc: disc, saveCol: save,
    seen: function (id) { col.s[id] = 1; save(); },
    play: function (id, host) {
      var p = id.split("_"), k = p[1];
      if (p[0] === "w" && WIN[k]) WIN[k](holder(host)); else if (p[0] === "l" && LOSE[k]) LOSE[k](holder(host));
      else if (p[0] === "c") flyer(Object.keys(CAMN).filter(function (x) { return "c_" + CAMN[x] === id; })[0] || "🛸");
      else if (p[0] === "b") { var em = Object.keys(BN).filter(function (x) { return "b_" + BN[x] === id; })[0]; var g = layer(), b = mk("fx-ball roll", "", ""), i2 = D.createElement("b"); i2.textContent = em; b.appendChild(i2); g.appendChild(b); gone(b, 3600); }
    },
    say: say, confetti: gConfetti, enterFx: enterFx, after: after, count: count, total: TOTAL, reduced: RM };
})();
