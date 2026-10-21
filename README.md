# Crypto Price Monitor

A small TypeScript web app for watching the crypto market in real time. It tracks the **top 50 cryptocurrencies by market cap** and flags the ones moving unusually hard, so you can spot momentum at a glance instead of scanning the whole market.

<!-- Screenshot: add one here, e.g. ![Crypto Price Monitor](docs/screenshot.png) -->

## Features

- **Top 50 by market cap** — live prices, market cap rank, 24h volume, 24h high/low, and 1h / 24h / 7d percentage changes (data from the public CoinGecko API, refreshed on a 60-second cache).
- **Anomaly alerts with adjustable thresholds** — set your own 1h and 24h price-change thresholds (defaults: 2% / 5%). Any coin whose absolute move meets or exceeds a threshold is flagged as an anomaly, ranked by severity, and counted in the dashboard header.
- **Search** — filter the list instantly by coin name or symbol.
- **Watchlist** — star the coins you care about and view them in a dedicated tab. Thresholds and the watchlist persist in a local SQLite database.
- **Stale-data fallback** — if the upstream API is briefly unreachable, the app keeps serving the last good snapshot instead of going blank.

## Tech stack

- **TypeScript** throughout (client + server)
- **Client:** React 19, TanStack Query, Tailwind CSS 4, Recharts
- **Server:** typed RPC actions validated with Zod, Drizzle ORM over SQLite
- **Runtime / tooling:** [Bun](https://bun.sh)

## Project layout

```
client/          React app (src/App.tsx is the whole UI)
server/          API actions (src/actions.ts) and DB schema (src/schema.ts)
drizzle/         SQLite migration SQL for the three tables
```

## Running locally

Prerequisites: [Bun](https://bun.sh) 1.3+.

```bash
bun install

# Type-check client and server
bun run typecheck

# Production build
bun run build          # = build:server + build:client
bun run build:server   # bundle server actions -> server/dist/actions.js
bun run build:client   # bundle the client -> client/dist
```

There is no separate `dev` script; during development the two `typecheck` / `build` commands above are the feedback loop.

> **Platform note:** this app was originally built on the Hatch "spaces" runtime, so the client/server glue (`createActionClient`, `defineAction`, the React `QueryClient`, etc.) comes from the `@hatch/space-sdk` package, and the database/actions host is provided by that runtime. The application logic — market fetching, anomaly scoring, settings and watchlist storage — is all in `server/src/` and `client/src/` and is straightforward to port to another host (e.g. a plain Bun/Hono server with the same Drizzle schema in `drizzle/`).

No API key is required: market data comes from CoinGecko's public endpoint.

## Data model

| Table             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `market_coins`    | Latest snapshot of the top-50 coins (replaced on each refresh) |
| `monitor_settings`| The single row of user thresholds (1h / 24h)                   |
| `watchlist`       | Starred coin ids                                               |

See `drizzle/0002_crypto_monitor_tables.sql` and `server/src/schema.ts`.

## License

[MIT](LICENSE)
