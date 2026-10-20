# Mack's Scoreboard

A phone-first live scoreboard. Static files on GitHub Pages, ESPN's public JSON for data, no build step, no framework.

## Files

| File | What it owns |
| --- | --- |
| `index.html` | App shell. **The only place the build number lives** (`?v=N` on the four URLs). `app.js` reads its own `?v=` and reuses it for `sw.js`, `fun.js`, `fun.css`, `profile.js`. |
| `config.js` | Leagues, default followed teams, timezone, refresh interval. Add a league here and it shows up in "More". |
| `espn.js` | Everything ESPN-specific: fetching, normalizing games/events, box scores, recaps, "Get caught up", team pages. Nothing else knows ESPN's shapes. |
| `app.js` | State, rendering, routing, the rail, cards, detail pages, settings, long-press menu, stat tooltips, keyboard shortcuts. |
| `search.js` | The search language (lazy-loaded): phrases, nicknames, rivalries, days and times → filters; typo repair. |
| `style.css` | Theme tokens (top; dark only, no light mode), layout, and the motion system (bottom, "v1"). |
| `fun.js` / `fun.css` | Collection Log cards, holiday calendar and animations, quips. Lazy-loaded on idle. |
| `profile.js` | Profiles, Collection Log UI, leaderboard (Firebase REST). Lazy-loaded on first open. Usernames are claimed online first (Firebase Auth, case-insensitive), so a name belongs to one person everywhere. |
| `sw.js` | Offline app shell + logo cache. Never caches ESPN data. The page opens from the saved copy (instant), the worker checks the server behind it and, when the build changed, tells the app to show "New version ready · tap to reload". On install it saves the page and every `?v=` file (lazy ones too) so the first open after an update is instant as well. |

## Shipping a change

1. Edit the files.
2. Bump `?v=103` → `?v=104` in `index.html` (all four URLs). Commit `index.html` last so no one loads a half-updated set.
3. Pages serves it within a minute. Open phones get the "New version ready" toast on their next open (the saved shell shows first, the worker notices the change behind it).

## Motion system

`style.css` defines the tokens every ordinary interaction uses:

```
--t1 110ms   taps, presses
--t2 200ms   colour / border / fade
--t3 320ms   sheets, the rail highlight, bigger moves
--ease       cubic-bezier(.2,.7,.2,1)
--spring     cubic-bezier(.34,1.4,.44,1)
```

Buttons, tabs, chips and sheets already get press feedback and transitions from the shared rules. Collapsible sections tween open and closed (`app.js`, "Collapsible sections"). Opening or leaving a game uses the View Transitions API where available, but only for the app's own taps (`NAV` stamps them): a swipe or the browser's Back (`GEST`, set from `hashchange`) swaps instantly, since a cross-fade started under a finger can stall on iOS. Every view swap blocks taps on `#out` for 280ms (`lockTaps`, `body.nav-lock`) so a tap can't land on the old screen, and any touch skips a running transition. The app's own edge swipe is off on iOS, which has a native back swipe (running both stacked two Backs, landing on an old entry that showed one screen while taps hit another); elsewhere it acts only if the hash didn't change during the gesture. History holds exactly one entry per opened page (`pushHash`, `S.depth`): leaving them by a tab, the logo or Settings steps back over all of them (`clearHash` → `history.go(-depth)`) rather than rewriting the top one, so there are never stray entries to go back into. Everything respects `prefers-reduced-motion`, and the Animations switch in Settings (`PREF.motion`, `html.rm`) forces the same thing: every animation and transition lands instantly, the fun layer included. The fun layer's animations are independent and sit on top.

## Extension points (`window.SB`)

```js
SB.v                       // build number, e.g. "64"
SB.state, SB.config        // live state and config (read, don't poke)
SB.on("render", out => …)  // after every render; `out` is the <main> node
SB.on("data", key => …)    // after scores arrive (key = league, or null for a full refresh)
SB.on("view", x => …)      // a game page opened (x) or closed (null)
SB.render()                // ask for a render (coalesced to one per frame)
SB.open(x) / SB.tab(key)   // open a game / switch tab
SB.toast(msg)
SB.allGames(), SB.isFollowed(g), SB.el(tag, cls, text)
```

