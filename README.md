# Scoreboard

Live scores for my teams. Static site, no build step, data straight from ESPN's public API.

| File | What to change |
|---|---|
| config.js | Followed teams, leagues, refresh timing, timezone |
| style.css | Colors (tokens at the top), spacing, fonts |
| espn.js | ESPN fetching and box-score parsing (only touch if ESPN changes) |
| app.js | Tabs, cards, detail page layout and section order |

After editing, bump the ?v= numbers in index.html so phones skip their cache. GitHub Pages rebuilds in about a minute.
