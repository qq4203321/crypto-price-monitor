import { defineAction, z, type ActionsModule, type Ctx } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";

const SOURCE_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h%2C24h%2C7d";
const CACHE_MS = 60_000;

const upstreamCoin = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  current_price: z.number(),
  market_cap_rank: z.number().int().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  total_volume: z.number().nullable().optional(),
  high_24h: z.number().nullable().optional(),
  low_24h: z.number().nullable().optional(),
  price_change_percentage_1h_in_currency: z.number().nullable().optional(),
  price_change_percentage_24h_in_currency: z.number().nullable().optional(),
  price_change_percentage_7d_in_currency: z.number().nullable().optional(),
  last_updated: z.string(),
});

const coinResponse = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  rank: z.number().nullable(),
  market_cap: z.number().nullable(),
  volume: z.number().nullable(),
  high_24h: z.number().nullable(),
  low_24h: z.number().nullable(),
  change_1h: z.number().nullable(),
  change_24h: z.number().nullable(),
  change_7d: z.number().nullable(),
  updated_at: z.string(),
  watched: z.boolean(),
  is_anomaly: z.boolean(),
  severity: z.number(),
});

const dashboardResponse = z.object({
  coins: z.array(coinResponse),
  threshold_1h: z.number(),
  threshold_24h: z.number(),
  fetched_at: z.string().nullable(),
  stale: z.boolean(),
  error: z.string().nullable(),
  source_url: z.string(),
});

type Dashboard = z.infer<typeof dashboardResponse>;

type Settings = { threshold1h: number; threshold24h: number };

async function readSettings(ctx: Ctx): Promise<Settings> {
  const db = ctx.db<typeof schema>();
  const rows = await db.select().from(schema.monitorSettings).where(eq(schema.monitorSettings.id, 1)).limit(1);
  const current = rows[0];
  if (current) return { threshold1h: current.threshold1h, threshold24h: current.threshold24h };
  const now = new Date();
  await db.insert(schema.monitorSettings).values({ id: 1, threshold1h: 2, threshold24h: 5, updatedAt: now });
  return { threshold1h: 2, threshold24h: 5 };
}

async function readDashboard(ctx: Ctx, stale: boolean, error: string | null): Promise<Dashboard> {
  const db = ctx.db<typeof schema>();
  const [settings, rows, watchedRows] = await Promise.all([
    readSettings(ctx),
    db.select().from(schema.marketCoins).orderBy(asc(schema.marketCoins.marketCapRank)),
    db.select().from(schema.watchlist),
  ]);
  const watched = new Set(watchedRows.map((row) => row.coinId));
  const fetchedAt = rows[0]?.fetchedAt ?? null;
  const coins = rows.map((row) => {
    const severity1h = row.change1h == null ? 0 : Math.abs(row.change1h) / settings.threshold1h;
    const severity24h = row.change24h == null ? 0 : Math.abs(row.change24h) / settings.threshold24h;
    const severity = Math.max(severity1h, severity24h);
    return {
      id: row.coinId,
      symbol: row.symbol,
      name: row.name,
      price: row.currentPrice,
      rank: row.marketCapRank,
      market_cap: row.marketCap,
      volume: row.totalVolume,
      high_24h: row.high24h,
      low_24h: row.low24h,
      change_1h: row.change1h,
      change_24h: row.change24h,
      change_7d: row.change7d,
      updated_at: row.sourceUpdatedAt.toISOString(),
      watched: watched.has(row.coinId),
      is_anomaly: severity >= 1,
      severity,
    };
  });
  return {
    coins,
    threshold_1h: settings.threshold1h,
    threshold_24h: settings.threshold24h,
    fetched_at: fetchedAt?.toISOString() ?? null,
    stale,
    error,
    source_url: SOURCE_URL,
  };
}

async function fetchAndStore(ctx: Ctx): Promise<void> {
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const parsed = z.array(upstreamCoin).safeParse(await response.json());
  if (!parsed.success || parsed.data.length === 0) throw new Error("Source returned invalid data");
  const now = new Date();
  const values = parsed.data.map((coin) => ({
    coinId: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    currentPrice: coin.current_price,
    marketCapRank: coin.market_cap_rank ?? null,
    marketCap: coin.market_cap ?? null,
    totalVolume: coin.total_volume ?? null,
    high24h: coin.high_24h ?? null,
    low24h: coin.low_24h ?? null,
    change1h: coin.price_change_percentage_1h_in_currency ?? null,
    change24h: coin.price_change_percentage_24h_in_currency ?? null,
    change7d: coin.price_change_percentage_7d_in_currency ?? null,
    sourceUpdatedAt: new Date(coin.last_updated),
    fetchedAt: now,
  }));
  const db = ctx.db<typeof schema>();
  await db.delete(schema.marketCoins);
  await db.insert(schema.marketCoins).values(values);
}

async function loadDashboard(ctx: Ctx, force: boolean): Promise<Dashboard> {
  const db = ctx.db<typeof schema>();
  const latest = await db.select({ fetchedAt: schema.marketCoins.fetchedAt }).from(schema.marketCoins).limit(1);
  const fetchedAt = latest[0]?.fetchedAt;
  const needsRefresh = force || !fetchedAt || Date.now() - fetchedAt.getTime() > CACHE_MS;
  if (needsRefresh) {
    try {
      await fetchAndStore(ctx);
      return await readDashboard(ctx, false, null);
    } catch {
      const fallback = await readDashboard(ctx, true, "暂时无法获取最新行情，请稍后重试");
      return fallback;
    }
  }
  return await readDashboard(ctx, false, null);
}

export const Actions = {
  getDashboard: defineAction({
    request: z.object({}),
    response: dashboardResponse,
    handler: async (ctx): Promise<Dashboard> => loadDashboard(ctx, false),
  }),

  refreshMarket: defineAction({
    request: z.object({}),
    response: dashboardResponse,
    handler: async (ctx): Promise<Dashboard> => loadDashboard(ctx, true),
  }),

  updateSettings: defineAction({
    request: z.object({
      threshold_1h: z.number().min(0.1).max(100),
      threshold_24h: z.number().min(0.1).max(100),
    }),
    response: dashboardResponse,
    async handler(ctx, args): Promise<Dashboard> {
      const db = ctx.db<typeof schema>();
      await db.insert(schema.monitorSettings).values({
        id: 1,
        threshold1h: args.threshold_1h,
        threshold24h: args.threshold_24h,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: schema.monitorSettings.id,
        set: {
          threshold1h: args.threshold_1h,
          threshold24h: args.threshold_24h,
          updatedAt: new Date(),
        },
      });
      ctx.invalidateQueries();
      return await readDashboard(ctx, false, null);
    },
  }),

  toggleWatchlist: defineAction({
    request: z.object({ coin_id: z.string().min(1), watched: z.boolean() }),
    response: dashboardResponse,
    async handler(ctx, args): Promise<Dashboard> {
      const db = ctx.db<typeof schema>();
      if (args.watched) {
        await db.insert(schema.watchlist).values({ coinId: args.coin_id, createdAt: new Date() }).onConflictDoNothing();
      } else {
        await db.delete(schema.watchlist).where(eq(schema.watchlist.coinId, args.coin_id));
      }
      ctx.invalidateQueries();
      return await readDashboard(ctx, false, null);
    },
  }),
} satisfies ActionsModule;
