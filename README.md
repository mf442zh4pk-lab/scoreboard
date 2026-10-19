# Mack's Scoreboard

A phone-first live scoreboard. Static files on GitHub Pages, ESPN's public JSON for data, no build step, no framework.

## Files

| File | What it owns |
| --- | --- |
| `index.html` | App shell. **The only place the build number lives** (`?v=N` on the four URLs). `app.js` reads its own `?v=` and reuses it for `sw.js`, `fun.js`, `fun.css`, `profile.js`. |
| `config.js` | Leagues, default followed teams, timezone, refresh interval. Add a league here and it shows up in "More". |
| `espn.js` | Everything ESPN-specific: fetching, normalizing games/events, box scores, recaps, "Get caught up", team pages. Nothing else knows ESPN's shapes. |
| `app.js` | State, rendering, routing, the rail, cards, detail pages, settings, long-press menu, stat tooltips, keyboard shortcuts. |
| `style.css` | Theme tokens (top), layout, and the motion system (bottom, "v1"). |
| `fun.js` / `fun.css` | Collection Log cards, holiday calendar and animations, quips. Lazy-loaded on idle. |
| `profile.js` | Profiles, Collection Log UI, leaderboard (Firebase REST). Lazy-loaded on first open. Usernames are claimed online first (Firebase Auth, case-insensitive), so a name belongs to one person everywhere. |
| `sw.js` | Offline app shell + logo cache. Never caches ESPN data. The page opens from the saved copy (instant), the worker checks the server behind it and, when the build changed, tells the app to show "New version ready · tap to reload". On install it saves the page and every `?v=` file (lazy ones too) so the first open after an update is instant as well. |

## Shipping a change

1. Edit the files.
2. Bump `?v=88` → `?v=89` in `index.html` (all four URLs). Commit `index.html` last so no one loads a half-updated set.
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

Buttons, tabs, chips and sheets already get press feedback and transitions from the shared rules. Collapsible sections tween open and closed (`app.js`, "Collapsible sections"). Opening or leaving a game uses the View Transitions API where available. Everything respects `prefers-reduced-motion`, and the Animations switch in Settings (`PREF.motion`, `html.rm`) forces the same thing: every animation and transition lands instantly, the fun layer included. The fun layer's animations are independent and sit on top.

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

**Search** (Find overlay, the Find box on My teams, and the add-a-team box in Settings) merges two sources: the core-league team index (`teamIndex`, `ESPN.fetchTeams()`: one standings request per core league, cached a week in `sb-tm`, instant while typing) and **ESPN's site search** (`ESPN.search(q)`: `site.api.espn.com/apis/search/v2?type=team,player`, about 1KB per query, debounced 220ms, cached ten minutes; `peekSearch` lets a re-render paint a finished answer at once). That reaches every team and athlete ESPN covers: college, every soccer league, AFL, UFC, golf, racing, tennis, and team-sport players. `drawHits` draws Teams then Athletes; `mergeTeams` dedupes (a soccer club is one row however many competitions it plays in: `teamKey`), and ESPN's "Club Friendly" placeholder entries are dropped; rows carry an inline follow star (`starTeam` → `followTeam`, or `starBtn` for athletes). Every type-ahead box (Find, Find a team, Settings, the league picker, the Collection Log search) is wrapped by `clearable(inp)` (also `SB.clearable` for profile.js): one × of our own that shows only with text, fires `input` so the box redraws, and keeps the keyboard up; the browsers' own clear buttons are hidden. **All inputs are 16px or larger**: phones zoom into any smaller text box on tap and stay zoomed on the next page (the "zoomed-in team page" bug), and an iOS-only `!important` rule keeps new inputs from regressing. Empty boxes show the last few teams and athletes you opened (`remember`, `drawRecent`, `sb-recent`, eight entries). Find also lists loaded games first; picking one runs the portal (`portal(card, x)`, `.portal`/`.hole`/`.pghost`, View Transition skipped via `NOVT`, `#out.emerge`).

**Leagues outside config.js.** A search hit in a league the app doesn't list (Women's Super League, say) gets a league built from ESPN's path (`leagueFor`, `addLeague`). Its key spells the path in letters and digits (`dynKey`/`dynPath`: `soccer/eng.w.1` → `xsoccer9seng9dw9d1`) so `#team/…` links work after a reload. Following a team there stores the league in `sb-dyn` and marks it eager, so it loads like any extra league and shows under More → Added (a league opened cold from a link takes its name from the standings feed); unfollowing its last team stops loading it (`dynTidy`).

