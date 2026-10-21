CREATE TABLE market_coins (
  coin_id TEXT PRIMARY KEY NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  current_price REAL NOT NULL,
  market_cap_rank INTEGER,
  market_cap REAL,
  total_volume REAL,
  high_24h REAL,
  low_24h REAL,
  change_1h REAL,
  change_24h REAL,
  change_7d REAL,
  source_updated_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE monitor_settings (
  id INTEGER PRIMARY KEY NOT NULL,
  threshold_1h REAL NOT NULL DEFAULT 2,
  threshold_24h REAL NOT NULL DEFAULT 5,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE watchlist (
  coin_id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
DROP TABLE entries;
