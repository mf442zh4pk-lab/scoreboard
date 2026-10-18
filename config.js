// Settings you are most likely to change. Edit this file, commit, done.
window.CONFIG = {
  title: "Mack's Scoreboard",
  timezone: "America/New_York",       // used for "yesterday" and day boundaries
  liveRefreshSeconds: 60,             // auto-refresh interval while a game is live
  daysAhead: 3,                       // how many upcoming days to load
  // Teams you follow (exact ESPN names). They get the purple highlight and show first.
  followed: [
    "New England Patriots",
    "Boston Celtics",
    "Boston Bruins",
    "Boston Red Sox",
  ],
  // Followed teams with no data feed yet (listed in the footer note only).
  noFeed: ["Brisbane Lions"],
  // Leagues shown as tabs. path comes from ESPN: sport/league.
  leagues: [
    { key: "nfl", label: "NFL", path: "football/nfl" },
    { key: "nba", label: "NBA", path: "basketball/nba" },
    { key: "nhl", label: "NHL", path: "hockey/nhl" },
    { key: "mlb", label: "MLB", path: "baseball/mlb" },
    { key: "ncaafb", label: "College FB", path: "football/college-football" },
    { key: "epl", label: "Premier League", path: "soccer/eng.1", soccer: true },
    { key: "ucl", label: "Champions League", path: "soccer/uefa.champions", soccer: true },
  ],
};
