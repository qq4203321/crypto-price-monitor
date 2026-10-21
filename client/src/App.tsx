import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

type Dashboard = ApiResponse<typeof api, "getDashboard">;
type Coin = Dashboard["coins"][number];
type Tab = "anomaly" | "all" | "watch";

const DASHBOARD_KEY = ["dashboard"] as const;

function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg className={spinning ? "spin" : ""} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M14 4v6M4 17h2M10 17h10M10 14v6" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className={filled ? "filled" : ""} d="m12 3 2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 16.87l-5.44 2.86 1.04-6.05-4.4-4.29 6.08-.88L12 3Z" />
    </svg>
  );
}

function formatPrice(value: number) {
  if (value >= 1000) return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (value >= 1) return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

function formatCompact(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function Change({ value, label, emphasized = false }: { value: number | null; label: string; emphasized?: boolean }) {
  const direction = value == null ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <div className={`change ${direction} ${emphasized ? "emphasized" : ""}`} aria-label={`${label} ${value == null ? "暂无数据" : `${value.toFixed(2)}%`}`}>
      <span className="change-label">{label}</span>
      <strong>{value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`}</strong>
    </div>
  );
}

function CoinRow({ coin, threshold1h, threshold24h, onToggle, pending }: {
  coin: Coin;
  threshold1h: number;
  threshold24h: number;
  onToggle: (coin: Coin) => void;
  pending: boolean;
}) {
  const hot1h = coin.change_1h != null && Math.abs(coin.change_1h) >= threshold1h;
  const hot24h = coin.change_24h != null && Math.abs(coin.change_24h) >= threshold24h;
  return (
    <article className={`coin-row ${coin.is_anomaly ? "is-anomaly" : ""}`}>
      <div className="coin-main">
        <span className="rank">{coin.rank ? String(coin.rank).padStart(2, "0") : "—"}</span>
        <div className="coin-id">
          <div className="symbol-line">
            <strong>{coin.symbol}</strong>
            {coin.is_anomaly && <span className="pulse-dot" title="达到异动阈值" />}
          </div>
          <span>{coin.name}</span>
        </div>
        <div className="price-block">
          <strong>{formatPrice(coin.price)}</strong>
          <span>量 {formatCompact(coin.volume)}</span>
        </div>
        <button
          className={`star-button ${coin.watched ? "active" : ""}`}
          type="button"
          aria-label={coin.watched ? `取消关注 ${coin.name}` : `关注 ${coin.name}`}
          disabled={pending}
          onClick={() => onToggle(coin)}
        >
          <StarIcon filled={coin.watched} />
        </button>
      </div>
      <div className="coin-changes">
        <Change value={coin.change_1h} label="1小时" emphasized={hot1h} />
        <Change value={coin.change_24h} label="24小时" emphasized={hot24h} />
        <Change value={coin.change_7d} label="7天" />
      </div>
      <div className="range-line">
        <span>24h 低 {coin.low_24h == null ? "—" : formatPrice(coin.low_24h)}</span>
        <span>高 {coin.high_24h == null ? "—" : formatPrice(coin.high_24h)}</span>
        <span>市值 {formatCompact(coin.market_cap)}</span>
      </div>
    </article>
  );
}

function SettingsPanel({ data, onClose, onSave, saving }: {
  data: Dashboard;
  onClose: () => void;
  onSave: (oneHour: number, day: number) => void;
  saving: boolean;
}) {
  const [oneHour, setOneHour] = useState(String(data.threshold_1h));
  const [day, setDay] = useState(String(data.threshold_24h));
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed1h = Number(oneHour);
    const parsed24h = Number(day);
    if (Number.isFinite(parsed1h) && Number.isFinite(parsed24h)) onSave(parsed1h, parsed24h);
  }
  return (
    <section className="settings-panel" aria-label="异动阈值设置">
      <div className="panel-heading">
        <div>
          <h2>异动阈值</h2>
          <p>任一时间段达到阈值，就会进入异动列表。</p>
        </div>
        <button className="text-button" type="button" onClick={onClose}>收起</button>
      </div>
      <form onSubmit={submit}>
        <label>
          <span>1小时绝对涨跌</span>
          <span className="input-wrap"><input aria-label="1小时异动阈值" type="number" min="0.1" max="100" step="0.1" value={oneHour} onChange={(e) => setOneHour(e.target.value)} /><b>%</b></span>
        </label>
        <label>
          <span>24小时绝对涨跌</span>
          <span className="input-wrap"><input aria-label="24小时异动阈值" type="number" min="0.1" max="100" step="0.1" value={day} onChange={(e) => setDay(e.target.value)} /><b>%</b></span>
        </label>
        <button className="save-button" type="submit" disabled={saving}>{saving ? "保存中…" : "保存阈值"}</button>
      </form>
    </section>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("anomaly");
  const [search, setSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dashboard = useQuery({ queryKey: DASHBOARD_KEY, queryFn: () => api.getDashboard({}) });
  const refresh = useMutation({
    mutationFn: () => api.refreshMarket({}),
    onSuccess: (data) => queryClient.setQueryData(DASHBOARD_KEY, data),
  });
  const updateSettings = useMutation({
    mutationFn: ({ oneHour, day }: { oneHour: number; day: number }) => api.updateSettings({ threshold_1h: oneHour, threshold_24h: day }),
    onSuccess: (data) => { queryClient.setQueryData(DASHBOARD_KEY, data); setSettingsOpen(false); },
  });
  const toggleWatchlist = useMutation({
    mutationFn: (coin: Coin) => api.toggleWatchlist({ coin_id: coin.id, watched: !coin.watched }),
    onSuccess: (data) => queryClient.setQueryData(DASHBOARD_KEY, data),
  });

  const data = dashboard.data;
  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.coins
      .filter((coin) => tab === "all" || (tab === "anomaly" ? coin.is_anomaly : coin.watched))
      .filter((coin) => !needle || coin.name.toLowerCase().includes(needle) || coin.symbol.toLowerCase().includes(needle))
      .sort((a, b) => tab === "anomaly" ? b.severity - a.severity : (a.rank ?? 999) - (b.rank ?? 999));
  }, [data, search, tab]);

  const anomalyCount = data?.coins.filter((coin) => coin.is_anomaly).length ?? 0;
  const watchedCount = data?.coins.filter((coin) => coin.watched).length ?? 0;

  return (
    <div className="app-shell">
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <main>
        <header className="market-hero">
          <div className="hero-topline">
            <div className="profile-status">
              <div className="profile-avatar profile-avatar-placeholder" aria-hidden="true">₿</div>
              <div>
                <span className="market-status"><i /> 行情快照</span>
                <time className="current-time" dateTime={now.toISOString()}>
                  {now.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} {now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </time>
              </div>
            </div>
            <div className="hero-actions">
              <button className="icon-button" type="button" aria-label="刷新行情" disabled={refresh.isPending} onClick={() => refresh.mutate()}><RefreshIcon spinning={refresh.isPending} /></button>
              <button className={`icon-button ${settingsOpen ? "active" : ""}`} type="button" aria-label="设置异动阈值" onClick={() => setSettingsOpen((value) => !value)}><TuneIcon /></button>
            </div>
          </div>
          <div className="hero-number">
            <span className="big-number">{dashboard.isPending ? "—" : anomalyCount}</span>
            <div><h1>个币种正在异动</h1><p>扫描市值前 50 名 · USD</p></div>
          </div>
          {data && (
            <div className="snapshot-meta">
              <span>{data.fetched_at ? `更新于 ${new Date(data.fetched_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "尚未获取行情"}</span>
              <span>阈值 {data.threshold_1h}% / {data.threshold_24h}%</span>
            </div>
          )}
        </header>

        {data && settingsOpen && <SettingsPanel data={data} saving={updateSettings.isPending} onClose={() => setSettingsOpen(false)} onSave={(oneHour, day) => updateSettings.mutate({ oneHour, day })} />}

        {(data?.error || dashboard.error) && (
          <div className="error-strip" role="status">
            <span>{data?.error ?? "行情加载失败"}{data?.stale && data.coins.length > 0 ? "，当前显示缓存数据" : ""}</span>
            <button type="button" onClick={() => refresh.mutate()}>重试</button>
          </div>
        )}

        <section className="market-section" aria-label="币种行情">
          <div className="market-controls">
            <div className="tabs" role="tablist" aria-label="行情筛选">
              <button role="tab" aria-selected={tab === "anomaly"} onClick={() => setTab("anomaly")}>异动 <span>{anomalyCount}</span></button>
              <button role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>全部 <span>{data?.coins.length ?? 0}</span></button>
              <button role="tab" aria-selected={tab === "watch"} onClick={() => setTab("watch")}>关注 <span>{watchedCount}</span></button>
            </div>
            <label className="search-box">
              <span className="sr-only">搜索币种</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
              <input aria-label="搜索币种" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索币种" />
            </label>
          </div>

          {dashboard.isPending ? (
            <div className="loading-state"><div className="scanner-line" /><p>正在扫描市场…</p></div>
          ) : filtered.length > 0 && data ? (
            <div className="coin-list">
              {filtered.map((coin) => <CoinRow key={coin.id} coin={coin} threshold1h={data.threshold_1h} threshold24h={data.threshold_24h} pending={toggleWatchlist.isPending} onToggle={(selected) => toggleWatchlist.mutate(selected)} />)}
            </div>
          ) : (
            <div className="empty-state">
              <strong>{tab === "watch" ? "还没有关注币种" : tab === "anomaly" ? "当前没有币种越过阈值" : "没有匹配的币种"}</strong>
              <p>{tab === "watch" ? "在全部行情里点星标，即可集中查看。" : tab === "anomaly" ? "可以降低阈值，或稍后刷新行情。" : "换个名称或交易代码试试。"}</p>
              {tab !== "all" && <button type="button" onClick={() => setTab("all")}>查看全部行情</button>}
            </div>
          )}
        </section>

        <footer>
          <a href={data?.source_url} target="_blank" rel="noreferrer">数据源 CoinGecko</a>
          <span>价格仅供行情观察，不构成投资建议</span>
        </footer>
      </main>
    </div>
  );
}
