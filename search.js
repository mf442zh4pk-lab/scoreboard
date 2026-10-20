// Search language: turns how people actually ask ("monday night football", "pats game tonight", "who won the habs
// game", "nfl on fox sunday", "el clasico", "close games") into filters over games plus the words left to match.
// Pure and synchronous: no network, no DOM. Loaded lazily (app.js) the first time search is used, then cached.
(function () {
  "use strict";

  // ---------- words that never narrow anything ----------
  var STOP = ("the a an of for to in is are was were do does did game games match matches matchup matchups score scores " +
    "scoreboard play plays playing played vs v versus against at watch watching show find me my tv channel what whats when where who " +
    "how time times line lines odds pls please any all on going there theres anything something get").split(" ");
  var STOPW = {}; STOP.forEach(function (w) { STOPW[w] = 1; });
  // "my teams" etc. are intents below; these two only drop out when nothing else claims them.
  delete STOPW.my; delete STOPW.who;

  // ---------- phrases (longest match wins) ----------
  // Each entry: words → effect. Effects compose: "sunday night football on nbc" = day + time + sport + network.
  var P = [];
  function add(words, eff) { words.split("|").forEach(function (w) { P.push([w.split(" "), eff]); }); }
  var DAYN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var DAYA = [["sun"], ["mon"], ["tue", "tues"], ["wed", "weds"], ["thu", "thur", "thurs"], ["fri"], ["sat"]];
  DAYN.forEach(function (d, i) { add(d + "|" + d + "s|" + DAYA[i].join("|"), { wd: i }); });
  // the famous windows
  add("mnf|monday night football", { wd: 1, time: "night", sport: "football", lk: ["nfl"] });
  add("snf|sunday night football", { wd: 0, time: "night", sport: "football", lk: ["nfl"] });
  add("tnf|thursday night football", { wd: 4, time: "night", sport: "football", lk: ["nfl"] });
  add("sunday ticket|nfl sunday|red zone|redzone", { wd: 0, lk: ["nfl"], sport: "football" });
  add("friday night lights", { wd: 5, time: "night", sport: "football" });
  add("college gameday|gameday|saturday football", { wd: 6, sport: "football", lk: ["ncaafb"] });
  add("sunday football", { wd: 0, sport: "football", lk: ["nfl"] });
  add("monday night|monday nite", { wd: 1, time: "night" });
  add("sunday night", { wd: 0, time: "night" }); add("thursday night", { wd: 4, time: "night" });
  add("saturday night", { wd: 6, time: "night" }); add("friday night", { wd: 5, time: "night" });
  add("opening night|opener|season opener", { post: /open|opener/i });
  // days
  add("today|todays|tdy", { day: "today" });
  add("tonight|tonite|2nite|this evening", { day: "today", time: "night" });
  add("tomorrow|tmrw|tmr|tmw|tomorrows", { day: "tomorrow" });
  add("tomorrow night", { day: "tomorrow", time: "night" });
  add("yesterday|yday|yesterdays", { day: "yesterday" });
  add("last night", { day: "yesterday", time: "night" });
  add("this weekend|weekend|the weekend|weekends", { day: "weekend" });
  add("this week|week", { day: "week" });
  // times of day (start time, Eastern)
  add("night|nite|evening|nightcap", { time: "night" });
  add("primetime|prime time|prime-time", { time: "prime" });
  add("late|late night|west coast|late games|after dark", { time: "late" });
  add("afternoon|matinee|day game|day games", { time: "afternoon" });
  add("morning|early|early games|breakfast", { time: "morning" });
  // status
  add("live|now|on now|right now|in progress|happening|ongoing|going on|happening now|playing now|currently|in game|underway", { status: "live" });
  add("final|finals score|finished|over|ended|results|result|recap|recaps|who won|won|winner|winners|lost|loser|beat|outcome|how did", { status: "final" });
  add("upcoming|next|later|coming up|schedule|scheduled|future|when is|when do|when does|starts|start time", { status: "up" });
  add("starting soon|about to start|soon|starting|kickoff|tip off|tipoff|puck drop|first pitch", { status: "soon" });
  // situations
  add("close|close games|close game|tight|nail biter|nailbiter|nail-biter|thriller|barnburner|down to the wire|one score|sweat", { close: 1 });
  add("overtime|ot|extra time|extra innings|extras|shootout|sudden death|double overtime|2ot|triple overtime", { ot: 1 });
  add("blowout|blowouts|rout|routs|laugher|beatdown|shellacking|massacre|demolition|lopsided", { blowout: 1 });
  add("ranked|top 25|top-25|top 10|ap poll", { ranked: 1 });
  add("my teams|my team|my games|my game|favorites|favourites|following|followed|mine|my guys|my squads", { mine: 1 });
  add("playoffs|playoff|postseason|post season|wild card|wildcard|divisional|conference championship|semifinal|semifinals|semis|quarterfinal|quarterfinals|knockout|knockouts|elimination|game 7|game seven|series", { post: /playoff|wild ?card|round|final|championship|semifinal|quarterfinal|series|game \d|knockout|leg/i });
  add("finals|the finals", { post: /final/i });
  add("bowl|bowl game|bowl games|bowl season", { post: /bowl/i, lk: ["ncaafb"] });
  add("super bowl|superbowl|big game", { post: /super bowl/i, lk: ["nfl"] });
  add("world series|fall classic", { post: /world series/i, lk: ["mlb"] });
  add("stanley cup|stanley cup final|cup final", { post: /stanley cup|final/i, lk: ["nhl"] });
  add("march madness|the dance|big dance|final four|sweet 16|sweet sixteen|elite 8|elite eight", { lk: ["ncaamb"], sport: "basketball", college: 1 });
  // sports (filters by league path; the team search sees these words too)
  add("football|nfl football", { sport: "football" });
  add("basketball|hoops|bball|b-ball|roundball", { sport: "basketball" });
  add("hockey|puck|pucks|ice hockey", { sport: "hockey" });
  add("baseball|ball game|ballgame", { sport: "baseball" });
  add("soccer|futbol|fútbol|footie", { sport: "soccer" });
  add("footy|aussie rules|afl footy", { sport: "afl", lk: ["afl"] });
  add("college football|cfb|ncaaf|ncaa football", { sport: "football", college: 1, lk: ["ncaafb"] });
  add("college basketball|college hoops|cbb|ncaab|ncaam|ncaa basketball", { sport: "basketball", college: 1, lk: ["ncaamb"] });
  add("womens college basketball|ncaaw|wbb", { sport: "basketball", college: 1, women: 1, lk: ["ncaawb"] });
  add("college|ncaa|collegiate", { college: 1 });
  add("womens|women's|women|ladies|wnba", { women: 1 });
  add("mens|men's|men", { men: 1 });
  add("fight|fights|fight night|mma|cage|card|main card|main event|ppv|pay per view", { lk: ["ufc"] });
  add("race|races|racing|motorsport|motorsports", { sport: "racing" });
  add("grand prix|gp|f1|formula 1|formula one|quali|qualifying", { lk: ["f1"] });
  add("nascar|daytona|talladega|cup series", { lk: ["nascar"] });
  add("golf|tee times|tournament|pga|pga tour", { sport: "golf" });
  add("masters|the masters|pga championship|us open golf|the open|open championship|ryder cup|majors|fedex cup|tour championship", { sport: "golf", lk: ["pga", "eur"] });
  add("tennis|wimbledon|us open tennis|french open|roland garros|australian open", { sport: "tennis" });
  // networks (the game's listed broadcast)
  var NET = { "espn": /espn/i, "espn2": /espn2/i, "espnu": /espnu/i, "espn+|espn plus": /espn\+/i, "abc": /abc/i, "nbc": /nbc|peacock/i, "cbs": /cbs|paramount/i,
    "fox|on fox": /fox|fs1/i, "fs1": /fs1/i, "fs2": /fs2/i, "tnt": /tnt|trutv|max/i, "tbs": /tbs/i, "trutv": /trutv/i, "peacock": /peacock/i,
    "prime video|amazon|on prime|amazon prime": /prime|amazon/i, "netflix": /netflix/i, "apple tv|apple tv+|on apple": /apple/i,
    "nfl network|nfln": /nfl net/i, "nba tv": /nba tv/i, "nhl network": /nhl net/i, "mlb network": /mlb net/i, "paramount|paramount+": /paramount/i,
    "on max|hbo max": /max/i, "youtube|on youtube": /youtube/i, "sec network|secn": /sec ?n/i, "big ten network|btn": /btn|big ten/i,
    "acc network|accn": /acc ?n/i, "the cw|cw": /\bcw\b/i, "national tv|nationally televised": /espn|abc|nbc|cbs|fox|tnt|tbs|prime|netflix/i,
    "league pass": /league pass/i, "local": /nbcs|msg|nesn|bally|fanduel|sny|yes|root|marquee|mnmt|space city|altitude|kunp/i };
  Object.keys(NET).forEach(function (k) { add(k, { net: NET[k], netName: k.split("|")[0].replace(/^on /, "").toUpperCase() }); });

  // ---------- nicknames, shorthand and places → words that are in the names ----------
  // Values: one or more alternatives ("|"), each a run of words that must all appear.
  var AL = {
    // NFL
    pats: "patriots", niners: "49ers", "9ers": "49ers", bucs: "buccaneers|pirates", jags: "jaguars", cards: "cardinals", fins: "dolphins", phins: "dolphins",
    gmen: "giants", "g-men": "giants", skins: "commanders", hawks: "seahawks|hawks|blackhawks", pack: "packers", bolts: "chargers|lightning",
    boys: "cowboys", birds: "eagles|cardinals|orioles|blue jays", iggles: "eagles", vikes: "vikings", bills: "bills", broncs: "broncos",
    "chi-town": "chicago", raidahs: "raiders", texans: "texans", saints: "saints", bengals: "bengals", stillers: "steelers", squawks: "seahawks",
    // NBA
    celts: "celtics", cs: "celtics", sixers: "76ers", cavs: "cavaliers", mavs: "mavericks", wolves: "timberwolves|wolves", twolves: "timberwolves",
    blazers: "trail blazers", dubs: "warriors", grizz: "grizzlies", pels: "pelicans", nugs: "nuggets", lakeshow: "lakers", clips: "clippers",
    knicks: "knicks", nets: "nets", sixer: "76ers", spurs: "spurs|tottenham", okc: "thunder", raps: "raptors", bucks: "bucks", wiz: "wizards",
    // NHL
    habs: "canadiens", leafs: "maple leafs", sens: "senators", caps: "capitals", pens: "penguins", preds: "predators", canes: "hurricanes",
    nucks: "canucks", isles: "islanders", avs: "avalanche", wings: "red wings", knights: "golden knights", vgk: "golden knights", bs: "bruins",
    "b's": "bruins", jackets: "blue jackets", cbj: "blue jackets", sabres: "sabres", yotes: "mammoth", flyers: "flyers", hab: "canadiens",
    // MLB
    sox: "red sox|white sox", bosox: "red sox", chisox: "white sox", yanks: "yankees", os: "orioles", "o's": "orioles", jays: "blue jays",
    halos: "angels", dbacks: "diamondbacks", "d-backs": "diamondbacks", snakes: "diamondbacks", phils: "phillies", nats: "nationals",
    stros: "astros", "'stros": "astros", buccos: "pirates", redbirds: "cardinals", brew: "brewers", crew: "brewers", tigs: "tigers", mariners: "mariners",
    // soccer
    gunners: "arsenal", "red devils": "manchester united", "man u": "manchester united", "man utd": "manchester united", "man united": "manchester united",
    united: "manchester united|united", "man city": "manchester city", citizens: "manchester city", cityzens: "manchester city", toffees: "everton",
    villa: "aston villa", barca: "barcelona", "barça": "barcelona", real: "real madrid|real salt lake|real sociedad|real betis", madrid: "real madrid|atletico madrid", atleti: "atletico",
    juve: "juventus", psg: "paris saint germain", bayern: "bayern munich", inter: "inter milan|inter miami", "the reds": "liverpool",
    magpies: "newcastle", "toon": "newcastle", hammers: "west ham", saints2: "southampton", "the blues": "chelsea", foxes: "leicester", wolves2: "wolverhampton",
    lafc: "los angeles fc", "la galaxy": "galaxy", "nycfc": "new york city fc", "miami fc": "inter miami", messi: "inter miami",
    // college
    bama: "alabama", uconn: "uconn", unc: "north carolina", osu: "ohio state|oklahoma state|oregon state", fsu: "florida state", uga: "georgia",
    nd: "notre dame", irish: "notre dame", "the u": "miami hurricanes", huskers: "nebraska", vols: "tennessee", dawgs: "georgia|washington|mississippi state",
    noles: "florida state", wvu: "west virginia", psu: "penn state", msu: "michigan state|mississippi state", um: "michigan|miami", ucla: "ucla",
    usc: "usc|south carolina", lsu: "lsu", tamu: "texas a m", "a&m": "a m", "texas a&m": "texas a m", horns: "longhorns", bucks2: "ohio state",
    buckeyes: "ohio state", "ole miss": "ole miss", zags: "gonzaga", nova: "villanova", cuse: "syracuse", "the cuse": "syracuse", bc: "boston college",
    bu: "boston university", gt: "georgia tech", vt: "virginia tech", hokies: "virginia tech", uk: "kentucky", ku: "kansas", ksu: "kansas state",
    // places
    philly: "philadelphia", nyc: "new york", ny: "new york", la: "los angeles", "l.a.": "los angeles", sf: "san francisco", "bay area": "san francisco|golden state|san jose|oakland",
    "the bay": "san francisco|golden state|san jose", dc: "washington", kc: "kansas city", vegas: "vegas|las vegas", jax: "jacksonville", nola: "new orleans",
    motown: "detroit", beantown: "boston", chi: "chicago", chitown: "chicago", atl: "atlanta", htown: "houston", "h-town": "houston", "big d": "dallas",
    dfw: "dallas", minny: "minnesota", cle: "cleveland", cincy: "cincinnati", pitt: "pittsburgh|pitt", stl: "st louis", "st. louis": "st louis",
    "saint louis": "st louis", indy: "indianapolis|indiana", nashvegas: "nashville", sd: "san diego", tb: "tampa bay", tampa: "tampa bay", phx: "phoenix",
    slc: "utah", "new england": "new england", jersey: "new jersey", toronto: "toronto", montreal: "montreal",
    "red sox": "red sox", "white sox": "white sox", "red wings": "red wings", "maple leafs": "maple leafs", "blue jays": "blue jays",
    "trail blazers": "trail blazers", "golden knights": "golden knights", "blue jackets": "blue jackets", "golden state": "golden state warriors",
    "san jose": "san jose", "new york": "new york", "los angeles": "los angeles", "kansas city": "kansas city", "st louis": "st louis",
    "tampa bay": "tampa bay", "green bay": "green bay", "new orleans": "new orleans", "las vegas": "las vegas", "salt lake": "salt lake",
    "ohio state": "ohio state", "penn state": "penn state", "notre dame": "notre dame", "boston college": "boston college", "texas tech": "texas tech"
  };
  // a few keys above collide; keep the duplicates' first meaning only
  delete AL.saints2; delete AL.wolves2; delete AL.bucks2;
  // Rivalries and named games: both sides must be in the game.
  var RIV = {
    "el clasico|clasico|el clásico": [["real madrid"], ["barcelona"], "laliga"],
    "north london derby": [["arsenal"], ["tottenham"], "epl"], "manchester derby": [["manchester united"], ["manchester city"], "epl"],
    "merseyside derby": [["liverpool"], ["everton"], "epl"], "old firm": [["celtic"], ["rangers"], ""],
    "the game|michigan ohio state": [["michigan"], ["ohio state"], "ncaafb"], "iron bowl": [["alabama"], ["auburn"], "ncaafb"],
    "red river|red river rivalry|red river showdown": [["texas"], ["oklahoma"], "ncaafb"], "egg bowl": [["ole miss"], ["mississippi state"], "ncaafb"],
    "apple cup": [["washington"], ["washington state"], "ncaafb"], "civil war|bedlam": [["oklahoma"], ["oklahoma state"], "ncaafb"],
    "holy war": [["byu"], ["utah"], "ncaafb"], "backyard brawl": [["pitt"], ["west virginia"], "ncaafb"], "army navy": [["army"], ["navy"], "ncaafb"],
    "battle of alberta": [["oilers"], ["flames"], "nhl"], "battle of ontario": [["maple leafs"], ["senators"], "nhl"],
    "battle of pennsylvania": [["flyers"], ["penguins"], "nhl"], "subway series": [["yankees"], ["mets"], "mlb"],
    "freeway series": [["dodgers"], ["angels"], "mlb"], "crosstown classic": [["cubs"], ["white sox"], "mlb"],
    "sox yankees|yankees red sox|red sox yankees": [["red sox"], ["yankees"], "mlb"], "celtics lakers|lakers celtics": [["celtics"], ["lakers"], "nba"],
    "the rivalry": [["red sox|celtics|bruins|patriots"], ["yankees|lakers|canadiens|jets"], ""], "duke unc|duke carolina|tobacco road": [["duke"], ["north carolina"], ""]
  };
  Object.keys(RIV).forEach(function (k) { add(k, { riv: RIV[k] }); });
  add("vs|v|versus|against|at|@|plays|playing|hosts|host|visit|visits|visiting|faces|face|take on|takes on", { sep: 1 });
  P.sort(function (a, b) { return b[0].length - a[0].length; });   // longest phrase first

  // ---------- helpers ----------
  var MON = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’`]/g, "'").replace(/@/g, " @ ").replace(/[^a-z0-9à-ÿ'+&@./ -]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var fmtC = {};
  function parts(d, tz) {   // weekday, hour and date of an instant in the scoreboard's time zone
    var f = fmtC[tz] || (fmtC[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }));
    var o = {}; f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), h: +o.hour % 24, ymd: o.year + o.month + o.day };
  }
  function addDays(now, n) { return new Date(now.getTime() + n * 864e5); }
  var SPORT = { football: /^football\//, basketball: /^basketball\//, hockey: /^hockey\//, baseball: /^baseball\//, soccer: /^soccer\//, afl: /^australian-football\//, golf: /^golf\//, tennis: /^tennis\//, racing: /^racing\// };
  var SPORTL = { football: ["nfl", "ncaafb"], basketball: ["nba"], hockey: ["nhl"], baseball: ["mlb"], golf: ["pga"], racing: ["f1", "nascar"], afl: ["afl"] };
  var MARGIN = { football: [8, 21], basketball: [5, 20], hockey: [1, 4], baseball: [1, 7], soccer: [1, 3], "australian-football": [12, 50] };

  // ---------- parse ----------
  // ctx: { now, tz, path(lk), isClose(x), isFollowed(x) }
  function parse(raw, ctx) {
    var t = norm(raw).split(" ").filter(Boolean), now = ctx.now || new Date(), tz = ctx.tz || "America/New_York";
    var o = { groups: [], lit: [], tq: [], wd: null, day: null, dates: [], time: null, status: null, close: 0, ot: 0, blowout: 0, ranked: 0, mine: 0,
      post: null, sports: [], college: 0, women: 0, men: 0, nets: [], netNames: [], lks: [], lkf: [], riv: null, sep: 0, chips: [] };
    for (var i = 0; i < t.length;) {
      // dates: "oct 22", "october 22nd", "10/22", "22 oct"
      var dm = null;
      if (MON[t[i]] != null && /^\d{1,2}(st|nd|rd|th)?$/.test(t[i + 1] || "")) { dm = [MON[t[i]], parseInt(t[i + 1], 10)]; i += 2; }
      else if (/^\d{1,2}(st|nd|rd|th)?$/.test(t[i]) && MON[t[i + 1]] != null) { dm = [MON[t[i + 1]], parseInt(t[i], 10)]; i += 2; }
      else if (/^\d{1,2}\/\d{1,2}$/.test(t[i])) { var sl = t[i].split("/"); dm = [parseInt(sl[0], 10) - 1, parseInt(sl[1], 10)]; i += 1; }
      if (dm) {
        var y = parts(now, tz).ymd.slice(0, 4), dd = new Date(Date.UTC(+y, dm[0], dm[1], 16));
        if (dd - now < -60 * 864e5) dd = new Date(Date.UTC(+y + 1, dm[0], dm[1], 16));
        o.dates.push(parts(dd, tz).ymd); o.chips.push(dd.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }));
        continue;
      }
      // longest phrase at this spot
      var hit = null;
      for (var k = 0; k < P.length; k++) {
        var w = P[k][0]; if (i + w.length > t.length) continue;
        var ok = true; for (var j = 0; j < w.length; j++) if (t[i + j] !== w[j]) { ok = false; break; }
        if (ok) { hit = P[k]; break; }
      }
      if (hit) { apply(o, hit[1], hit[0].join(" ")); i += hit[0].length; continue; }
      var tok = t[i]; i++;
      // two-word nickname ("man city", "red devils", "bay area")
      var two = tok + " " + (t[i] || "");
      if (t[i] && AL[two]) { o.groups.push(AL[two].split("|")); o.tq.push(AL[two].split("|")[0]); i++; continue; }
      if (AL[tok] && AL[tok] !== tok) { var alts = AL[tok].split("|"); o.groups.push(alts.concat(tok)); o.tq.push(alts.length === 1 ? alts[0] : tok); continue; }
      tok = tok.replace(/'s$/, "").replace(/^'|'$/g, "");   // "what's" → "what", "patriots'" → "patriots"
      if (STOPW[tok] || tok === "my" || tok === "who" || tok === "whats" || tok === "whos") continue;
      if (!tok) continue;
      var tw = tok.replace(/[^a-z0-9]+/g, " ").trim(); if (!tw) continue;   // "o'brien" → "o brien", matched as a run of words
      o.groups.push([tw]); o.lit.push(tok); o.tq.push(tok);
    }
    // resolve days to dates (Eastern)
    var today = parts(now, tz);
    var dayset = {};
    var addD = function (n) { dayset[parts(addDays(now, n), tz).ymd] = 1; };
    if (o.day === "today") addD(0); else if (o.day === "tomorrow") addD(1); else if (o.day === "yesterday") addD(-1);
    else if (o.day === "weekend") { for (var n = 0; n < 7; n++) { var p0 = parts(addDays(now, n), tz); if (p0.wd === 6 || p0.wd === 0) dayset[p0.ymd] = 1; if (p0.wd === 0) break; } }
    else if (o.day === "week") { for (var n2 = 0; n2 < 7; n2++) addD(n2); }
    if (o.wd != null) {   // the next such day (today counts), or the past one when asking about results
      var back = o.status === "final";
      for (var n3 = 0; n3 < 7; n3++) { var off = back ? -n3 : n3, p1 = parts(addDays(now, off), tz); if (p1.wd === o.wd) { dayset[p1.ymd] = 1; break; } }
    }
    o.dates.forEach(function (d) { dayset[d] = 1; });
    o.days = Object.keys(dayset).sort();
    o.dayOffs = o.days.map(function (d) {
      var a = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)), b = Date.UTC(+today.ymd.slice(0, 4), +today.ymd.slice(4, 6) - 1, +today.ymd.slice(6, 8));
      return Math.round((a - b) / 864e5);
    });
    // leagues the words imply (for loading data that isn't on hand)
    o.sports.forEach(function (s) { (SPORTL[s] || []).forEach(function (l) { if (o.lks.indexOf(l) < 0 && !(s === "football" && l === "ncaafb" && !o.college && o.wd !== 6 && o.wd !== 5)) o.lks.push(l); }); });
    if (o.college) o.lks = o.lks.filter(function (l) { return /^ncaa/.test(l); }).concat(o.sports.indexOf("football") >= 0 && o.lks.indexOf("ncaafb") < 0 ? ["ncaafb"] : []);
    o.intent = !!(o.days.length || o.time || o.status || o.close || o.ot || o.blowout || o.ranked || o.mine || o.post || o.nets.length || o.riv || o.sports.length || o.college || o.women);
    o.timed = !!(o.days.length || o.time || o.status === "up" || o.status === "soon");
    o.test = makeTest(o, ctx, tz, now);
    o.tq = o.tq.length ? o.tq.concat(o.sports.filter(function (s) { return s !== "racing" && s !== "golf" && s !== "tennis"; }), o.college ? ["college"] : [], o.women ? ["womens"] : []).join(" ").trim() : "";
    return o;
  }
  function apply(o, e, phrase) {
    if (e.sep) { o.sep = 1; return; }
    if (e.wd != null) { o.wd = e.wd; pushChip(o, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][e.wd]); }
    if (e.day) { o.day = e.day; pushChip(o, { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday", weekend: "This weekend", week: "This week" }[e.day]); }
    if (e.time) { o.time = e.time; pushChip(o, { night: "Night", prime: "Primetime", late: "Late", afternoon: "Afternoon", morning: "Early" }[e.time]); }
    if (e.status) { o.status = e.status; pushChip(o, { live: "Live", final: "Final", up: "Upcoming", soon: "Starting soon" }[e.status]); }
    if (e.close) { o.close = 1; pushChip(o, "Close"); }
    if (e.ot) { o.ot = 1; pushChip(o, "Overtime"); }
    if (e.blowout) { o.blowout = 1; pushChip(o, "Blowouts"); }
    if (e.ranked) { o.ranked = 1; pushChip(o, "Ranked"); }
    if (e.mine) { o.mine = 1; pushChip(o, "Your teams"); }
    if (e.post) { o.post = e.post; pushChip(o, "Postseason"); }
    if (e.sport) { if (o.sports.indexOf(e.sport) < 0) o.sports.push(e.sport); pushChip(o, e.sport === "afl" ? "AFL" : e.sport.charAt(0).toUpperCase() + e.sport.slice(1)); }
    if (e.college) { o.college = 1; pushChip(o, "College"); }
    if (e.women) { o.women = 1; pushChip(o, "Women's"); }
    if (e.men) o.men = 1;
    if (e.net) { o.nets.push(e.net); pushChip(o, "On " + e.netName); }
    if (e.lk) e.lk.forEach(function (l) { if (o.lks.indexOf(l) < 0) o.lks.push(l); if (o.lkf.indexOf(l) < 0) o.lkf.push(l); });
    if (e.riv) { o.riv = e.riv; o.groups.push(e.riv[0][0].split("|")); o.groups.push(e.riv[1][0].split("|")); if (e.riv[2] && o.lks.indexOf(e.riv[2]) < 0) o.lks.push(e.riv[2]); pushChip(o, phrase.replace(/\b\w/g, function (c) { return c.toUpperCase(); })); }
  }
  function pushChip(o, c) { if (c && o.chips.indexOf(c) < 0) o.chips.push(c); }

  // A game passes when every filter does and every word group finds its words (by word start) in the game's text.
  function makeTest(o, ctx, tz, now) {
    var days = null;   // filled after parse resolves them
    return function (x, hw) {   // hw: the game's words, spaced (" new england patriots ne nfl football ... ")
      var g = x.g, path = ctx.path(x.lk) || "", sp = path.split("/")[0];
      if (!days) { days = {}; o.days.forEach(function (d) { days[d] = 1; }); }
      if (o.sports.length && !o.sports.some(function (s) { return SPORT[s] && SPORT[s].test(path); })) return false;
      if (o.college && !/college/.test(path)) return false;
      if (o.women && !/womens|wnba|nwsl|lpga|wta/.test(path)) return false;
      if (o.men && /womens|wnba|nwsl|lpga/.test(path)) return false;
      var pt = null;
      if (o.days.length || o.time || o.wd != null) { pt = parts(new Date(g.t), tz); if (o.days.length && !days[pt.ymd]) return false; }
      if (o.time) {
        var h = pt.h;
        if (o.time === "night" && h < 17) return false;
        if (o.time === "prime" && h < 19) return false;
        if (o.time === "late" && h < 21 && !(sp === "football" && pt.wd === 0 && h >= 16 && h < 18)) return false;   // NFL's "late window" is 4pm Sunday
        if (o.time === "afternoon" && (h < 12 || h >= 18)) return false;
        if (o.time === "morning" && h >= 14) return false;
      }
      if (o.status === "live" && g.s !== "live") return false;
      if (o.status === "final" && g.s !== "final") return false;
      if (o.status === "up" && g.s !== "up") return false;
      if (o.status === "soon" && !(g.s === "up" && Date.parse(g.t) - now < 90 * 60000) && g.s !== "live") return false;
      var hs = g.h[2], as = g.a[2], diff = hs != null && as != null ? Math.abs(hs - as) : null, mg = MARGIN[sp] || [1, 99];
      if (o.close && !(ctx.isClose(x) || (g.s === "final" && diff != null && diff <= mg[0]) || (g.s === "live" && diff != null && diff <= mg[0]))) return false;
      if (o.ot && !(g.o || /OT|SO|ET|extra/i.test(g.c || ""))) return false;
      if (o.blowout && !(g.s !== "up" && diff != null && diff >= mg[1])) return false;
      if (o.ranked && !(g.h[6] || g.a[6])) return false;
      if (o.mine && !ctx.isFollowed(x)) return false;
      if (o.post && !o.post.test(g.n || "")) return false;
      if (o.nets.length && !o.nets.some(function (r) { return r.test(g.b || ""); })) return false;
      // a phrase that names a league ("mnf", "gameday", "march madness", "fights") keeps to it, unless words name teams
      if (o.lkf.length && !o.groups.length && o.lkf.indexOf(x.lk) < 0) return false;
      if (o.groups.length) {
        for (var gi = 0; gi < o.groups.length; gi++) {
          var any = false, alts = o.groups[gi];
          for (var ai = 0; ai < alts.length && !any; ai++) {
            var ws = alts[ai].split(" "), all = true;
            for (var wi = 0; wi < ws.length; wi++) if (hw.indexOf(" " + ws[wi]) < 0) { all = false; break; }
            if (all) any = true;
          }
          if (!any) return false;
        }
      }
      return true;
    };
  }

  // ---------- typo repair: the closest known word within one or two edits ----------
  function dist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], (prev2[j - 2] || 0) + 1);   // swapped letters
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      var prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  // vocab: { word: weight }. Returns the corrected query, or null when nothing changed.
  function repair(raw, vocab) {
    var known = function (w) { return vocab[w] || STOPW[w] || AL[w] || P.some(function (p) { return p[0].length === 1 && p[0][0] === w; }); };
    var words = norm(raw).split(" "), changed = false;
    var out = words.map(function (w) {
      if (w.length < 4 || /\d/.test(w) || known(w)) return w;
      var max = w.length >= 8 ? 2 : 1, best = null, bd = max + 1, bw = 0;
      for (var v in vocab) {
        if (Math.abs(v.length - w.length) > max || v.charAt(0) !== w.charAt(0) && max < 2) continue;
        var d = dist(w, v, max);
        if (d < bd || (d === bd && vocab[v] > bw)) { bd = d; best = v; bw = vocab[v]; }
      }
      if (best && bd <= max) { changed = true; return best; }
      return w;
    });
    return changed ? out.join(" ") : null;
  }
  // Words people type that this file understands, for the typo repair's dictionary.
  function words() {
    var o = {};
    P.forEach(function (p) { p[0].forEach(function (w) { if (w.length >= 3) o[w] = 2; }); });
    Object.keys(AL).forEach(function (k) { o[k] = 2; AL[k].split(/[| ]/).forEach(function (w) { if (w.length >= 3) o[w] = 2; }); });
    return o;
  }

  window.SQ = { parse: parse, repair: repair, words: words, norm: norm, parts: parts };
})();
