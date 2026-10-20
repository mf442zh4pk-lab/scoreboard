/* Delight layer: random celebrations, easter eggs, cameos. Loaded after first paint so it never slows startup. */
(function () {
  "use strict";
  var D = document, RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || D.documentElement.classList.contains("rm");   // phone setting, or Animations off in Settings
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
  var CATS = { w: "Celebrations", l: "Heartbreaks", e: "Entrances", c: "Cameos", b: "Ball Drops", g: "Gestures", s: "Streaks", x: "Secrets", d: "Calendar", t: "Habits", m: "Milestones", tn: "NFL Teams", tb: "NBA Teams", tm: "MLB Teams", th: "NHL Teams", h: "Holidays", mn: "NFL Moments", mb: "NBA Moments", mm: "MLB Moments", mh: "NHL Moments" };
  var RAR = { C: "Common", U: "Uncommon", R: "Rare", E: "Epic", L: "Legendary", M: "Mythic", S: "Signature" };
  var RW = { C: 11, U: 3.5, R: 1.2, E: .35, L: .08, M: .012, S: 0 };   // effect picks (wpick) only
  // Card odds are set per tier, not per card, so they hold however many cards a tier has: each card drawn (in a pack or
  // from a tap) is Mythic 1 in 1000, so about 1 pack in 100 has one. Each step down is a bigger share.
  var TIER = { C: .628, U: .25, R: .09, E: .025, L: .006, M: .001 };
  function tierPick(pool) {                      // a card from pool with TIER odds, spread evenly inside each tier
    var n = {}; pool.forEach(function (c) { n[c[2]] = (n[c[2]] || 0) + 1; });
    return wchoice(pool, function (c) { return (TIER[c[2]] || 0) / n[c[2]]; });
  }
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
    ["gear","x","U","⚙️","Gear Head","Tightened every bolt.","Open Settings from your profile again and again."],
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
  var MOMS = {
    nfl: "Immaculate Reception|🙌|M|December 23, 1972, AFC divisional playoff. Trailing Oakland 7–6 with 22 seconds left, Terry Bradshaw's fourth-down pass ricocheted off a collision between Frenchy Fuqua and Jack Tatum. Franco Harris scooped it inches off the turf and ran 60 yards for the touchdown, the first playoff win in Steelers history.|steelers,raiders\nThe Catch|🤲|M|January 10, 1982, NFC Championship. Down 27–21 to Dallas with under a minute left, Joe Montana rolled right under pressure and lofted a ball to the back of the end zone. Dwight Clark leapt and pulled it in with his fingertips. The 49ers won their first Super Bowl two weeks later, and a dynasty was born.|49ers,cowboys\n28–3|🐐|M|Super Bowl LI, February 5, 2017. Atlanta led New England 28–3 late in the third quarter. Tom Brady and the Patriots scored 25 unanswered points, forced the first overtime in Super Bowl history, and won 34–28 on a James White touchdown run. The largest comeback the big game has ever seen.|patriots,falcons\nThe Helmet Catch|🪖|L|Super Bowl XLII, February 3, 2008. With the Patriots one win from a perfect 19–0, Eli Manning slipped out of a near-sack and heaved it downfield. David Tyree pinned the ball against his helmet with one hand as Rodney Harrison tore at it. Four plays later the Giants scored the winning touchdown.|giants,patriots\nThe Guarantee|📣|L|Super Bowl III, January 12, 1969. Three days before the game, Jets quarterback Joe Namath told a crowd in Miami, \"We're gonna win the game. I guarantee it.\" The AFL's Jets were 18-point underdogs to the NFL's Colts. They won 16–7, and the two leagues were never looked at the same way again.|jets,colts\nMiracle at the Meadowlands|🏈|L|November 19, 1978. The Giants led the Eagles 17–12 and only had to take a knee. Instead they ran a handoff, Larry Csonka and Joe Pisarcik fumbled the exchange, and Herman Edwards picked it up and ran it in for the winning touchdown. The victory formation exists because of this play.|eagles,giants\nMusic City Miracle|🎶|L|January 8, 2000, AFC wild card. Buffalo had just kicked a go-ahead field goal with 16 seconds left. On the kickoff, Lorenzo Neal handed to Frank Wycheck, who threw a lateral across the field to Kevin Dyson. Dyson ran 75 yards for the touchdown, and the Titans went on to the Super Bowl.|titans,bills\nStaubach's Hail Mary|🙏|L|December 28, 1975, NFC divisional playoff in Minnesota. Trailing 14–10 with 32 seconds left, Roger Staubach threw a 50-yard prayer toward Drew Pearson, who caught it at the hip and walked in. Asked about it afterward, Staubach said he closed his eyes and said a Hail Mary. The name stuck for every desperation throw since.|cowboys,vikings\nThe Perfect Season|💯|L|1972. The Miami Dolphins went 14–0 in the regular season, won two playoff games, and beat Washington 14–7 in Super Bowl VII to finish 17–0. More than fifty years later, no other NFL team has gone through a full season and the playoffs without losing a game.|dolphins\nMalcolm Butler's Interception|🛡️|L|Super Bowl XLIX, February 1, 2015. Seattle had the ball on the one-yard line with 26 seconds left, trailing 28–24. Instead of handing to Marshawn Lynch, Russell Wilson threw a quick slant, and undrafted rookie Malcolm Butler jumped the route and intercepted it at the goal line. New England's fourth title, sealed by a player almost nobody knew.|patriots,seahawks\nThe Ice Bowl|🥶|E|December 31, 1967, NFL Championship at Lambeau Field. Game-time temperature was 13 below zero, and the turf was frozen solid. With 16 seconds left and Green Bay trailing Dallas 17–14, Bart Starr called a quarterback sneak behind Jerry Kramer's block and fell into the end zone. The Packers won 21–17 and went on to Super Bowl II.|packers,cowboys\nThe Drive|🚗|E|January 11, 1987, AFC Championship in Cleveland. Denver took over on its own two-yard line, trailing 20–13 with 5:32 left. John Elway led a 15-play, 98-yard drive, hitting Mark Jackson for the tying touchdown with 37 seconds to go. The Broncos won in overtime and went to the Super Bowl.|broncos,browns\nWide Right|↗️|E|Super Bowl XXV, January 27, 1991. The Bills trailed the Giants 20–19 with eight seconds left and lined up Scott Norwood for a 47-yard field goal. The kick had the distance but drifted just outside the right upright. It was the first of four straight Super Bowl losses for Buffalo.|bills,giants\nOne Yard Short|📏|E|Super Bowl XXXIV, January 30, 2000. Tennessee trailed St. Louis 23–16 with six seconds left and the ball on the 10. Steve McNair hit Kevin Dyson on a slant, and Rams linebacker Mike Jones wrapped him up as he stretched for the goal line. The ball came to rest one yard short as time ran out.|rams,titans\nBeast Quake|🌋|E|January 8, 2011, NFC wild card. Marshawn Lynch took a handoff on a late fourth-quarter run against New Orleans, broke eight tackles, stiff-armed Tracy Porter to the ground, and scored from 67 yards out. The crowd at Seattle's stadium jumped so hard that a nearby seismograph registered the celebration.|seahawks,saints\nMinneapolis Miracle|🪄|E|January 14, 2018, NFC divisional playoff. The Vikings trailed the Saints 24–23 with ten seconds left and no timeouts, needing a field goal just to have a chance. Case Keenum threw to Stefon Diggs near the sideline, Marcus Williams missed the tackle, and Diggs ran 61 yards for the touchdown as time expired. The first playoff game ever won on a walk-off touchdown.|vikings,saints\nPhilly Special|🦅|E|Super Bowl LII, February 4, 2018. Fourth-and-goal from the one, just before halftime. Nick Foles stepped up as if to audible, the ball was snapped to Corey Clement, who pitched to tight end Trey Burton, who threw it to a wide-open Foles in the end zone. The Eagles beat New England 41–33 for their first Super Bowl title.|eagles,patriots\nTuck Rule Game|🌨️|E|January 19, 2002, AFC divisional playoff in a Foxborough snowstorm. Charles Woodson appeared to strip Tom Brady late in the fourth quarter, which would have sealed an Oakland win. The officials reviewed it and ruled Brady's arm was moving forward under the tuck rule, so it was an incomplete pass. New England tied it, won in overtime, and won the Super Bowl two weeks later.|patriots,raiders\nThe Toe Tap|👣|E|Super Bowl XLIII, February 1, 2009. With 35 seconds left and Pittsburgh trailing Arizona 23–20, Ben Roethlisberger threw to the back corner of the end zone. Santonio Holmes stretched out, caught it, and got both toes down before falling out of bounds. The Steelers won their sixth title.|steelers,cardinals\nFail Mary|😵|R|September 24, 2012, Monday Night Football in Seattle, during the referee lockout. On the final play, Russell Wilson threw a Hail Mary into the end zone. Green Bay's M.D. Jennings appeared to intercept it, but the replacement officials ruled a simultaneous catch for Golden Tate and a Seahawks touchdown. The real officials were back the following week.|seahawks,packers\nOdell's Catch|🖐️|R|November 23, 2014, Sunday Night Football against Dallas. Rookie Odell Beckham Jr. ran down the sideline, got interfered with, fell backward, and still reached up with three fingers of his right hand to pull in a 43-yard touchdown. It was instantly called one of the greatest catches ever made.|giants,cowboys\n73–0|📊|R|December 8, 1940, NFL Championship in Washington. The Bears had lost to Washington three weeks earlier, and owner George Preston Marshall called them crybabies. Chicago answered with eleven touchdowns in the T-formation, the most lopsided game in NFL history. Late in the game the officials asked the Bears to stop kicking extra points because they were running out of footballs.|bears,commanders\nFavre After Dad|💔|R|December 22, 2003, Monday Night Football in Oakland. Brett Favre's father, Irvin, had died of a heart attack the day before. Favre played anyway and threw for 399 yards and four touchdowns in the first half alone. Green Bay won 41–7 and even Raiders fans gave him an ovation.|packers,raiders\nVinatieri Beats the Rams|🦵|R|Super Bowl XXXVI, February 3, 2002. The Patriots were 14-point underdogs to the Greatest Show on Turf. Tied 17–17 with 1:30 left and no timeouts, Tom Brady drove into range and Adam Vinatieri hit a 48-yard field goal as time expired. The first Super Bowl ever decided on the final play, and the first of six New England titles.|patriots,rams\nMarcus Allen's Run|🏃|R|Super Bowl XVIII, January 22, 1984. Late in the third quarter, Marcus Allen took a handoff to the left, found nothing, reversed field all the way across the formation, and broke free for a 74-yard touchdown. It was the longest run in Super Bowl history at the time, and the Raiders beat Washington 38–9.|raiders,commanders",
    nba: "Wilt's 100|💯|M|March 2, 1962, in Hershey, Pennsylvania. Wilt Chamberlain scored 100 points for the Philadelphia Warriors against the New York Knicks, including 28 of 32 free throws from a career 51 percent shooter. No film of the game exists, only a radio call and a famous photo of Wilt holding a sheet of paper with \"100\" written on it.|warriors,knicks\nThe Last Shot|🕊️|M|June 14, 1998, NBA Finals Game 6 in Utah. Trailing 86–85 with under 20 seconds left, Michael Jordan stripped Karl Malone, dribbled up, crossed over Bryon Russell, and hit a jumper from the top of the key with 5.2 seconds to go. The Bulls won their sixth championship in eight years, and it was Jordan's final shot in a Chicago uniform.|bulls,jazz\nThe Block|👑|M|June 19, 2016, NBA Finals Game 7 in Oakland. Tied 89–89 with under two minutes left, Andre Iguodala went up for a go-ahead layup on a fast break. LeBron James came from behind the play and pinned the ball against the backboard. Kyrie Irving hit the winning three a minute later, and Cleveland completed the first comeback from 3–1 down in Finals history.|cavaliers,warriors\nThe Shot|🔔|L|May 7, 1989, first round Game 5 in Cleveland. With three seconds left and the Bulls down by one, Michael Jordan took the inbound, dribbled to the foul line, and hung in the air long enough for Craig Ehlo's contest to pass before hitting the series winner. Jordan's fist-pumping celebration is one of the most replayed clips in NBA history.|bulls,cavaliers\nKobe's 81|🐍|L|January 22, 2006, at Staples Center against Toronto. The Lakers trailed by 18 in the third quarter. Kobe Bryant scored 55 points in the second half alone and finished with 81, on 28-of-46 shooting, as Los Angeles won 122–104. It is the second-highest scoring game in NBA history, behind only Wilt's 100.|lakers,raptors\nWillis Reed Limps Out|🦵|L|May 8, 1970, NBA Finals Game 7 at Madison Square Garden. Knicks captain Willis Reed had torn a thigh muscle in Game 5 and was not expected to play. He walked out of the tunnel during warmups, the Garden erupted, and he hit the game's first two baskets. He did not score again, but the Knicks beat the Lakers for their first title.|knicks,lakers\nThe Flu Game|🤒|L|June 11, 1997, NBA Finals Game 5 in Utah. Michael Jordan woke up violently ill, later blamed on a bad late-night pizza. Visibly weak and leaning on teammates during timeouts, he scored 38 points, including the go-ahead three with 25 seconds left. Scottie Pippen helped him off the floor after a 90–88 Bulls win.|bulls,jazz\nRay Allen's Corner Three|🎯|L|June 18, 2013, NBA Finals Game 6 in Miami. The Spurs led by three with seconds left and the arena staff had started roping off the court for a San Antonio celebration. Chris Bosh grabbed an offensive rebound and kicked it to Ray Allen, who backpedaled to the corner and hit the tying three with 5.2 seconds to go. The Heat won in overtime and took Game 7 two nights later.|heat,spurs\nMagic Plays Center|✨|L|May 16, 1980, NBA Finals Game 6 in Philadelphia. Kareem Abdul-Jabbar was out with a sprained ankle, so 20-year-old rookie point guard Magic Johnson jumped center for the opening tip. He played every position that night and finished with 42 points, 15 rebounds and 7 assists as the Lakers clinched the title.|lakers,76ers\nHavlicek Stole the Ball|🕵️|L|April 15, 1965, Eastern Division Finals Game 7 in Boston. The Celtics led the 76ers by one with five seconds left, but Bill Russell's inbound pass hit a guy wire supporting the basket and Philadelphia got the ball back. John Havlicek deflected Hal Greer's inbound pass, and Johnny Most's radio call, \"Havlicek stole the ball!\", became the most famous in NBA history.|celtics,76ers\nReggie's Eight in Nine|⏱️|E|May 7, 1995, Eastern Conference semifinals Game 1 at Madison Square Garden. The Knicks led by six with 18.7 seconds left. Reggie Miller hit a three, stole the inbound pass, stepped back behind the arc and hit another three, then sank two free throws after a Knicks miss. Eight points in nine seconds, and Indiana won 107–105.|pacers,knicks\nBird Steals the Ball|🥷|E|May 26, 1987, Eastern Conference Finals Game 5 in Boston. Detroit led by one with five seconds left and only needed to inbound the ball. Larry Bird read Isiah Thomas's pass, stole it near the baseline, and in one motion fed Dennis Johnson cutting to the basket for the winning layup. The Celtics won the series in seven.|celtics,pistons\nDr. J's Baseline Scoop|🪂|E|May 11, 1980, NBA Finals Game 4 in Philadelphia. Julius Erving drove the right baseline, was cut off by Mark Landsberger, and kept going, taking off from in front of the basket, floating behind the backboard with the ball held out in his right hand, and scooping it in from the other side. Magic Johnson said he wanted to ask Erving to do it again.|76ers,lakers\nTriple Overtime|🕰️|E|June 4, 1976, NBA Finals Game 5 at Boston Garden. The Celtics and Suns played three overtimes. Phoenix's Gar Heard hit a turnaround at the buzzer to force the third, after a fan ran onto the floor and attacked a referee. Boston finally won 128–126, and the game is still called the greatest ever played.|celtics,suns\nIverson Steps Over Lue|🦶|E|June 6, 2001, NBA Finals Game 1 in Los Angeles. Allen Iverson scored 48 points against a Lakers team that had gone 11–0 in the playoffs. In overtime he hit a stepback jumper over Tyronn Lue, who fell to the floor, and then stepped right over him on the way back up the court. It was the only game the Lakers lost that postseason.|76ers,lakers\nT-Mac's 13 in 33|🔥|E|December 9, 2004, in Houston. The Rockets trailed San Antonio by ten with 35 seconds left. Tracy McGrady hit four three-pointers, one of them a four-point play, in the span of 33 seconds. The last one came with 1.7 seconds on the clock, and Houston won 81–80.|rockets,spurs\n0.4 Seconds|🕐|E|May 13, 2004, Western Conference semifinals Game 5 in San Antonio. Tim Duncan had just hit an off-balance fadeaway to put the Spurs up by one with 0.4 seconds left. Gary Payton inbounded to Derek Fisher, who caught, turned and fired in a single motion. It went in, and the Lakers won the series in six.|lakers,spurs\nKlay's 37|🌊|E|January 23, 2015, in Oakland against Sacramento. Klay Thompson scored 37 points in the third quarter alone, going 13-for-13 from the field and 9-for-9 from three. It is the most points anyone has scored in a single quarter in NBA history.|warriors,kings\nVince Carter's Dunk Contest|🚀|E|February 12, 2000, All-Star Weekend in Oakland. Vince Carter opened with a 360 windmill, put his entire forearm through the rim on an elbow-hang dunk, and finished a between-the-legs alley-oop off a bounce from his cousin Tracy McGrady. He mouthed \"It's over\" to the camera halfway through, and he was right.|raptors\n33 Straight|🔗|R|November 5, 1971 to January 7, 1972. The Los Angeles Lakers, with Wilt Chamberlain, Jerry West and Gail Goodrich, won 33 consecutive games. It is still the longest winning streak in the history of any major American professional sport. They won the championship that spring.|lakers\n72–10|🐂|R|The 1995–96 Chicago Bulls, Michael Jordan's first full season back from baseball, went 72–10 and then 15–3 in the playoffs for the title. The record stood for twenty years until the 2015–16 Warriors went 73–9, though Golden State lost the Finals.|bulls\nLinsanity|🗽|R|February 2012. Jeremy Lin, an undrafted Harvard guard who had been cut twice and was sleeping on a teammate's couch, came off the Knicks' bench and scored 25 against New Jersey. He started the next game, scored 38 against Kobe Bryant and the Lakers, hit a game-winner in Toronto, and led New York to seven straight wins.|knicks,nets\nThe Alley-Oop|🤝|R|June 4, 2000, Western Conference Finals Game 7 in Los Angeles. The Lakers had trailed Portland by 15 in the fourth quarter. With 41 seconds left and the comeback complete, Kobe Bryant drove and threw a lob to Shaquille O'Neal for the dunk that sealed it. Los Angeles won its first of three straight titles.|lakers,blazers\nLillard Logo Shot|⌚|R|April 23, 2019, first round Game 5 in Portland. Tied 115–115 with the series at 3–1, Damian Lillard dribbled out the clock against Paul George and pulled up from 37 feet, right at the logo. It went in at the buzzer, he waved goodbye to the Thunder bench, and Oklahoma City's season was over.|blazers,thunder\nCurry's Thunder Shot|🥶|R|February 27, 2016, in Oklahoma City. Stephen Curry had already tied the single-game record with 12 threes. In overtime, with the score tied and time running out, he pulled up from 38 feet, one step past half court, and hit the game-winner. He finished with 46 points and broke his own season record for three-pointers in the process.|warriors,thunder",
    mlb: "The Shot Heard 'Round the World|☄️|M|October 3, 1951, Polo Grounds. The Giants had erased a 13.5-game deficit to force a three-game playoff with Brooklyn. In the deciding game, trailing 4–2 in the ninth, Bobby Thomson hit a three-run homer off Ralph Branca to win the pennant. Russ Hodges screamed \"The Giants win the pennant!\" four times on the radio.|giants,dodgers\nJackie Robinson Debuts|⭐|M|April 15, 1947, Ebbets Field. Jackie Robinson started at first base for the Brooklyn Dodgers, the first Black player in the modern major leagues. He went 0-for-3 but scored the winning run. He won Rookie of the Year, then the MVP two years later, and every team now retires his number 42.|dodgers\nLarsen's Perfect Game|0️⃣|M|October 8, 1956, World Series Game 5 at Yankee Stadium. Don Larsen, who had been knocked out in the second inning of Game 2, retired all 27 Brooklyn Dodgers he faced. It is still the only perfect game in postseason history. The photo of Yogi Berra jumping into his arms is one of baseball's most famous.|yankees,dodgers\nRuth's Called Shot|👉|L|October 1, 1932, World Series Game 3 at Wrigley Field. With the Cubs' bench heckling him, Babe Ruth made a pointing gesture, then hit the next pitch from Charlie Root deep into the center-field bleachers. Whether he was pointing at the fence, the pitcher or the Cubs' dugout has been argued ever since.|yankees,cubs\nBuckner's Error|🧤|L|October 25, 1986, World Series Game 6 at Shea Stadium. The Red Sox were one strike from their first title since 1918. The Mets rallied with three singles and a wild pitch to tie it, and then Mookie Wilson's slow grounder rolled through Bill Buckner's legs at first base. New York won Game 7 two nights later.|mets,redsox\nGibson's Homer|🦿|L|October 15, 1988, World Series Game 1 in Los Angeles. Kirk Gibson, with two bad legs, was not expected to play. He limped up as a pinch-hitter in the ninth against Dennis Eckersley, worked a full count, and hit a two-run homer to win it. He pumped his fist rounding the bases, and it was his only at-bat of the Series.|dodgers,athletics\nFisk Waves It Fair|🪄|L|October 21, 1975, World Series Game 6 at Fenway Park. In the 12th inning, Carlton Fisk hit a fly ball down the left-field line and hopped sideways up the first-base line, waving his arms to push it fair. It hit the foul pole for a walk-off homer. Cincinnati won Game 7, but the image of Fisk waving is one of baseball's most famous.|redsox,reds\nMazeroski Walks It Off|🪵|L|October 13, 1960, World Series Game 7 at Forbes Field. Tied 9–9 in the bottom of the ninth, Bill Mazeroski led off against Ralph Terry and hit the second pitch over the left-field wall. It is still the only walk-off home run in a World Series Game 7, and the Pirates beat a Yankees team that had outscored them 55–27 in the series.|pirates,yankees\nCubs Break the Curse|🐻|L|November 2, 2016, World Series Game 7 in Cleveland. The Cubs had not won a title since 1908. They led 6–3, Rajai Davis tied it with an eighth-inning homer, rain delayed the game before the tenth, and Ben Zobrist drove in the go-ahead run after the break. Chicago won 8–7, after 108 years.|cubs,guardians\nHank Aaron's 715|🏠|L|April 8, 1974, in Atlanta. Hank Aaron hit his 715th career home run off Al Downing of the Dodgers, passing Babe Ruth as the all-time leader. Two fans ran onto the field to pat him on the back as he rounded second. He had received death threats all winter for chasing the record.|braves,dodgers\nGehrig's Farewell|🎙️|E|July 4, 1939, Yankee Stadium. Lou Gehrig, forced to retire by the disease that now carries his name, stood at a microphone between games of a doubleheader and told the crowd, \"Today I consider myself the luckiest man on the face of the earth.\" He died less than two years later at 37.|yankees\nRipken's 2,131|🔢|E|September 6, 1995, Camden Yards. When the game became official after the fifth inning, Cal Ripken Jr. had played in his 2,131st consecutive game, passing Lou Gehrig's record that had stood since 1939. The crowd stood for 22 minutes while he took a lap around the field shaking hands. He kept the streak going to 2,632.|orioles,angels\nMays Makes The Catch|🧢|E|September 29, 1954, World Series Game 1 at the Polo Grounds. Vic Wertz of Cleveland hit a drive an estimated 420 feet to dead center. Willie Mays turned, ran straight back, caught it over his shoulder, and spun to throw the ball back in, holding the runners. The Giants won in extra innings and swept the series.|giants,guardians\nJoe Carter Walks It Off|🎆|E|October 23, 1993, World Series Game 6 in Toronto. Trailing Philadelphia 6–5 in the bottom of the ninth with two on, Joe Carter hit Mitch Williams's 2–2 pitch over the left-field wall. He leapt around the bases as the Blue Jays won their second straight title, only the second time a World Series ended on a home run.|bluejays,phillies\nBucky Dent|🏴|E|October 2, 1978, one-game playoff for the AL East at Fenway Park. Bucky Dent, a light-hitting shortstop with four home runs all year, hit a three-run shot over the Green Monster in the seventh inning to put the Yankees ahead. New York won 5–4 and went on to win the World Series. In Boston he has a different middle name.|yankees,redsox\nRoberts Steals Second|💨|E|October 17, 2004, ALCS Game 4 at Fenway Park. The Red Sox trailed the series 3–0 and the game 4–3 in the ninth against Mariano Rivera. Pinch-runner Dave Roberts stole second on the first pitch, barely beating the throw, and scored the tying run. Boston won in 12 innings, won the next three, and then its first World Series since 1918.|redsox,yankees\nDiMaggio's 56|5️⃣|E|May 15 to July 16, 1941. Joe DiMaggio got at least one hit in 56 consecutive games for the Yankees. The streak ended in Cleveland when Ken Keltner made two backhanded plays at third base. No one has come within a dozen games of the record since.|yankees\nBonds Hits 73|🔨|E|October 5, 2001, in San Francisco. Barry Bonds hit his 71st and 72nd home runs in the same game, breaking Mark McGwire's record set three years earlier, and finished the season with 73. The record still stands, as does the argument about it.|giants,dodgers\nMcGwire's 62|🧨|E|September 8, 1998, in St. Louis. Mark McGwire hit a line drive just over the left-field wall off Steve Trachsel of the Cubs for his 62nd home run of the season, passing Roger Maris's 1961 record. He hugged his son at home plate and then Sammy Sosa, who was chasing him and ran in from right field.|cardinals,cubs\nRose Passes Cobb|🌹|R|September 11, 1985, in Cincinnati. Pete Rose lined a single to left-center off San Diego's Eric Show for career hit number 4,192, passing Ty Cobb's record that had stood for 57 years. He stood on first base and wept as the ovation went on. He finished with 4,256.|reds,padres\nKerry Wood's 20|🔥|R|May 6, 1998, at Wrigley Field. In his fifth major league start, 20-year-old Kerry Wood struck out 20 Houston Astros in nine innings, tying the record, and allowed one infield hit. Many consider it the most dominant pitching performance in history.|cubs,astros\nThe Flip|🤾|R|October 13, 2001, ALDS Game 3 in Oakland. Terrence Long doubled down the right-field line, and the throw from Shane Spencer sailed over both cutoff men. Derek Jeter, running from shortstop, grabbed it near the first-base line and flipped it backhand to Jorge Posada, who tagged Jeremy Giambi at the plate. The Yankees won the next two games and the series.|yankees,athletics\nIchiro's 262|🎌|R|October 1, 2004, in Seattle. Ichiro Suzuki singled twice against Texas to pass George Sisler's 84-year-old record of 257 hits in a season. He finished with 262, and he did it batting over .370 with almost no walks.|mariners,rangers\nOhtani 50–50|🦄|R|September 19, 2024, in Miami. Shohei Ohtani entered the game with 48 home runs and 49 steals. He stole two bases, then hit three home runs, going 6-for-6 with ten RBIs. He became the first player in major league history with 50 homers and 50 stolen bases in a season, and finished with 54 and 59.|dodgers,marlins\nBumgarner's Game 7|🧊|R|October 29, 2014, World Series Game 7 in Kansas City. Madison Bumgarner had thrown a complete-game shutout in Game 5 three days earlier. He came out of the bullpen in the fifth inning and pitched five scoreless innings to close out a 3–2 win. He allowed one run in 21 innings that Series and was named MVP.|giants,royals",
    nhl: "Miracle on Ice|🇺🇸|M|February 22, 1980, Lake Placid Olympics. The United States, a team of college players coached by Herb Brooks, faced a Soviet team that had won four straight gold medals and beaten them 10–3 two weeks earlier. Mike Eruzione scored the go-ahead goal with ten minutes left, and as the clock ran out Al Michaels asked, \"Do you believe in miracles?\" The U.S. beat Finland two days later for the gold.|\nThe Flying Goal|🛫|M|May 10, 1970, Stanley Cup Final Game 4 at Boston Garden. Forty seconds into overtime, Bobby Orr took a pass from Derek Sanderson and scored on Glenn Hall to sweep St. Louis. He was tripped as he shot and sailed through the air with his arms up, and the photo of him flying is the most famous in hockey.|bruins,blues\nGretzky's 92|9️⃣|M|1981–82 season. Wayne Gretzky scored 92 goals in 80 games for Edmonton, including 50 in the first 39, and finished with 212 points. He was 21. No one else has scored more than 76 goals in a season.|oilers\nThe Golden Goal|🥇|L|February 28, 2010, Olympic gold medal game in Vancouver. The United States had tied it with 24 seconds left in regulation. At 7:40 of overtime, Sidney Crosby took a return pass from Jarome Iginla and slid it through Ryan Miller's legs. Canada won gold on home ice, and the country stopped for a moment.|penguins\nHenderson Scores for Canada|🍁|L|September 28, 1972, Summit Series Game 8 in Moscow. The series between Canada's NHL stars and the Soviet national team was tied with the final game tied 5–5. With 34 seconds left, Paul Henderson picked up his own rebound and slid it past Vladislav Tretiak. He had also scored the winners in Games 6 and 7.|\nMessier's Guarantee|📢|L|May 25, 1994, Eastern Conference Finals Game 6 in New Jersey. Down 3–2 in the series, Rangers captain Mark Messier told the papers, \"We will win tonight.\" The Rangers trailed 2–0 after two periods. Messier scored a hat trick in the third, New York won 4–2, then won Game 7 in double overtime and went on to its first Stanley Cup since 1940.|rangers,devils\nGretzky Passes Howe|📈|L|March 23, 1994, in Los Angeles. Wayne Gretzky scored his 802nd career goal against Vancouver, passing Gordie Howe as the NHL's all-time leader. Howe was in the building and had said he hoped to be there when it happened. Gretzky finished with 894 goals.|kings,canucks\nBourque Finally Wins|🏆|L|June 9, 2001, Stanley Cup Final Game 7 in Denver. Ray Bourque had played 22 seasons, 21 of them in Boston, without winning the Cup. After Colorado beat New Jersey 3–1, captain Joe Sakic took the Cup from the commissioner and, instead of lifting it, handed it straight to Bourque. He retired that summer.|avalanche,devils\nBaun's Broken Ankle|🦴|L|April 23, 1964, Stanley Cup Final Game 6 in Detroit. Toronto defenseman Bobby Baun was carried off on a stretcher in the third period after blocking a shot. He returned on a frozen ankle and scored the overtime winner. He played Game 7 too, and only after the Leafs won the Cup did X-rays show the ankle was broken.|mapleleafs,redwings\nMatteau! Matteau!|🥅|L|May 27, 1994, Eastern Conference Finals Game 7 at Madison Square Garden. Tied 1–1 in double overtime, Stephane Matteau came around the net and stuffed a wraparound past Martin Brodeur. Howie Rose's radio call, \"Matteau! Matteau! Matteau!\", became the soundtrack of the Rangers' run to the Cup.|rangers,devils\nGretzky Traded|✈️|E|August 9, 1988. The Edmonton Oilers, who had just won their fourth Stanley Cup in five years, traded Wayne Gretzky to the Los Angeles Kings for Jimmy Carson, Martin Gelinas, three first-round picks and $15 million. Gretzky cried at the press conference. A member of Parliament asked the government to block the deal.|oilers,kings\nRoy's Wink|😉|E|June 7, 1993, Stanley Cup Final Game 4 in Los Angeles. During a scramble, Patrick Roy robbed Tomas Sandstrom and then turned and winked at him. Montreal won in overtime, its tenth overtime win of that postseason, a record, and took the Cup in five games. It remains the last Canadian team to win it.|canadiens,kings\nLemieux Returns|🎗️|E|March 2, 1993, in Philadelphia. Mario Lemieux had his last radiation treatment for Hodgkin's lymphoma that morning in Pittsburgh, then flew to Philadelphia and played that night. He scored a goal and an assist, got a standing ovation from Flyers fans, and went on to win the scoring title despite missing two months.|penguins,flyers\nThe Rocket's 50 in 50|🚀|E|1944–45 season. Maurice \"Rocket\" Richard of the Canadiens became the first player to score 50 goals in a season, and he did it in exactly 50 games. The mark was not matched for 36 years, until Mike Bossy in 1981.|canadiens\nSittler's Ten|🔟|E|February 7, 1976, in Toronto. Darryl Sittler recorded six goals and four assists against Boston in an 11–4 Maple Leafs win. The ten points in a single game is a record no one has approached; the next best is eight.|mapleleafs,bruins\nKane's Phantom Goal|👻|E|June 9, 2010, Stanley Cup Final Game 6 in Philadelphia. In overtime, Patrick Kane fired from a bad angle along the goal line and the puck disappeared under the padding at the back of the net. Kane threw his gloves off and celebrated before anyone else knew it was in. Chicago's first Cup since 1961.|blackhawks,flyers\nOvechkin Lifts the Cup|🥂|E|June 7, 2018, Stanley Cup Final Game 5 in Las Vegas. Alex Ovechkin had spent 13 seasons as the league's best goal scorer without getting past the second round. The Capitals beat the expansion Golden Knights 4–3 to win the franchise's first Stanley Cup, and Ovechkin was named playoff MVP.|capitals,goldenknights\nYzerman's Double-OT Slapshot|💥|E|May 16, 1996, second round Game 7 in Detroit. Tied 0–0 in the second overtime against St. Louis, Steve Yzerman picked up the puck in the neutral zone and ripped a slapshot from just inside the blue line over Jon Casey's shoulder. It is the signature goal of his career.|redwings,blues\n215 Points|2️⃣|E|1985–86 season. Wayne Gretzky recorded 52 goals and 163 assists for 215 points in 80 games. Both the assists and the points are still NHL records, and his assists alone would have won the scoring title.|oilers\nOvechkin's 895|🎯|R|April 6, 2025, on Long Island. Alex Ovechkin scored his 895th career goal against the Islanders, passing Wayne Gretzky's record of 894 that had stood since 1999 and that Gretzky himself once said would never be broken. Gretzky was in the building to shake his hand.|capitals,islanders\nBruins Game 7 Comeback|🐻|R|May 13, 2013, first round Game 7 in Boston. The Maple Leafs led 4–1 with 11 minutes left in the third period. Boston scored three goals, two of them in the final 90 seconds with the goalie pulled, and Patrice Bergeron won it in overtime. The Bruins went to the Stanley Cup Final.|bruins,mapleleafs\nToo Many Men|🙈|R|May 10, 1979, semifinal Game 7 in Montreal. The Bruins led 4–3 with under three minutes left when they were caught with too many men on the ice. Guy Lafleur scored on the power play, and Yvon Lambert won it in overtime. Montreal won its fourth straight Cup, and Boston coach Don Cherry was gone that summer.|bruins,canadiens\nBrodeur Scores|🧤|R|April 17, 1997, first round Game 1 in New Jersey. With Montreal's net empty in the final seconds, Martin Brodeur cleared the puck down the ice and it slid into the vacant net. He was the first goaltender to score in a playoff game, and only the second ever to score a goal at all.|devils,canadiens\nGolden Knights Debut Run|⚔️|R|2017–18. The Vegas Golden Knights, assembled from players other teams did not protect in the expansion draft, won their division with 109 points and reached the Stanley Cup Final in their first season. No expansion team in any major sport had done anything close. They lost to Washington in five.|goldenknights\nLightning's Sweep|⚡|R|2018–19. The Tampa Bay Lightning tied the NHL record with 62 wins and won the Presidents' Trophy by 21 points. In the first round they were swept in four games by Columbus, a team that had never won a playoff series. Tampa Bay won the next two Stanley Cups.|lightning,bluejackets"

  }, MCAT = { nfl: "mn", nba: "mb", mlb: "mm", nhl: "mh" }, MLG = { nfl: [], nba: [], mlb: [], nhl: [] }, MKW = {}, MHINT = { nfl: "Open NFL games. Famous moments are very hard to pull, and games with the teams involved help.", nba: "Open NBA games. Famous moments are very hard to pull, and games with the teams involved help.", mlb: "Open MLB games. Famous moments are very hard to pull, and games with the teams involved help.", nhl: "Open NHL games. Famous moments are very hard to pull, and games with the teams involved help." };
  Object.keys(MOMS).forEach(function (lk) {
    MOMS[lk].split("\n").forEach(function (ln) {
      var p = ln.split("|"), id = "mo_" + lk + "_" + slug(p[0]);
      CAT.push([id, MCAT[lk], p[2], p[1], p[0], p[3], MHINT[lk]]); MKW[id] = p[4] ? p[4].split(",") : []; MLG[lk].push(id);
    });
  });
  CAT.unshift(["mack", "m", "S", "🦬", "Mack", "Glad to have you.", "Create an account."]);
  var HD = {
    ny: "Resolution Rush|🥂|C|Day one. The gym is full and so is the schedule.\nBlack-Eyed Peas|🫘|U|Eat them for luck. Add a hot dog for the home team.\nAuld Lang Syne|🎶|R|Everyone forgets the second verse.\nSnowy Shootout|❄️|E|2008 Winter Classic. Sidney Crosby wins it in a blizzard in Buffalo.\nThe Big House Classic|🏟️|E|2014 Winter Classic. 105,491 fans pack Michigan Stadium.\nGranddaddy of Them All|🌹|U|The Rose Bowl has kicked off every New Year's Day since 1916.\nWrong-Way Riegels|🔄|R|1929 Rose Bowl. Roy Riegels scoops a fumble and runs 65 yards toward his own goal line.\nRainy Winter Classic|🌧️|R|2011. Heinz Field, a night puck drop pushed back by rain, Capitals over Penguins.\nPolar Plunge|🏊|U|Cold water, loud screaming, warm towels.\nHangover Hockey|☕|C|Afternoon puck drop, plenty of coffee in the stands.",
    sb: "Guac Bowl|🥑|C|The most important game of the day happens at the snack table.\nWing Count|🍗|U|Somebody always orders twice what they need.\nHalftime Wardrobe|🎤|R|Forty-five costume changes in twelve minutes.\nThe Super Bowl Shuffle|🐻|R|1985. The Bears record a song before they win the title.\nElway's Helicopter|🚁|E|Super Bowl XXXII. John Elway spins through the air for a first down.\nMontana's Drive|🥶|E|Super Bowl XXIII. Ninety-two yards in the final three minutes.\nWide Right|➡️|R|Super Bowl XXV. Scott Norwood's 47-yarder drifts right with eight seconds left.\nThe Blackout|🔌|U|Super Bowl XLVII. The lights go out in New Orleans for 34 minutes.\nOne Yard Short|🛑|E|Super Bowl XXXIV. Mike Jones tackles Kevin Dyson a yard from the goal line as time runs out.\nPuppy Bowl|🐶|C|The other game, with more tail wagging.\nSquares Pool|🔢|C|Your corner finally hits in the third quarter.",
    val: "Heart-Shaped Scoreboard|❤️|C|Every final score comes with a little love.\nRose at the Plate|🌹|U|A romantic strikeout.\nSweetheart Deal|🤝|R|A trade everybody loves.\nKobe's Last All-Star Game|🌟|E|2016. Kobe says goodbye to the All-Star stage.\nKiss Cam|📸|C|Look away and they zoom in.\nLove-Love|🎾|U|Tennis, the only sport where love means nothing.\nHome Plate Wedding|💍|R|A tux, a veil and a very patient umpire.\nEarnhardt Finally Wins|🏁|E|February 15, 1998. Dale Earnhardt wins the Daytona 500 on his 20th try, and every crew lines pit road to shake his hand.",
    pi: "Slice of Pi|🥧|C|3.14 slices, one very full table.\n3.14 Yards|📐|U|A very specific gain.\n3.14 ERA|📊|U|A very round number for a pitcher.\nBracket Math|🧮|C|Selection Sunday arithmetic is not real arithmetic.\nFull Circle|⭕|R|The puck rims the boards and comes right back.",
    stp: "Lucky Clover|☘️|C|Four leaves, one good bounce.\nPot of Gold|💰|U|The end of the rainbow is an overtime winner.\nGreen Ice|🧊|R|Even the ice is dressed for the day.\nThe Richard Riot|🔥|E|1955. Montreal erupts over Maurice Richard's suspension.\nCeltics Green|🍀|U|The one team that wears the holiday all year.\nShamrock Shake|🥤|C|Limited time, like a hot streak.\nSuper Saturday|🏉|R|The Six Nations finale lands right around the day.\nIreland's Grand Slam|☘️|E|March 17, 2018. Ireland beats England at Twickenham on St. Patrick's Day to finish a perfect Six Nations.",
    fool: "Prank Call|📞|C|Is your refrigerator running? Is your team?\nFake Punt|🎭|U|Nobody saw it coming, including the punter.\nWhoopee Cushion Timeout|💨|R|The sideline's worst timing.\nSidd Finch|🔥|R|1985. The 168 mph pitcher who never existed.\nShaving Cream Glove|🧴|U|Opening Day prank. Someone's mitt is full of foam.\nRookie Backpack|🎒|C|Carrying the pink one to the bullpen.\nVillanova's Perfect Night|🏀|E|April 1, 1985. Villanova shoots 79 percent and stuns Georgetown for the title. No joke.",
    easter: "Golden Egg|🥚|C|Found it behind the scoreboard.\nChocolate Bunny Mascot|🐰|U|Ears first, always.\nEgg Roll Delivery|🪺|R|Slow roll to the finish line.\nThe Easter Epic|🐣|E|1987. Four overtimes and one very late Easter morning.\nEgg-Shaped Ball|🏉|C|Technically every football.\nOpening Day Bonnet|🎩|U|Fresh hat for a fresh season.\nMasters Sunday|⛳|R|A green jacket, right around Easter weekend.\nTiger's Comeback|🐯|E|April 14, 2019. Tiger Woods wins his fifth green jacket, eleven years after his last major.",
    mom: "Mom's Lucky Jersey|👚|C|It only works when she's watching.\nPink Bats|🩷|U|Pink bats come out for Mother's Day.\nHug From the Stands|🫂|R|Better than any trophy.\nBraden's Perfect Day|💐|E|2010. A perfect game on Mother's Day, with his grandmother in the stands.\nPink Ribbon Cleats|🎀|C|Everybody's spikes match for a day.\nDerby Hat|👒|U|The first Saturday in May. Two weeks of planning for two minutes.\nCall Your Mother|📱|R|She watched the whole game anyway.\nSecretariat's Derby|🐎|E|May 5, 1973. Secretariat runs the Kentucky Derby in 1:59 2/5, still the record.",
    mem: "Grill Master|🍔|C|One hand on the tongs, one on the remote.\nStars and Stripes|🧢|U|Special caps for the day.\nDoubleheader Sunday|🌭|R|Two games, one long day off.\nPoppy Patch|🌺|C|Pinned on for the weekend.\nCoca-Cola 600|🥤|U|NASCAR's longest race, the same Sunday as Indy.\nBottle of Milk|🥛|R|The Indy 500 winner's drink since 1936.\nSpider-Man Climbs the Fence|🧗|E|May 27, 2001. Helio Castroneves wins his first Indy 500 and scales the catch fence.",
    dad: "Dad Joke Timeout|😅|C|Groans from the whole section.\nBackyard Catch|🧤|U|The first game anyone ever plays.\nBlue Wristbands|💙|U|Baseball wears blue for Father's Day.\nRecliner Throne|🛋️|R|Don't ask him to move during the fourth quarter.\nGrill Tongs|🍖|C|Clicks them twice before every flip.\nLogo Tie|👔|U|Worn exactly once.\nUS Open Sunday|⛳|R|Golf's toughest test finishes on Father's Day.\nPayne's Putt|🧢|E|June 20, 1999. Payne Stewart holes a 15-footer on the last at Pinehurst to win the US Open, on Father's Day.",
    jun: "Cookout Season|🍉|C|Cold drinks, warm weather, scores on every phone.\nJubilee|🎉|U|A day to celebrate freedom.\nThe First Game|⚾|L|1846. The first recorded baseball game, in Hoboken.\nFifty-Two Years|🏆|L|2016. Cleveland finally ends the wait.\nSolstice Game|☀️|C|The longest day, the latest first pitch.\nThrowback Threads|🧢|R|Teams wear Negro Leagues uniforms in tribute.\nSatchel at 42|🎯|E|July 9, 1948. Satchel Paige debuts for Cleveland at 42 and helps pitch them to the pennant.",
    j4: "Hot Dog Rocket|🌭|C|Launched with mustard.\nSparkler Sprint|🎇|U|Write your name in light.\nBald Eagle Flyby|🦅|R|Stars, stripes and a very serious bird.\nRighetti's No-Hitter|🧤|E|1983. A Fourth of July no-hitter at Yankee Stadium.\nFireworks Night|🎆|C|Stay in your seats after the final out.\nWimbledon Fortnight|🎾|U|Strawberries, cream and a long rain delay.\nSeventy-Six Dogs|🏆|R|2021. Joey Chestnut eats 76 hot dogs in ten minutes at Coney Island.\nIsner–Mahut|🎾|E|2010 Wimbledon. 70–68 in the fifth set, over three days.",
    labor: "Last Cookout of Summer|🍔|C|The final burger of the season.\nWhite Pants Warning|👖|U|Last chance. Fashion rules apply.\nKickoff Weekend|🏈|R|The new football season starts any minute.\nWeek One Saturday|🏈|C|Every fan base is undefeated.\nNight Matches in Queens|🎾|U|The US Open and a long weekend.\nDarlington Throwbacks|🏁|R|The Southern 500 runs retro paint schemes on Labor Day weekend.\nApp State Stuns Michigan|🏔️|E|September 1, 2007. The Big House's first game against an FCS team goes very wrong.",
    hween: "Ghost Runner|👻|C|Extra innings, extra spooky.\nPumpkin Pitch|🎃|U|Smashing, but in a good way.\nCostume Mascot|🧛|R|Nobody can tell who's inside.\nMr. November|🌃|E|2001. Derek Jeter hits a walk-off homer after midnight.\nCandy Corn Hat Trick|🍬|C|Three pieces, three goals.\nParka Series|🧥|U|Late October baseball, coats in the dugout.\nJack-o'-Lantern Helmet|🎃|R|Carved with the team logo.\nEarthquake Series|🌍|E|October 17, 1989. A 6.9 quake hits before Game 3 at Candlestick. The World Series resumes ten days later.",
    thx: "Turkey Trot|🦃|C|Run first, eat later.\nDrumstick Tackle|🍗|U|Every family has one.\nFootball on the TV|📺|R|The only tradition everyone agrees on.\nFirst Thanksgiving Game|🦁|R|1934. Detroit hosts the first football game on Thanksgiving.\nLeon Lett's Slide|❄️|E|1993. A snowy block, a long slide and a very strange ending.\nThe Coin Toss|🪙|E|1998. A mix-up at midfield stuns Detroit.\nButterfingers|🦃|C|Dropped it. Still ate it.\nTurkey Leg Award|🍗|U|John Madden's prize for the player of the day.\nThe Butt Fumble|🍑|R|November 22, 2012. Thanksgiving night, Mark Sanchez runs into his own lineman's backside.\nMoss's Thanksgiving|🚀|E|November 26, 1998. Randy Moss: three catches, three touchdowns, 163 yards in Dallas.",
    xmas: "Elf on the Bench|🧝|C|Watching the whole game.\nUgly Sweater Jersey|🧶|U|The loudest outfit in the building.\nSnow Globe Arena|🔮|R|Shake it and the game restarts.\nKobe vs. Shaq|🎁|E|2004. Christmas Day, Lakers and Heat, a reunion for the ages.\nThe Longest Game|🎄|L|1971. Dolphins and Chiefs play into a second overtime.\nStocking Stuffer Tickets|🧦|C|Section 300, but still.\nBoxing Day Football|⚽|U|The Premier League plays the day after Christmas.\nFive Games, One Couch|🛋️|U|Christmas Day hoops from noon to midnight.\nBernard King's 60|🎄|E|December 25, 1984. Sixty points at the Garden on Christmas night.\nGhost to the Post|👻|E|December 24, 1977. Raiders and Colts go to double overtime on Christmas Eve.",
    nye: "Countdown Clock|⏰|C|Ten seconds left and everyone's counting.\nConfetti Floor|🎊|U|Swept up by morning.\nChampagne Pop|🍾|R|Aimed at the ceiling, hopefully.\nThe Fog Bowl|🌫️|E|1988. Nobody can see the field. The playoff game goes on.\nThe Greatest Game|🏒|E|1975. Montreal and the Red Army play to a 3–3 tie.\nWinter Classic Eve|🏒|C|One sleep until outdoor hockey.\nSugar Bowl Night|🍬|U|New Orleans, a late kickoff, a later party.\nNew Year's Eve Semifinals|🏈|R|2015. The playoff semifinals kick off on December 31, and the ratings hate it.\nThe Ice Bowl|🥶|L|December 31, 1967. Lambeau Field at minus 13, and Bart Starr's sneak wins the NFL title.",
    leap: "Leap Day Birthday|🎂|U|Only ages every four years.\nBonus Day|📅|C|An extra day of games on the calendar.\nFour-Year Wait|⏳|R|The rarest date in sports.",
    f13: "Goalie Mask|🏒|R|The hockey look that haunts summer camps.\nBlack Cat on the Field|🐈‍⬛|U|1969. Shea Stadium, the Cubs' dugout, and a famous collapse.\nUnlucky Bounce|🪨|C|Off the post and out."
  };
  function fx(m, d) { return function (y) { return [new Date(y, m, d)]; }; }
  function nthDow(y, m, dow, n) { var d = new Date(y, m, 1); return new Date(y, m, 1 + (dow - d.getDay() + 7) % 7 + 7 * (n - 1)); }
  function lastDow(y, m, dow) { var d = new Date(y, m + 1, 0); return new Date(y, m, d.getDate() - (d.getDay() - dow + 7) % 7); }
  function easterD(y) { var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), t = h + l - 7 * m + 114; return new Date(y, Math.floor(t / 31) - 1, t % 31 + 1); }
  var HOLS = {
    ny: ["New Year's Day", fx(0, 1)], sb: ["Super Bowl Sunday", function (y) { return [nthDow(y, 1, 0, 2)]; }], val: ["Valentine's Day", fx(1, 14)], pi: ["Pi Day", fx(2, 14)],
    stp: ["St. Patrick's Day", fx(2, 17)], fool: ["April Fools' Day", fx(3, 1)], easter: ["Easter", function (y) { return [easterD(y)]; }], mom: ["Mother's Day", function (y) { return [nthDow(y, 4, 0, 2)]; }],
    mem: ["Memorial Day", function (y) { return [lastDow(y, 4, 1)]; }], dad: ["Father's Day", function (y) { return [nthDow(y, 5, 0, 3)]; }], jun: ["Juneteenth", fx(5, 19)], j4: ["Independence Day", fx(6, 4)],
    labor: ["Labor Day", function (y) { return [nthDow(y, 8, 1, 1)]; }], hween: ["Halloween", fx(9, 31)], thx: ["Thanksgiving", function (y) { return [nthDow(y, 10, 4, 4)]; }], xmas: ["Christmas", fx(11, 25)], nye: ["New Year's Eve", fx(11, 31)],
    leap: ["Leap Day", function (y) { var d = new Date(y, 1, 29); return d.getMonth() === 1 ? [d] : []; }],
    f13: ["Friday the 13th", function (y) { var o = []; for (var m = 0; m < 12; m++) { var d = new Date(y, m, 13); if (d.getDay() === 5) o.push(d); } return o; }]
  }, HLO = 15, HHI = 15, HDAY = 86400000, MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function hWin(k, now) {                        // the window (start, end, holiday date) this holiday is in right now, else the next one
    var y0 = now.getFullYear(), best = null, cur = null;
    for (var y = y0 - 1; y <= y0 + 5; y++) HOLS[k][1](y).forEach(function (d) {
      var s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - HLO), e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + HHI + 1);
      if (now >= s && now < e) cur = { s: s, e: new Date(e - 1), d: d, on: true };
      else if (s > now && (!best || s < best.s)) best = { s: s, e: new Date(e - 1), d: d, on: false };
    });
    return cur || best;
  }
  function md(d) { return MON[d.getMonth()] + " " + d.getDate(); }
  function hActive(k) { var w = hWin(k, new Date()); return w && w.on; }
  var HMAP = { d_ny: "ny", d_j4: "j4", d_xmas: "xmas", d_val: "val", d_pi: "pi", d_hween: "hween", bat: "hween", d_f13: "f13", d_leap: "leap" }, HCARDS = {}, AUTO = { mack: 1, m10: 1, m25: 1, m50: 1, m100: 1, all: 1 };
  Object.keys(HD).forEach(function (k) {
    HD[k].split("\n").forEach(function (ln) { var p = ln.split("|"); CAT.push(["h_" + k + "_" + slug(p[0]), "h", p[2], p[1], p[0], p[3], ""]); CAT[CAT.length - 1].h = k; });
  });
  var IDX = {}; CAT.forEach(function (c, i) { c.n = i + 1; IDX[c[0]] = c; if (HMAP[c[0]]) c.h = HMAP[c[0]]; });
  var GEN = "Keep tapping around the app. Any button can turn one up, and the rarer the card, the longer the wait.";
  function hint(c) { var w = hWin(c.h, new Date()); return "Holiday card (" + HOLS[c.h][0] + "). Any tap can turn it up " + (w.on ? "right now, through " + md(w.e) + "." : "from " + md(w.s) + " to " + md(w.e) + "."); }
  CAT.forEach(function (c) { if (c.h) HCARDS[c[0]] = 1; if (!AUTO[c[0]]) c[6] = c.h ? hint(c) : GEN; });
  setInterval(function () { CAT.forEach(function (c) { if (c.h && !col.i[c[0]]) c[6] = hint(c); }); }, 3600000);
  var TOTAL = CAT.length, col = { i: {}, s: {}, d: [] };
  try { var rc = JSON.parse(localStorage.getItem("sb-col") || "null"); if (rc && rc.i) col = rc; } catch (e) {}
  try {                                          // migrate the old secrets store
    var old = JSON.parse(localStorage.getItem("sb-fun") || "null");
    if (old) { for (var ok in old) if (IDX[ok] && !col.i[ok]) col.i[ok] = [Date.now(), 1]; localStorage.removeItem("sb-fun"); }
  } catch (e) {}
  if (!col.s) col.s = {}; if (!col.d) col.d = [];
  col.d.sort(function (a, b) { return keyDate(a) - keyDate(b); });   // days in date order (an old sync saved them sorted as text)
  if (col.d0 && col.d.length && keyDate(col.d[0]) < keyDate(col.d0)) col.d0 = col.d[0];
  var saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(function () { try { localStorage.setItem("sb-col", JSON.stringify(col)); } catch (e) {} }, 700); }
  function count() { var n = 0; for (var k in col.i) if (IDX[k]) n++; return n; }
  function say(msg, go, cls) { var t = $("toast"); if (!t) return; t.textContent = msg; t.className = (go ? "show go" : "show") + (cls ? " " + cls : ""); t.onclick = go ? function () { t.className = ""; t.onclick = null; go(); } : null; clearTimeout(say.h); say.h = setTimeout(function () { t.className = ""; t.onclick = null; }, go ? 5500 : 3800); }
  // No pop-ups before there's an account (the one-time account prompt is the only exception): cards and packs still
  // pile up quietly, with NEW badges in the log and the gold dot on the profile button.
  function acct() { try { return !!localStorage.getItem("sb-active"); } catch (e) { return false; } }
  var newQ = [], newT = 0, TAPPING = false;
  function disc(id, extra) {
    var c = IDX[id]; if (!c) return;
    if (!TAPPING && !AUTO[id]) return;
    var e = col.i[id]; if (e) { e[1]++; save(); return; }
    col.i[id] = [Date.now(), 1]; if (extra) col.i[id][2] = extra; save(); newQ.push(c);
    try { if (localStorage.getItem("sb-lb") && window.SB_LOAD) { clearTimeout(disc.lt); disc.lt = setTimeout(function () { SB_LOAD(function () { PROF.sync(); }); }, 8000); } } catch (e) {}
    clearTimeout(newT); newT = setTimeout(function () {
      var q = newQ; newQ = [];
      var cid = q.length === 1 ? q[0][0] : null;
      var rvm = "f"; try { rvm = localStorage.getItem("sb-rv") || "f"; } catch (e) {}
      if (rvm === "0" || !acct()) return;           // pop-ups off (or no account yet): the cards are in the log with a NEW badge, nothing else
      var quick = rvm === "q";
      if (!quick && reveal(q)) return;
      var mt = Math.max.apply(null, q.map(tier)); if (mt === 1 && !RM) gConfetti(10, ["✨"]);
      else if (mt >= 2 && quick) vib(30);
      say((q.length === 1 ? "✨ New card: " + q[0][4] + " · " + RAR[q[0][2]] : "✨ " + q.length + " new cards in your Collection Log") + " ›", function () { if (window.SB_LOAD) SB_LOAD(function () { PROF.open("log", cid ? { card: cid } : null); }); }, "r" + "CURELM".charAt(mt));
          }, newQ.some(function (c) { return tier(c) >= 3; }) ? 1100 : 450);
    milestones(id);
  }
  function milestones(id) {
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
  var LOGO = {}; try { LOGO = JSON.parse(localStorage.getItem("sb-lg") || "{}") || {}; } catch (e) {}
  function teamDrop(lk, g) {                     // opening a game only remembers each team's logo for when its card turns up
    if (g) { col.gv = (col.gv || 0) + 1; save(); }   // ...and counts it for the account stats
    if (!g || !TCAT[lk]) return; var ch = false;
    [g.h, g.a].forEach(function (s) {
      if (!s) return; var id = TK[lk + "|" + slug(s[0])]; if (!id) return;
      var m = /img=([^&]+)/.exec(s[5] || ""); if (!m) return; var p = decodeURIComponent(m[1]);
      if (LOGO[id] !== p) { LOGO[id] = p; ch = true; }
      var e = col.i[id]; if (e && !e[2]) { e[2] = p; save(); }
    });
    if (ch) { try { localStorage.setItem("sb-lg", JSON.stringify(LOGO)); } catch (e) {} }
  }
  // Every card except the Signature one turns up from taps: any button, tab or card in the app rolls once.
  var TAPP = .02, TAPGAP = 1500, lastTap = 0, HW2 = { C: 10, U: 6, R: 4, E: 2, L: 1, M: .5 };
  function wchoice(arr, wf) { var tot = 0, ws = arr.map(function (c) { var w = wf(c); tot += w; return w; }), r = Math.random() * tot, i = 0; while (i < arr.length - 1 && r >= ws[i]) { r -= ws[i]; i++; } return arr[i]; }
  function tapRoll() {
    var n = Date.now(); if (n - lastTap < TAPGAP) return; lastTap = n;
    col.tp = (col.tp || 0) + 1; earn(1, "use");
    if (D.body.classList.contains("rv-on") || Math.random() >= TAPP) return;
    var left = CAT.filter(function (c) { return !col.i[c[0]] && !AUTO[c[0]]; }); if (!left.length) return;
    var hol = left.filter(function (c) { return c.h && hActive(c.h); }), gen = left.filter(function (c) { return !c.h; }), c;
    if (hol.length && (!gen.length || Math.random() < .6)) c = wchoice(hol, function (x) { return HW2[x[2]] || 1; });
    else if (gen.length) c = tierPick(gen);
    else return;
    TAPPING = true; try { disc(c[0], LOGO[c[0]] || ""); } finally { TAPPING = false; }
  }
  D.addEventListener("click", function (e) { var t = e.target; if (t && t.closest && t.closest("button,a,summary,[role=tab],[role=button],.card,.recap")) tapRoll(); }, true);
  function upcoming() {
    var now = new Date(), on = [], nx = null;
    Object.keys(HOLS).forEach(function (k) { var w = hWin(k, now); if (!w) return; w.k = k; w.name = HOLS[k][0]; if (w.on) on.push(w); else if (!nx || w.s < nx.s) nx = w; });
    return { on: on.map(function (w) { return { name: w.name, end: md(w.e) }; }), next: nx ? { name: nx.name, start: md(nx.s), end: md(nx.e) } : null };
  }
  function tier(c) { return "CURELMS".indexOf(c[2]); }
  function vib(p) { try { if (!RM && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function revealClose() {
    if (!rvO) return; var o = rvO; rvO = null; clearTimeout(o._a); clearTimeout(o._c);
    D.body.classList.remove("rv-on"); o.classList.remove("in"); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 260);
  }
  function bigCard(c) {
    var card = E("div", "tc r" + c[2] + " got"), hd = E("div", "tc-h"); hd.appendChild(E("span", null, "No. " + ("00" + c.n).slice(-3) + " / " + ("00" + TOTAL).slice(-3))); hd.appendChild(E("span", null, CATS[c[1]])); card.appendChild(hd);
    var art = E("div", "tc-art"); art.appendChild(artEl(c, "tc-em", 200, true)); card.appendChild(art);
    card.appendChild(E("h3", "tc-n", c[4]));
    var rb = E("div", "tc-rar"); rb.appendChild(E("i", null, c[2])); rb.appendChild(D.createTextNode(RAR[c[2]])); card.appendChild(rb);
    card.appendChild(E("p", "tc-d", c[5])); card.appendChild(E("span", "tc-foil"));
    return card;
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
    var card = bigCard(c);
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
  (function () {
    var d = new Date(), k = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    if (!col.d0 && col.d.length) col.d0 = col.d[0];
    if (col.d.indexOf(k) < 0) {
      col.dn = (col.dn || col.d.length) + 1; col.d.push(k); if (!col.d0) col.d0 = k;
      if (col.d.length > 60) col.d.shift();
      col.ls = Math.max(col.ls || 0, streakDays(col.d)); save();
    } else if (!col.ls) { col.ls = streakDays(col.d); save(); }
  })();

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

  // ---------- holiday animations (only inside each holiday's window) ----------
  var HFX = {
    ny: [["zoom", ["🎊", "🎉", "🥂", "✨"], 9]], sb: [["roll", ["🏈"], 3]], val: [["rise", ["💗", "💘", "💕", "🌹"], 14]], pi: [["pop", ["π", "🥧", "3.14", "π"], 8]],
    stp: [["fall", ["☘️", "🍀"], 16]], fool: [["tumble", ["🤡", "🃏", "🎭", "🪅"], 10]], easter: [["hop", ["🐰", "🥚", "🐣"], 3]], mom: [["drift", ["🌸", "🌷", "💐"], 12]],
    mem: [["fly", ["🇺🇸"], 4]], dad: [["trail", ["⚾", "🧢"], 4]], jun: [["float", ["🎉", "🍉", "✨"], 10]], j4: [["burst", [], 0]],
    labor: [["zoom", ["🍔", "🌭", "🥤"], 8]], hween: [["float", ["👻", "🎃"], 9], ["fly", ["🦇"], 5]], thx: [["fall", ["🍂", "🍁", "🦃"], 16]], xmas: [["fall", ["❄️", "❄️", "❄️", "🎄", "🎁"], 24]],
    nye: [["burst", [], 0]], leap: [["hop", ["🐸"], 4]], f13: [["fly", ["🐈‍⬛", "🪞"], 4]]
  };
  var HQ = {
    ny: ["New year, same refs.", "Resolution: check scores less. Starting tomorrow.", "Fresh calendar. Same rivalries."],
    sb: ["The snack table is the real MVP today.", "Somebody's already asking about the halftime show.", "Commercials count as a quarter."],
    val: ["Roses are red, the scoreboard is blue.", "Be mine, be my fantasy team.", "Love is a tied game in overtime."],
    pi: ["3.14159... and still no overtime.", "Today's final: π to nothing.", "A perfect circle, like a good fast break."],
    stp: ["May your bounces be lucky.", "Green is the only color that matters today.", "Pot of gold at the end of the double overtime."],
    fool: ["Check the score twice. Today it might be a prank.", "That fake punt was a joke. Probably.", "No, the refs did not just do that. Or did they?"],
    easter: ["Hide the eggs, keep the lead.", "Hoppy with the final score.", "He is risen. So is the point spread."],
    mom: ["Mom called the game before the announcers did.", "Tell her she was right about the second half.", "She taught you everything about sportsmanship."],
    mem: ["Grill first, check scores second.", "Remembering with a day of baseball.", "Stars and stripes, stats and snacks."],
    dad: ["Dad has already explained the game three times.", "Play catch. It counts as cardio.", "The recliner is occupied. Do not disturb."],
    jun: ["Cookout season, scores on the side.", "A day for celebration, family and good music.", "Scores, shade and something cold to drink."],
    j4: ["Fireworks and a doubleheader.", "Hot dogs have scored a record number of points.", "Land of the free, home of the walk-off."],
    labor: ["A day off for a day of scores.", "Last cookout of summer, first Sunday of football.", "Work is canceled. Standings are not."],
    hween: ["Spooky season, scary bullpen.", "This scoreboard is haunted. Probably.", "Trick or treat: the home team won."],
    thx: ["Football, family, more football.", "The turkey will be done by the third quarter.", "Thankful for overtime."],
    xmas: ["Peace on earth, good will, and a Christmas Day tipoff.", "All I want for Christmas is a clean sweep.", "The only thing under the tree is a ticket stub."],
    nye: ["Ten, nine, eight... lead protected.", "Last game of the year. Make it count.", "Auld lang syne and a final buzzer."],
    leap: ["An extra day for extra innings.", "Today only comes around once in a while."], f13: ["Unlucky for someone's playoff odds.", "Black cats and bad bounces."]
  };
  var DAYQ = [["It's Sunday. The couch has been assigned.", "Sunday is for football and regret."], ["Monday. The only game on is one with consequences.", "Monday Night means one more game before bed."], ["Tuesday: the quiet part of the schedule.", "Tuesday. Nothing happens, except sometimes everything."], ["Midweek. Hang in there.", "Wednesday. A great night for a good game."], ["Thursday. Football is warming up.", "Almost the weekend. Almost."], ["Friday. Big night for scores.", "It's Friday. The scoreboard has plans."], ["Saturday. Everything is on.", "Saturday: the full slate."]];
  function nearHol() {                            // the active holiday whose date is closest to today
    var now = new Date(), best = null, bd = 1e12;
    Object.keys(HFX).forEach(function (k) { var w = hWin(k, now); if (!w || !w.on) return; var dd = Math.abs(w.d - now); if (dd < bd) { bd = dd; best = k; } });
    return best;
  }
  function hSpawn(m, em, n, t0) {
    var g = layer(), w = innerWidth, h = innerHeight;
    for (var i = 0; i < n; i++) {
      var p = mk("hf hf-" + m, em[rnd(em.length)]), dur = m === "trail" ? R(.8, 1.3) : m === "pop" || m === "zoom" ? R(1.6, 2.6) : m === "roll" || m === "hop" || m === "fly" ? R(5, 8) : R(4.5, 8.5);
      p.style.cssText = "--x:" + R(2, 94).toFixed(1) + "%;--y:" + R(8, m === "pop" || m === "zoom" ? 80 : 55).toFixed(1) + "%;--dx:" + Math.round(R(-60, 60)) + "px;--r:" + Math.round(R(180, 540)) + "deg;--s:" + R(.8, 1.5).toFixed(2) + ";--t:" + dur.toFixed(2) + "s;--dl:" + (t0 + R(0, m === "roll" || m === "hop" || m === "fly" ? 3 : 2.2)).toFixed(2) + "s";
      g.appendChild(p); gone(p, (dur + t0 + 3.5) * 1000);
    }
  }
  function holidayFx(force) {
    // Once a day, and small: the first arrival of the day gets a short burst, then nothing until tomorrow.
    if (RM || D.hidden) return; var k = nearHol(); if (!k) return;
    var key = new Date().toDateString() + "|" + k;
    if (!force) { try { if (localStorage.getItem("sb-hf") === key) return; } catch (e) {} }
    try { localStorage.setItem("sb-hf", key); } catch (e) {}
    if (k === "j4" || k === "nye") gFireworks();
    else HFX[k].forEach(function (c) { hSpawn(c[0], c[1], Math.max(1, Math.round(c[2] * .4)), 0); });
  }
  // ---------- arriving somewhere new ----------
  var ENTER = ["rise", "flip", "zoom", "slidel", "slider", "swing", "blur", "drop", "spin", "tilt"];
  function enterFx() { return RM ? "rise" : wpick("enter", ENTER, function (k) { return "e_" + k; }); }
  var arrivals = 0;
  function after(out) {
    var st = out.querySelectorAll(".fire3,.fire5,.cold3,.cold5,.heat");
    for (var si = 0; si < st.length; si++) { var cl = st[si].classList; ["fire3", "fire5", "cold3", "cold5"].forEach(function (k) { if (cl.contains(k)) disc("s_" + k); }); if (cl.contains("heat")) disc("s_heat"); }
    quipNow(false); earn(3, "use");
    if (RM) return; arrivals++; holidayFx();
    if (Math.random() < 1 / 1500) { disc("gt"); gConfetti(90, ["🎫", "✨", "💎"]); if (acct()) say("🎫 GOLDEN TICKET"); }
    var cards = shuffle([].slice.call(out.querySelectorAll(".recap.w,.recap.l,.card.followed"))).slice(0, Math.random() < .5 ? 1 : 0), anyWin = false;
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
    if (anyWin && Math.random() < .02) { gConfetti(70); found("legend"); }
    var r = Math.random();
    if (r < .015) ball(); else if (r < .025) seasonal(); else if (r < .033) gold(out); else if (r < .038) cameo();
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
  var QUIPS = ["That's all of it. Go touch grass.", "Nothing down here but a ball and a dream.", "You scrolled all the way down. Respect.", "Bottom of the page. Top of the standings.", "Refs have reviewed the scroll. Call stands.", "Still here? Overtime.", "Halftime show is canceled. Scroll back up.", "Fun fact: this page has no cheerleaders.", "Sir, this is a scoreboard.", "Hydrate. Stretch. Then check scores again.",
    "Your team's fine. Probably.", "Stats don't lie. Announcers do.", "Every great comeback starts at the bottom of the page.", "No scores were harmed in the making of this page.", "Fans have been notified. They're yelling already.", "Instant replay says: you're at the bottom.", "The bullpen has been called. Nobody's coming.", "Next play: scroll up.", "Final score: you 1, page 0.", "That's a wrap. Subscribe to nothing.",
    "Slow news day? Check the other league.", "This scoreboard runs on caffeine and pure optimism.", "Please remain seated until the scores come to a complete stop.", "There is no trophy for scrolling. Yet.", "Ten out of ten refs recommend a snack.", "If your team lost, the refs did it.", "If your team won, you called it.", "Pace of play: leisurely.", "A fast break would be nice about now.", "Pulling the goalie for one more scroll.",
    "We have reached the red zone of this page.", "Technically, that's a full-court press.", "Down to the wire, up to the footer.", "In the 2nd half, we scroll.", "Warning: scoreboard may cause chronic refreshing.", "Check the standings. Then check them again.", "Great scroll. Very athletic.", "Nothing but net.", "Top shelf. Where grandma keeps the scores.", "Swing and a miss. The page ended.",
    "Can't spell scoreboard without 'board'.", "Trust the process. Or the playoffs.", "That's a clean sheet, if you're into soccer.", "No snow days at the scoreboard.", "Dynasties come and go. This footer is forever.", "Fourth and long.", "Sudden death: scroll back up.", "The rumor mill is running. Nothing confirmed.", "Hot take: this page is already too long.", "A ref blew the whistle. Nobody knows why.",
    "Quarter's over. Time for a snack.", "Everyone's an expert in the fourth quarter.", "Gone fishin', back in the second period.", "Home team advantage: you.", "Beat the buzzer. Close the app.", "Referee says: delay of scroll.", "The crowd goes mild.", "Another day, another dynasty somewhere.", "Eyes up. The standings moved.", "I'd tell you a football joke, but it'd be too much of a stretch.",
    "Why did the scoreboard blush? It saw the final.", "Hit the showers, champ.", "Underdogs are just favorites with better timing.", "Overtime rules: nobody agrees on them.", "Instant classic loading...", "Play of the day: you, reading this.", "This page brought to you by the number 11.", "Sports: where 'almost' is an entire personality.", "Reminder: it's only a game. (It's not.)", "Be the reason the scoreboard smiles."];
  var qEl = null;
  function quipNow(bottom) {                      // the fun line under the footer; fresh on every arrival, and again at the very bottom
    var f = $("foot"); if (!f) return;
    if (!qEl || !qEl.parentNode) { qEl = D.getElementById("quip"); if (!qEl) { qEl = D.createElement("p"); qEl.id = "quip"; qEl.className = "foot q"; f.parentNode.insertBefore(qEl, f.nextSibling); } }
    var d = new Date(), pool = QUIPS, k = nearHol(), r = Math.random(), h = d.getHours();
    if (k && HQ[k] && r < .55) pool = HQ[k];
    else if (r < .2) pool = DAYQ[d.getDay()];
    else if (h < 5 && r < .6) pool = ["Go to sleep. The games will still be there.", "Late night scores hit different.", "Nothing good happens after midnight. Except West Coast games.", "It's very late. You're a dedicated fan."];
    qEl.classList.remove("in"); qEl.textContent = pick("quip", pool); void qEl.offsetWidth; qEl.classList.add("in");
  }
  var atBottom = false, tick = 0;
  addEventListener("scroll", function () {
    if (tick) return; tick = requestAnimationFrame(function () {
      tick = 0; var nb = innerHeight + scrollY >= D.documentElement.scrollHeight - 6;
      if (nb && !atBottom && D.documentElement.scrollHeight > innerHeight * 1.4) {
        quipNow(true);
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
  // ---------- card packs: points from using the app, about one pack a day (never more); one holiday pack a week ----------
  // Points: 20 for the day's first open, 1 a tap, 3 an arrival, at most 100 a day = at most one pack. Kept as counts
  // that only go up (points earned vs packs opened), so the sync's "highest wins" merge can't bring back an opened pack.
  // Points are never shown anywhere: a pack just turns up as a surprise.
  var PKO = null, pendingMs = [], WEEK = 7 * 864e5, COST = 100, DAYCAP = 100, DAY0 = 20;
  // Days in a row ending on the most recent day in the list (the list holds "Y-M-D" keys, oldest first).
  function streakDays(list) {
    if (!list.length) return 0; var n = 1, prev = keyDate(list[list.length - 1]);
    for (var i = list.length - 2; i >= 0; i--) { var dd = keyDate(list[i]); if (prev - dd === 864e5) { n++; prev = dd; } else break; }
    return n;
  }
  function keyDate(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); }
  function dkey() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function pk0() {
    if (col.pv !== 2) {                           // the old meters: keep at most one waiting pack of each kind, drop the rest
      col.pt = Math.min(col.pk || 0, 1) * COST + Math.min(col.cr || 0, COST - 1); col.ro = 0; col.he = (col.hk || []).filter(function (k) { return HOLS[k]; }).slice(0, 1); col.ho = 0; col.pv = 2;
      delete col.pk; delete col.hk; delete col.cr; delete col.hc;
    }
    if (col.pt == null) col.pt = 0; if (col.ro == null) col.ro = 0; if (!col.he) col.he = []; if (col.ho == null) col.ho = 0;
  }
  function holNow() {                             // the active holiday closest to today (any holiday, not only the animated ones)
    var now = new Date(), best = null, bd = 1e12;
    Object.keys(HOLS).forEach(function (k) { var w = hWin(k, now); if (!w || !w.on) return; var dd = Math.abs(w.d - now); if (dd < bd) { bd = dd; best = k; } });
    return best;
  }
  function packs() { pk0(); var r = Math.max(0, Math.floor(col.pt / COST) - col.ro), h = col.he.slice(col.ho); return { r: r, h: h, n: r + h.length }; }
  function badge() { var b = $("prof"); if (b) b.classList.toggle("pk", packs().n > 0); }
  function earn(n, why) {
    pk0(); var day = dkey(), hk = holNow(), gotR = false, gotH = false;
    if (why === "daily") { if (col.ld === day) return; col.ld = day; n = DAY0; }
    if (!col.ue || col.ue.d !== day) col.ue = { d: day, n: 0 };
    var add = Math.min(n, DAYCAP - col.ue.n); if (add <= 0) return;
    var had = Math.floor(col.pt / COST); col.ue.n += add; col.pt += add; gotR = Math.floor(col.pt / COST) > had;
    // the day's pack also brings the holiday pack while a holiday is on, at most once a week
    if (gotR && hk && (!col.hl || Date.now() - col.hl >= WEEK)) { col.he.push(hk); col.hl = Date.now(); gotH = true; }
    save(); if (!gotR) return; badge();
    var pop = true; try { pop = localStorage.getItem("sb-pk") !== "0"; } catch (e) {}
    if ((gotR || gotH) && pop && acct()) setTimeout(function () { packPop(gotR, gotH ? hk : null); }, why === "daily" ? 1600 : 400);
  }
  var PKP = null;
  function packPop(r, hk) {
    if (PKO || PKP) return;
    var o = E("div", "pkp"), b = E("div", "pkp-b");
    b.appendChild(E("div", "pkp-i", hk && !r ? holEmoji(hk) : "\uD83C\uDF81"));
    b.appendChild(E("div", "pkp-t", r && hk ? "A card pack and a " + HOLS[hk][0] + " pack are ready" : hk ? "A " + HOLS[hk][0] + " pack is ready" : "A card pack is ready"));
    b.appendChild(E("div", "pkp-s", "Ten cards inside. Open it now or find it in your profile."));
    var row = E("div", "pkp-r"), ok = E("button", "pm-b pri", "Open"), no = E("button", "pm-b", "Later"); ok.type = no.type = "button";
    ok.onclick = function () { closePop(); openPacks(); }; no.onclick = closePop;
    row.appendChild(ok); row.appendChild(no); b.appendChild(row); o.appendChild(b);
    o.onclick = function (e) { if (e.target === o) closePop(); };
    D.body.appendChild(o); PKP = o; vib([20, 30, 20]); requestAnimationFrame(function () { o.classList.add("in"); });
  }
  function closePop() { if (!PKP) return; var o = PKP; PKP = null; o.classList.remove("in"); gone(o, 260); }
  function holEmoji(hk) { var c = CAT.filter(function (x) { return x.h === hk; })[0]; return c ? c[3] : "\uD83C\uDF89"; }
  function drawPack(hk) {
    var pool = hk ? CAT.filter(function (c) { return c.h === hk; }) : CAT.filter(function (c) { return !c.h && !AUTO[c[0]] && c[2] !== "S"; });
    if (!pool.length) pool = CAT.filter(function (c) { return !AUTO[c[0]] && c[2] !== "S"; });
    var out = [];
    for (var i = 0; i < 10; i++) out.push(hk ? wchoice(pool, function (c) { return HW2[c[2]] || 1; }) : tierPick(pool));   // flat rates: every card in the pool has the same odds whether you own it or not
    return out;
  }
  function grant(c) {
    var id = c[0], e = col.i[id], isNew = !e;
    if (e) e[1]++; else { col.i[id] = [Date.now(), 1]; if (LOGO[id]) col.i[id][2] = LOGO[id]; }
    return isNew;
  }
  function openPacks() {
    pk0(); if (PKO) return;
    var hk = null, p = packs(); if (p.r > 0) col.ro++; else if (p.h.length) { hk = p.h[0]; col.ho++; } else { say("No packs right now. Another one will turn up."); return; }
    var cards = drawPack(hk), news = cards.map(grant); col.po = (col.po || 0) + 1; save(); badge();
    try { if (localStorage.getItem("sb-lb") && window.SB_LOAD) { clearTimeout(disc.lt); disc.lt = setTimeout(function () { SB_LOAD(function () { PROF.sync(); }); }, 8000); } } catch (e) {}
    packShow(hk, cards, news);
  }
  function miniCard(c, isNew) {
    var m = E("div", "pk-mini r" + c[2] + (isNew ? " new" : "")); m.appendChild(artEl(c, "pk-em", 80, true));
    m.appendChild(E("span", "pk-mn", c[4])); if (isNew) m.appendChild(E("i", "pk-new", "NEW")); return m;
  }
  function packShow(hk, cards, news) {
    var o = E("div", "pko" + (hk ? " hol" : "")), i = 0, stage = 0, auto = false, tray = E("div", "pk-tray"), center = E("div", "pk-c"), bar = E("div", "pk-bar"), flip = null, shown = false;
    PKO = o; D.body.classList.add("rv-on"); o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "Opening a card pack");
    var st = E("div", "rv-st"), sh = []; for (var k = 0; k < 30; k++) sh.push(rnd(100) + "vw " + rnd(100) + "vh 0 " + rnd(2) + "px #fff"); st.style.boxShadow = sh.join(","); o.appendChild(st);
    var ttl = E("div", "pk-t", hk ? HOLS[hk][0].toUpperCase() + " PACK" : "CARD PACK"); o.appendChild(ttl);
    var cnt = E("div", "pk-n", ""); o.appendChild(cnt);
    o.appendChild(center); o.appendChild(tray); o.appendChild(bar);
    var bQuick = E("button", "pm-b", "Reveal all"), bSkip = E("button", "pm-b", "Skip"); bQuick.type = bSkip.type = "button";
    bar.appendChild(bQuick); bar.appendChild(bSkip);
    // stage 0: the sealed pack
    var pack = E("div", "pk-pack"), face = E("div", "pk-face");
    if (hk) face.appendChild(E("span", "pk-pe", holEmoji(hk))); else { var mk = E("span", "pk-pm"); mk.innerHTML = MK; face.appendChild(mk); }
    face.appendChild(E("span", "pk-pl", hk ? HOLS[hk][0] : "Scoreboard")); face.appendChild(E("span", "pk-ps", "10 cards \u00b7 tap to tear"));
    pack.appendChild(E("div", "pk-strip")); pack.appendChild(face); pack.appendChild(E("span", "pk-foil")); center.appendChild(pack);
    function tear() {
      if (stage) return; stage = 1; pack.classList.add("tear"); vib([30, 40, 60]);
      if (!RM) { gConfetti(hk ? 40 : 28, hk ? [holEmoji(hk), "\u2728", "\uD83C\uDF81"] : ["\u2728", "\uD83C\uDFC0", "\uD83C\uDFC8", "\uD83C\uDFD2", "\u26BE"]); gBurst(innerWidth / 2, innerHeight * .45, hk ? "#ffb020" : "#9b8cd9", 26); }
      setTimeout(function () { center.textContent = ""; stage = 2; next(); }, RM ? 0 : 700);
    }
    pack.onclick = tear;
    function next() {
      if (i >= cards.length) { summary(); return; }
      var c = cards[i]; shown = false; cnt.textContent = (i + 1) + " / " + cards.length;
      flip = E("div", "rv-flip pkf"); flip.appendChild(E("div", "rv-bk", "?")); var big = bigCard(c); flip.appendChild(big);
      var wrap = E("div", "rv-ch"); wrap.style.setProperty("--rc", RVC[c[2]] || "#9b8cd9"); wrap.appendChild(flip); center.textContent = ""; center.appendChild(wrap);
      if (news[i]) big.appendChild(E("i", "pk-new big", "NEW"));
      wrap.onclick = function () { if (!shown) show(); else advance(); };
      if (auto) setTimeout(show, 140);
    }
    function show() {
      if (shown) return; shown = true; var c = cards[i], t = tier(c);
      flip.classList.add("fl"); vib(t >= 3 ? [30, 30, 60] : 18);
      if (!RM && t >= 2) { var cx = innerWidth / 2, cy = innerHeight * .42; gBurst(cx, cy, RVC[c[2]], [0, 0, 12, 22, 34, 44, 56][t]); if (t >= 4) gConfetti(60, ["\u2728", "\u2B50", "\uD83D\uDC51"]); else if (t === 3) gConfetti(24, ["\u2728", "\uD83D\uDD2E"]); }
      if (auto) setTimeout(advance, t >= 3 ? 1100 : 520);
    }
    function advance() {
      if (!shown) return; var m = miniCard(cards[i], news[i]); tray.appendChild(m); i++; next();
    }
    function summary() {
      stage = 3; center.textContent = ""; tray.textContent = ""; bar.textContent = "";
      var n = news.filter(Boolean).length, g = E("div", "pk-grid");
      cards.forEach(function (c, k) { var m = miniCard(c, news[k]); m.style.setProperty("--i", k); m.onclick = function () { reveal([c], true); }; g.appendChild(m); });
      center.appendChild(E("div", "pk-sum", n ? n + " new card" + (n > 1 ? "s" : "") + " \u00b7 " + (10 - n) + " duplicate" + (10 - n === 1 ? "" : "s") : "All duplicates this time")); center.appendChild(g);
      cnt.textContent = "";
      var left = packs().n, bDone = E("button", "pm-b pri", left ? "Open next pack (" + left + ")" : "Done"); bDone.type = "button";
      bDone.onclick = function () { packClose(); if (left) setTimeout(openPacks, 260); };
      bar.appendChild(bDone);
      if (left) { var bLater = E("button", "pm-b", "Done"); bLater.type = "button"; bLater.onclick = packClose; bar.appendChild(bLater); }
    }
    bQuick.onclick = function () { auto = true; if (stage === 0) tear(); else if (stage === 2 && !shown) show(); else if (stage === 2) advance(); };
    bSkip.onclick = function () { if (stage === 3) return; stage = 3; summary(); };
    D.body.appendChild(o); requestAnimationFrame(function () { o.classList.add("in"); });
  }
  function packClose() {
    if (!PKO) return; var o = PKO; PKO = null; D.body.classList.remove("rv-on"); o.classList.remove("in"); gone(o, 280);
    setTimeout(function () { milestones(""); }, 400);
  }
  D.addEventListener("keydown", function (e) { if (e.key === "Escape" && PKO) { e.stopImmediatePropagation(); packClose(); } }, true);
  setTimeout(function () { pk0(); earn(0, "daily"); badge(); }, 1200);
  D.addEventListener("visibilitychange", function () { if (!D.hidden) earn(0, "daily"); });   // left open past midnight
  dates();

  window.FUN = { packs: packs, openPacks: openPacks, streak: streakDays, keyDate: keyDate, art: artEl, team: teamDrop, reveal: function (c) { reveal([c], true); }, CAT: CAT, CATS: CATS, RAR: RAR, IDX: IDX, KW: MKW, upcoming: upcoming, col: function () { return col; }, disc: disc, saveCol: save,
    seen: function (id) { col.s[id] = 1; save(); },
    play: function (id, host) {
      var p = id.split("_"), k = p[1];
      if (p[0] === "w" && WIN[k]) WIN[k](holder(host)); else if (p[0] === "l" && LOSE[k]) LOSE[k](holder(host));
      else if (p[0] === "c") flyer(Object.keys(CAMN).filter(function (x) { return "c_" + CAMN[x] === id; })[0] || "🛸");
      else if (p[0] === "b") { var em = Object.keys(BN).filter(function (x) { return "b_" + BN[x] === id; })[0]; var g = layer(), b = mk("fx-ball roll", "", ""), i2 = D.createElement("b"); i2.textContent = em; b.appendChild(i2); g.appendChild(b); gone(b, 3600); }
    },
    say: say, confetti: gConfetti, enterFx: enterFx, after: after, count: count, total: TOTAL, reduced: RM };
})();