**Team page** (`#team/<league>/<id>`: `openTeam`, `openTeamRoute`, `renderTeamPage`). Ways in: search rows, team names on My teams, **the logo/abbreviation badge on any game card** (`.ab.tbtn`, handled by the capture listener on `#out` so it beats the card tap; the long-press menu lists both teams), other teams' rows in a standings table, and a team-sport player in search (`openPlayerTeam`). It shows: header with Follow and Share, the status in words (`teamStory`), the trend gauge (`tierGauge`: league-wide rank by record from `leagueRank` in `espn.js`, form dots, a dumpster fire for the bottom tenth), the top three from the latest finished game (`teamLeaders`), standings, then next 3 / last 3 with the rest behind toggles. A reload or shared link names the team from its schedule feed. Pull to refresh on a team page refetches that team (bypassing the five-minute standings memo). Opened from Settings, Back returns to Settings (`S.vset`).

**Athlete page** (`#who/<league>/<id>/<name>`: `openPerson`, `openPersonRoute`, `renderPerson`) for fighters, golfers, drivers and tennis players: headshot, league, Follow (the people list in `C.fp`) and the ESPN profile link, then their events in the last week and next two from the event league the app already loads (UFC, F1, NASCAR, PGA/LPGA/DP World; matched by name in `g.pp`). With nothing posted for them yet (fields often post a few days out), the page shows the league's next events; drivers get the next races outright, since entrant lists come late. Sports without a feed here (tennis) show a short note; following still highlights the name. Golfer and driver names on event pages link to their athlete page too (`prow`).

**Cost**: a team page is one standings request (memoized five minutes per league) plus one schedule request and one box score; an athlete page costs nothing beyond its league's normal scoreboard. Only followed teams are written to `sb-tcache` (pruned at boot); browsed teams live in memory. Schedule rows are tappable everywhere: `parseSchedule` keeps the opponent's abbreviation, logo and id, `schedGame` builds the game, and `syncFromHash` finds it in `SG`.

**Following** (`setFollowed(list, lk)`): following a team reloads only that team's league; unfollowing reloads nothing; team data is never wiped. A full refresh marks team pages stale instead of clearing them, so nothing blanks, and `loadTeam` keeps one request in flight per team. A load requested while one is running is queued (`S.again`), not dropped.

## Yesterday tab layout

Three sub-tabs. **Yesterday**: your teams' results, the quick Scoreboard (`quickScores`: every big-four final from yesterday plus college football games with a ranked team, ordered by `qsHeat`: your teams, upsets, overtime, one-score finishes, ranked matchups; primetime games (6:30pm local or later) get the amber frame, corner notch and an amber time pill; one-score games get the floating lavender ring and a "by n" pill; tapping any row opens the game, with `syncFromHash` falling back to `S.yf` for finals already trimmed from the list), then the overview (scores, form guide, next 7 days). **Week**: last 7 days, top performances, then the next 30 days. **Recap**: the day's stories (soccer only when it's a final, World Cup, title decider or a followed side: `bigSoccer`), then the news feed.

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

Settings → "New card reveal" (Full show / Quick toast / Off, `sb-rv`) and "Card pack pop-ups" (On / Off, `sb-pk`). Off never loses anything: cards land in the log with a NEW badge and packs wait behind the gold dot.

## Data keys (localStorage)

`sb-tab`, `sb-pref`, `sb-followed`, `sb-fp` (people), `sb-pins`, `sb-theme`, `sb-cache` (last scores), `sb-tcache` (team pages), `sb-eager` (extra leagues to load), `sb-col` (Collection Log), `sb-profiles`, `sb-active`, `sb-lb`, `sb-hf` (last holiday burst), `sb-rv` / `sb-pk` (pop-up settings).

## Loading (`espn.js`)

`fetchScores` asks for one day per request: ESPN's team-sport scoreboards return nothing for a `dates=A-B` range (only the event sports honor ranges), so don't try to merge them. The saved-scores copy (`sb-cache`) is written when the browser is idle (`saveCache` → `flushCache`, also on `pagehide`), never while painting a refresh.