Rendering is cheap and stateless: every view is rebuilt from `S` by `render()`; async arrivals call `renderSoon()` so many in one frame become one render. A quiet refresh of a list (same tab, scores arriving) keeps every card whose signature (`sigOf`) did not change, so logos never reload and focus stays put (`reuseCards`); a card whose score moved is rebuilt and gets the pop. Cards carry their game on `card._x`; one set of listeners on `#out` handles press-and-hold, prefetch (a finger that settles for 60ms starts the box score) and tooltips for all of them. The game page keeps the play-log scroll position and the "read the full story" state across the 20-second live re-renders.

## Adding things

- **A league**: one line in `config.js`. `kind: "mma" | "race" | "golf"` makes it an event sport (cards and detail pages adapt).
- **A stat tooltip**: add to `TIPS` in `app.js` (`"ABBR": "meaning"`, or `"context:ABBR"` for sport-specific meanings).
- **A collection card / holiday**: `fun.js` (`HD`, `HOLS`, `HFX`). Card fields: `[id, category, rarity, emoji, name, description, hint]`; the description shows on every card, found or not (the hint is kept in data but no longer shown). The 100 famous moments in `MOMS` carry full write-ups, and the card goes into `story` layout when the text runs long.
- **A detail section**: build it in `renderDetail` / `renderEvent` with `sec(title, node, open)`.

## Settings (`PREF` in `app.js`)

Defaults live in the `PREF` object; whatever the person changes is saved under `sb-pref`. Add a key there, a `segRow` in `renderSettings`, and read `PREF.key` where it matters. Current keys: `tab0` (start tab), `compact`, `logos`, `text`, `upwin` (how far ahead lists go), `alerts`, `notify` (final-score notifications), `hideL` (leagues hidden from All), `h24`, `haptic`, `splash`, `motion` (Animations on/off).

## Account prompt

About a minute into first use with no profile signed in (`sb-active`), `app.js` shows one card ("Want to keep your cards?") that says an account only saves the Collection Log and joins the leaderboard, with Make an account / No thanks. It waits if a sheet, the finder or the share bar is open, and it is shown once ever (`sb-acct-ask`).

## Find, search, team pages and athlete pages

**First open** (`pickTeams`): once ever, for a brand-new visitor (`FIRST`: no `sb-cache`, `sb-followed` or `sb-onb` at load) and never over a shared link, a sheet after the splash and first scores asks "Who do you root for?" with the same every-sport team search. Rows toggle in place (no list rebuild); chips show the picks (with the league when two share a name). Done makes the picks the followed list in one reload (`regTeam` registers search-built and lazy leagues, as following does); Skip keeps the defaults. `sb-onb` is set the moment it shows. The account prompt never shows over it and waits a full minute after it closes (`ONB`, `ONB_END`).

