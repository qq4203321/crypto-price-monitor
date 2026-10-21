import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const marketCoins = sqliteTable("market_coins", {
  coinId: text("coin_id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  currentPrice: real("current_price").notNull(),
  marketCapRank: integer("market_cap_rank"),
  marketCap: real("market_cap"),
  totalVolume: real("total_volume"),
  high24h: real("high_24h"),
  low24h: real("low_24h"),
  change1h: real("change_1h"),
  change24h: real("change_24h"),
  change7d: real("change_7d"),
  sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
});

export const monitorSettings = sqliteTable("monitor_settings", {
  id: integer("id").primaryKey(),
  threshold1h: real("threshold_1h").notNull().default(2),
  threshold24h: real("threshold_24h").notNull().default(5),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const watchlist = sqliteTable("watchlist", {
  coinId: text("coin_id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
