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
| `sw.js` | Offline app shell + logo cache. Never caches ESPN data. |

## Shipping a change

1. Edit the files.
2. Bump `?v=75` → `?v=76` in `index.html` (all four URLs). Commit `index.html` last so no one loads a half-updated set.
3. Pages serves it within a minute. The service worker picks up the new version on the next open.

## Motion system

`style.css` defines the tokens every ordinary interaction uses:

```
--t1 110ms   taps, presses
--t2 200ms   colour / border / fade
--t3 320ms   sheets, the rail highlight, bigger moves
--ease       cubic-bezier(.2,.7,.2,1)
--spring     cubic-bezier(.34,1.4,.44,1)
```

Buttons, tabs, chips and sheets already get press feedback and transitions from the shared rules. Collapsible sections tween open and closed (`app.js`, "Collapsible sections"). Opening or leaving a game uses the View Transitions API where available. Everything respects `prefers-reduced-motion`. The fun layer's animations are independent and sit on top.

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

Rendering is cheap and stateless: every view is rebuilt from `S` by `render()`; async arrivals call `renderSoon()` so many in one frame become one render. Cards carry their game on `card._x`; one set of listeners on `#out` handles press-and-hold, prefetch and tooltips for all of them.

## Adding things

- **A league**: one line in `config.js`. `kind: "mma" | "race" | "golf"` makes it an event sport (cards and detail pages adapt).
- **A stat tooltip**: add to `TIPS` in `app.js` (`"ABBR": "meaning"`, or `"context:ABBR"` for sport-specific meanings).
- **A collection card / holiday**: `fun.js` (`HD`, `HOLS`, `HFX`). Card fields: `[id, category, rarity, emoji, name, description, hint]`; the description shows on every card, found or not (the hint is kept in data but no longer shown). The 100 famous moments in `MOMS` carry full write-ups, and the card goes into `story` layout when the text runs long.
- **A detail section**: build it in `renderDetail` / `renderEvent` with `sec(title, node, open)`.

## Settings (`PREF` in `app.js`)

Defaults live in the `PREF` object; whatever the person changes is saved under `sb-pref`. Add a key there, a `segRow` in `renderSettings`, and read `PREF.key` where it matters. Current keys: `tab0` (start tab), `compact`, `logos`, `text`, `upwin` (how far ahead lists go), `alerts`, `notify` (final-score notifications), `hideL` (leagues hidden from All), `h24`, `haptic`, `splash`.

## Find a game and the portal

`openFind()` in `app.js` builds a full-screen type-ahead over every loaded game (`hay(x)` is the searchable text). Picking a result calls `portal(card, x)`: the card spirals into a vortex (`.portal`, `.hole`, `.pghost` in `style.css`), the game opens with the View Transition skipped (`NOVT`), and `#out.emerge` scales the page out of the hole.

## Yesterday tab layout

Three sub-tabs. **Yesterday**: your teams' results, the quick Scoreboard (`quickScores`: every big-four final from yesterday plus college football games with a ranked team, ordered by `qsHeat`: your teams, upsets, overtime, one-score finishes, ranked matchups; primetime games (6:30pm local or later) get the solid slate frame, corner notch and a slate time pill; one-score games get the floating lavender ring and a "by n" pill; tapping any row opens the game, with `syncFromHash` falling back to `S.yf` for finals already trimmed from the list), then the overview (scores, form guide, next 7 days). **Week**: last 7 days, top performances, then the next 30 days. **Recap**: the day's stories (soccer only when it's a final, World Cup, title decider or a followed side: `bigSoccer`), then the news feed.

## Week (Yesterday → Week)

Last seven days of results for followed teams, then "Top performances": the best leader line per category across those games (`weekPerf` in `app.js`, one cached box score per game via `ESPN.fetchGame`, filtered to the followed side by abbreviation). The month ahead lives under Tomorrow.

## Tomorrow (Yesterday → Tomorrow)

`renderTomorrow` in `app.js` summarizes the next 30 days for followed teams from the schedules already saved on the phone (`sb-tcache`): counts, home/away, busiest day, longest gap, a 30-day strip per team, followed-vs-followed games, then the agenda a week at a time. No extra requests.

## Live watch

A live game's page opens with `livePanel` (`app.js`): the status with a pulsing dot, the current win probability and its direction, and per sport the live situation ESPN sends with the scoreboard (`g.q`, normalized in `espn.js`): a virtual field for football (ball spot from `possessionText`, drive direction, down and distance, red zone, timeouts) and a diamond with outs and the count for baseball, plus the last play. Cells in "By period" and "Team stats" that changed since the previous render pulse (`flashCells`), and so does a new top entry in Plays. While a live game is open the app polls every 20s.

## Shared links

Settings → "Copy share link" makes `?add=<base64 {t:[teams], p:[people]}>`. On load, `app.js` offers to add whatever in the link isn't followed yet, then cleans the URL.

## Card packs

Hidden meters in `sb-col` (`cr` regular credits, `hc` holiday credits, `pk` packs owed, `hk` holiday packs owed as holiday keys, `ld` last daily top-up, `ue` usage earned today). `COST` is 100: the daily top-up is one pack, and ordinary use (1 per tap, 3 per arrival, capped at 100 a day) earns about one more. The holiday meter fills at the same time whenever a holiday window is on and pays out a pack from that holiday's cards. `drawPack` is flat: every card in the pool has the same rarity odds whether you own it or not, and duplicates show as a ×n count in the Collection Log. Cards are granted the moment a pack opens, so skipping never loses anything. Entry points: the pop-up when a pack is earned, the "Open pack" button in the profile, and the gold dot on the profile button.

## Fun layer frequency

`fun.js`: `TAPP` is the per-tap card chance; `holidayFx` runs once a day (first arrival, `sb-hf` remembers the day) with a small burst; win/loss effects play on at most one card per arrival about half the time; the rarer ambient effects (ball, seasonal, gold, cameo) sit under 4% combined.

## Splash

Inline in `index.html` (markup, CSS and a few lines of script) so it paints before anything else loads. One second, then it fades over the already-rendered app. Skipped on deep links, when the Splash setting is off, and shortened under reduced motion.

## Account stats

Profile → Stats (`vStats` in `profile.js`). Counters live in `sb-col`: `d` (last 60 visit days), `d0` first day, `dn` total days opened, `ls` longest streak, `po` packs opened, `gv` games opened, `tp` taps. Profile age comes from the profile's `c` timestamp.

## Pop-ups

Settings → "New card reveal" (Full show / Quick toast / Off, `sb-rv`) and "Card pack pop-ups" (On / Off, `sb-pk`). Off never loses anything: cards land in the log with a NEW badge and packs wait behind the gold dot.

## Data keys (localStorage)

`sb-tab`, `sb-pref`, `sb-followed`, `sb-fp` (people), `sb-pins`, `sb-theme`, `sb-cache` (last scores), `sb-tcache` (team pages), `sb-eager` (extra leagues to load), `sb-col` (Collection Log), `sb-profiles`, `sb-active`, `sb-lb`, `sb-hf` (last holiday burst), `sb-rv` / `sb-pk` (pop-up settings).