**Search** (Find a game, the Find box on My teams, and the add-a-team box in Settings) merges two sources: the core-league team index (`teamIndex`, `ESPN.fetchTeams()`: one standings request per core league, cached a week in `sb-tm`, instant while typing) and **ESPN's site search** (`ESPN.search(q)`: `site.api.espn.com/apis/search/v2?type=team,player`, about 1KB per query, debounced 220ms, cached ten minutes; `peekSearch` lets a re-render paint a finished answer at once). That reaches every team and athlete ESPN covers: college, every soccer league, AFL, UFC, golf, racing, tennis, and team-sport players. `drawHits` draws Teams then Athletes; `mergeTeams` dedupes (a soccer club is one row however many competitions it plays in: `teamKey`), and ESPN's "Club Friendly" placeholder entries are dropped; rows carry an inline follow star (`starTeam` → `followTeam`, or `starBtn` for athletes). Every type-ahead box (Find, Find a team, Settings, the league picker, the Collection Log search, the team picker) is wrapped by `clearable(inp)` (also `SB.clearable` for profile.js): a drawn magnifier (`.tq-i`, CSS mask) and a drawn × (`.tq-x`, two bars, inset evenly by `--xs`/`--xi`; font glyphs sat off-center) that shows only with text, fires `input` so the box redraws, and keeps the keyboard up; the browsers' own clear buttons are hidden. The wrapper is a `<form role=search>` (pass `inForm` when the box already sits in a form) so the phone's Search key always arrives (iOS sends it as a submit): on a touch screen (`TOUCH`) Enter/Search just puts the keyboard away to show the results; with a real keyboard the box's own Enter runs (Find opens the top result). **All inputs are 16px or larger**: phones zoom into any smaller text box on tap and stay zoomed on the next page (the "zoomed-in team page" bug), and an iOS-only `!important` rule keeps new inputs from regressing. Empty boxes show the last few teams and athletes you opened (`remember`, `drawRecent`, `sb-recent`, eight entries). **Sport words narrow, they aren't searched** (`sportQ`): ESPN's search finds nothing for "boston college football" but finds the team for "boston college", so football/basketball/hockey/baseball/soccer, cfb/ncaaf/cbb/ncaaw, men's/women's come out of the query and filter results by league path ("college" stays in the query, since it's in names, and also filters); a sport word still being typed counts once three letters in ("uconn foot", `SPX`). **Half-typed words** (`searchState`): when ESPN has nothing for the whole query ("uconn huski", "man unit"), the cached answer for the words before it is reused, kept to hits with a word starting with the last one in their name, league or sport; at most one more request (often none, since that shorter query was usually already searched). "Nothing matches" waits until the answer is final (`ctl.done`). Applies to every search box.

**The search language** (`search.js`, lazy: loaded on an idle moment after start and on first use, precached by `sw.js`; pure, no network) reads a query the way people say it and returns filters plus the words left to match (`SQ.parse`). It understands, and combines: days (today, tonight, tomorrow, yesterday, last night, weekday names, this weekend, this week, "oct 26", "10/26"); times by Eastern start (night, primetime, late, afternoon, early; Sunday 4pm counts as football's late window); the named windows (MNF/SNF/TNF and spelled out, Sunday Ticket, RedZone, College GameDay, Friday night lights); status (live/now/on now, final/who won/results, next/upcoming/when is, starting soon/kickoff/puck drop); situations (close games/nail biter, overtime/extra innings, blowouts, ranked, my teams, playoffs/postseason/bowl/Super Bowl/World Series/Stanley Cup/March Madness); sports and college/women's; networks ("on espn", fox, tnt, prime, peacock, netflix, nfl network...); nicknames and places (pats, niners, habs, b's, sox, barca, man city, bama, philly, the bay...); rivalries and named games (el clasico, iron bowl, the game, battle of alberta, subway series...); matchups ("pats vs jets", "celtics @ knicks", "bruins leafs"); filler words drop out ("what's on now", "is the bruins game on tonight"). Words match by word start against each game's words (`hayW`: names, abbreviations, league/sport words, event name, network, entrants; accents folded so "montreal" finds "Montréal"). The interpretation shows as chips ("Showing Mon · Night · Football").

**Never empty**: a named day or league that isn't on hand is fetched after the typing pause (`planFetch`: at most 3 leagues x 3 days; event leagues load whole; `FX`/`FXS` keep it for the session, so "snf" on a Monday costs one request once). A team's own schedule is filtered by the same words ("pats monday", "bruins vs leafs" keeps games against the second team). With nothing at all: a typo is repaired against a dictionary of names on hand plus the language's words (`SQ.repair`, 1-2 edits: "celitcs" → Celtics, "Showing results for ..."), then words are loosened from the end ("No exact match ... Closest: ..."), then one-tap starts. Cost: parsing is a few hundred phrase checks per keystroke (well under a millisecond); typo repair only runs on an empty result.

**Find a game** is the bar at the end of the league row (`findBar`, `.rfind`; `f` on a keyboard). Focused, the rail goes to `.finding` (tabs and the three big buttons step aside, Cancel shows) and results drop down under it (`openFind`, `.find.rfp`, top pinned to the rail's bottom). It lists loaded games first, then, for the best two team matches, that team's live / next / last game from its own schedule (`findSched` → `ESPN.scheduleOf`: schedule only, no standings, looked up once typing pauses 350ms on 3+ characters, kept two minutes so the team page opened next reuses it; `schedPicks`; games open through `SG`), so a game that isn't loaded anywhere still turns up. Empty box: one-tap chips (Live now, Today, your teams) above Recent. On a phone the Search key tucks the keyboard away (Enter opens the top result on a keyboard), and a finger scroll of the results does too. New scores refresh open results in place (`ov._fresh`, called from `render`). **Leagues and event sports**: game matching knows each league's sport and common names (`lgWords`, `LGW`: "golf", "fights"/"mma", "formula 1"/"grand prix", "prem", "college football"...). A query naming a league (`leagueHits`: short words whole, 3+ letters by prefix) shows a League row (live count or the next event; tap for its tab), and a lazy league not loaded yet loads in the background after the typing pause (one request; its events then appear as games through `_fresh`). When the words name a league, ESPN's loose team/athlete matches are kept only if they carry the words (`opts.strict`: no random athlete for "f1"). Events ESPN dates without a start time (golf) read as midnight, so `when` shows the day only. **Swipe right** anywhere on the results to close (they follow the finger and fade; past ~28% of the width or a flick closes, less springs back; a mostly vertical move stays a scroll), and pull-to-refresh is off under the search and team-picker sheets. With the keyboard up the list pads its bottom by the keyboard height (`visualViewport`) so the last result can scroll into view. Then Teams and Athletes as everywhere else. The bar is sized to fit the row at 360px (the gap between league tabs tightens below 390px). Picking a game runs the portal (`portal(card, x)`, `.portal`/`.hole`/`.pghost`, View Transition skipped via `NOVT`, `#out.emerge`).

**Leagues outside config.js.** A search hit in a league the app doesn't list (Women's Super League, say) gets a league built from ESPN's path (`leagueFor`, `addLeague`). Its key spells the path in letters and digits (`dynKey`/`dynPath`: `soccer/eng.w.1` → `xsoccer9seng9dw9d1`) so `#team/…` links work after a reload. Following a team there stores the league in `sb-dyn` and marks it eager, so it loads like any extra league and shows under More → Added (a league opened cold from a link takes its name from the standings feed); unfollowing its last team stops loading it (`dynTidy`).

**Team page** (`#team/<league>/<id>`: `openTeam`, `openTeamRoute`, `renderTeamPage`). Ways in: search rows, team names on My teams, **the logo/abbreviation badge on any game card** (`.ab.tbtn`, handled by the capture listener on `#out` so it beats the card tap; the long-press menu lists both teams), other teams' rows in a standings table, and a team-sport player in search (`openPlayerTeam`). It shows: header with Follow and Share, the status in words (`teamStory`), the trend gauge (`tierGauge`: league-wide rank by record from `leagueRank` in `espn.js`, form dots, a dumpster fire for the bottom tenth), the top three from the latest finished game (`teamLeaders`), standings, then next 3 / last 3 with the rest behind toggles. A reload or shared link names the team from its schedule feed. Pull to refresh on a team page refetches that team (bypassing the five-minute standings memo). Opened from Settings, Back returns to Settings (`S.vset`).

**Athlete page** (`#who/<league>/<id>/<name>`: `openPerson`, `openPersonRoute`, `renderPerson`) for fighters, golfers, drivers and tennis players: headshot, league, Follow (the people list in `C.fp`) and the ESPN profile link, then their events in the last week and next two from the event league the app already loads (UFC, F1, NASCAR, PGA/LPGA/DP World; matched by name in `g.pp`). With nothing posted for them yet (fields often post a few days out), the page shows the league's next events; drivers get the next races outright, since entrant lists come late. Sports without a feed here (tennis) show a short note; following still highlights the name. Golfer and driver names on event pages link to their athlete page too (`prow`).

**Cost**: a team page is one standings request (memoized five minutes per league) plus one schedule request and one box score; an athlete page costs nothing beyond its league's normal scoreboard. Only followed teams are written to `sb-tcache` (pruned at boot); browsed teams live in memory. Schedule rows are tappable everywhere: `parseSchedule` keeps the opponent's abbreviation, logo and id, `schedGame` builds the game, and `syncFromHash` finds it in `SG`.

**Following** (`setFollowed(list, lk)`): following a team reloads only that team's league; unfollowing reloads nothing; team data is never wiped. A full refresh marks team pages stale instead of clearing them, so nothing blanks, and `loadTeam` keeps one request in flight per team. A load requested while one is running is queued (`S.again`), not dropped.

## Yesterday tab layout

Three sub-tabs. **Yesterday**: your teams' results, the quick Scoreboard (`quickScores`: every big-four final from yesterday plus college football games with a ranked team, ordered by `qsHeat`: your teams, upsets, overtime, one-score finishes, ranked matchups; primetime games (6:30pm local or later) get the amber frame, corner notch and an amber time pill; one-score games get the floating lavender ring and a "by n" pill; tapping any row opens the game, with `syncFromHash` falling back to `S.yf` for finals already trimmed from the list), then the overview (scores, form guide, next 7 days). **Week**: last 7 days, top performances, then the next 30 days. **Recap**: the day's stories (soccer only when it's a final, World Cup, title decider or a followed side: `bigSoccer`), then the news feed.

## Preseason and polish rules

- **Preseason** (`fetchTeamInfo` in `espn.js`, big four only): once a team's regular schedule is known, preseason games (season type 1) drop out, and until a regular-season or playoff game has been played the standings are left out (ESPN's are preseason numbers then: a "4-0, 1st" before opening night) and `pre: true` is set. My teams and the team page then say "Season starts <date>" and the story says who they open against. Score cards hide an all-zero record ("0-0").
- **Game page**: Latest plays skip filler (faceoffs, stoppages, timeouts, period starts) and repeats; when the AP story is shown, the narrative's "The story" section (the same opening paragraph) is skipped. `[hidden]` always hides (`.ap-more`'s `display:contents` had been showing whole articles), and recap paragraphs keep their spacing.
- **Labels**: "American/National Football Conference" read as AFC/NFC; a streak of 3+ shows only as the badge on My teams (not again in the line under it); the trend summary is "4-1 in last 5" (its separate season count disagreed with the header once playoffs counted); the season-recap numbers sit in one row of five.
- **Settings** has a header (Back, Settings) and opens at the top; long segmented choices drop under their label; the clock/haptics/animations/splash toggles sit under "Feel". The More panel only auto-focuses its search with a real keyboard.

## My teams loading

The first open fetches every followed team at once. Instead of redrawing as each one lands, `loadTeam` reports to `teamsSoon`, which waits until none are in flight (1.2s at most) and redraws once; a loading team holds a card-sized placeholder (`.recap.ld`, `.tsk`). A redraw of the same view never replays the entrance animation (`render`). Active streaks lists only teams on a streak and is left out when no one is.

## Week (Yesterday → Week)

Last seven days of results for followed teams, then "Top performances": the best leader line per category across those games (`weekPerf` in `app.js`, one cached box score per game via `ESPN.fetchGame`, filtered to the followed side by abbreviation). The month ahead lives under Tomorrow.

## Tomorrow (Yesterday → Tomorrow)

`renderTomorrow` in `app.js` summarizes the next 30 days for followed teams from the schedules already saved on the phone (`sb-tcache`): counts, home/away, busiest day, longest gap, a 30-day strip per team, followed-vs-followed games, then the agenda a week at a time. No extra requests.

## Live watch

A live game's page opens with `livePanel` (`app.js`): the status with a pulsing dot, the current win probability and its direction, and per sport the live situation ESPN sends with the scoreboard (`g.q`, normalized in `espn.js`): a virtual field for football (ball spot from `possessionText`, drive direction, down and distance, red zone, timeouts) and a diamond with outs and the count for baseball, plus the last play. Cells in "By period" and "Team stats" that changed since the previous render pulse (`flashCells`), and so does a new top entry in Plays. While a live game is open the app polls every 20s.

## Shared links

Settings → "Copy share link" makes `?add=<base64 {t:[teams], p:[people]}>`. On load, `app.js` offers to add whatever in the link isn't followed yet, then cleans the URL.

## Card packs

Hidden meters in `sb-col` (`cr` regular credits, `hc` holiday credits, `pk` packs owed, `hk` holiday packs owed as holiday keys, `ld` last daily top-up, `ue` usage earned today). `COST` is 100: the daily top-up is one pack, and ordinary use (1 per tap, 3 per arrival, capped at 100 a day) earns about one more. The holiday meter fills at the same time whenever a holiday window is on and pays out a pack from that holiday's cards, at most once a week (`hl` is the last holiday pack; the meter holds full until seven days have passed). Each holiday has 7–11 cards (`HD` in `fun.js`): the themed filler plus moments from that time of year, many from outside the big four (Indy 500, Six Nations, Wimbledon, the Derby, the Ice Bowl). `drawPack` is flat: every card in the pool has the same rarity odds whether you own it or not, and duplicates show as a ×n count in the Collection Log. Cards are granted the moment a pack opens, so skipping never loses anything. Entry points: the pop-up when a pack is earned, the "Open pack" button in the profile, and the gold dot on the profile button.

## Fun layer frequency

`fun.js`: `TAPP` is the per-tap card chance; `holidayFx` runs once a day (first arrival, `sb-hf` remembers the day) with a small burst; win/loss effects play on at most one card per arrival about half the time; the rarer ambient effects (ball, seasonal, gold, cameo) sit under 4% combined.

## Splash

Inline in `index.html` (markup, CSS and a few lines of script) so it paints before anything else loads. One second, then it fades over the already-rendered app. Skipped on deep links, when the Splash setting is off, and shortened under reduced motion.

## Account stats

Profile → Stats (`vStats` in `profile.js`). Counters live in `sb-col`: `d` (last 60 visit days), `d0` first day, `dn` total days opened, `ls` longest streak, `po` packs opened, `gv` games opened, `tp` taps, `fav` the favorite card. Profile age comes from the profile's `c` timestamp. The Cards section leads with the **favorite card** the person picked (★ Favorite on any owned card's detail view; tapping the tile opens that card); with none picked, the tile is a shortcut into the Collection Log. There is no automatic "rarest" pick. Followed teams and people come from the live lists (`SB.config`), so the defaults count before any edit; a game opened before `fun.js` loads is queued (`S.gvq`) and counted when it does. **Sync keeps every counter**: `mergeCol` and `mergeMax` run everything outside `i`/`s`/`d` through `mergeExtra` (numbers keep the higher value, `d0` the earliest day, `ld`/`ue` the latest, the favorite and meters this device's copy), and visit days sort by date, not as text (`fun.js` also re-sorts them on load, since an old sync could have saved them out of order). "Days old" counts from whichever came first, the profile or the first visit, and the share of days visited is capped at 100%.

## Pop-ups

Settings → "New card reveal" (Full show / Quick toast / Off, `sb-rv`) and "Card pack pop-ups" (On / Off, `sb-pk`). Off never loses anything: cards land in the log with a NEW badge and packs wait behind the gold dot. **No pop-ups before an account** (`acct()` in `fun.js`, checks `sb-active`): card reveals, new-card toasts, pack pop-ups and the golden-ticket toast stay quiet until someone signs in; the one-time account prompt is the only pop-up a signed-out person sees.

## Data keys (localStorage)

`sb-tab`, `sb-pref`, `sb-followed`, `sb-fp` (people), `sb-pins`, `sb-cache` (last scores), `sb-tcache` (team pages), `sb-eager` (extra leagues to load), `sb-col` (Collection Log), `sb-profiles`, `sb-active`, `sb-lb`, `sb-hf` (last holiday burst), `sb-rv` / `sb-pk` (pop-up settings).

## Loading (`espn.js`)

`fetchScores` asks for one day per request: ESPN's team-sport scoreboards return nothing for a `dates=A-B` range (only the event sports honor ranges), so don't try to merge them. The saved-scores copy (`sb-cache`) is written when the browser is idle (`saveCache` → `flushCache`, also on `pagehide`), never while painting a refresh.
