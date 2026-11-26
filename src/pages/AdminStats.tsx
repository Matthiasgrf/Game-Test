import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { GAMES } from "../games/catalog";
import AdminTabs from "./AdminTabs";

// Admin-Dashboard: Nutzungsstatistik der Spiele und der Spieler.
// Alle Zahlen liefert die Datenbankfunktion admin_stats (Migration 20261121220000_nutzungsstatistik.sql).
// Aktivität = Spielstart (game_plays) oder gespeichertes Ergebnis (game_scores).

interface Daily { day: string; users: number; plays: number; scores: number; minutes: number }
interface GameStat {
  game_key: string; highscore: string; plays: number; plays_prev: number; players: number; scores: number;
  play_seconds: number; short_plays: number; last_played: string | null; eligible: number;
}
interface GroupStat { name: string; members: number; active: number; plays: number; play_seconds: number; games: number }
interface UserStat {
  username: string; role: string; created_at: string; last_sign_in_at: string | null; last_active: string | null;
  plays: number; play_seconds: number; scores: number; active_days: number; games: number;
  top_game: string | null; groups: string[];
}
interface Stats {
  generated_at: string;
  period_days: number;
  tracking_since: string | null;
  users: {
    total: number; new_in_period: number; active_today: number; active_7d: number; active_30d: number;
    active_period: number; active_prev: number; login_7d: number; never_played: number; without_group: number;
  };
  totals: {
    plays: number; plays_prev: number; scores: number; scores_prev: number; play_seconds: number;
    play_seconds_prev: number; short_plays: number; games_played: number; games_total: number;
  };
  daily: Daily[];
  hours: { hour: number; count: number }[];
  weekdays: { dow: number; count: number }[];
  games: GameStat[];
  groups: GroupStat[];
  user_list: UserStat[];
}
// Detail-Auswertung (Migration 20261126120000_statistik_details.sql)
interface PairStat {
  username: string; game_key: string; plays: number; play_seconds: number; short_plays: number; scores: number;
  active_days: number; first_played: string; last_played: string;
}
interface Session { username: string; game_key: string; started_at: string; secs: number }
interface Detail { generated_at: string; period_days: number; pairs: PairStat[]; sessions: Session[] }

const PERIODS = [
  { days: 7, label: "7 Tage" },
  { days: 30, label: "30 Tage" },
  { days: 90, label: "90 Tage" },
];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const INACTIVE_DAYS = 14;

const GAME_BY_KEY = new Map(GAMES.map((g) => [g.key, g]));
const gameLabel = (key: string | null) => {
  if (!key) return "–";
  const g = GAME_BY_KEY.get(key);
  return g ? `${g.emoji} ${g.title}` : key;
};

// ---------- Formatierung ------------------------------------------------
const nf = new Intl.NumberFormat("de-DE");
const num = (n: number) => nf.format(n);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "–");

function duration(secs: number) {
  if (secs < 60) return `${Math.round(secs)} s`;
  const min = Math.round(secs / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

function daysAgo(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(new Date()) - start(d)) / 86_400_000);
}

function relative(iso: string | null) {
  if (!iso) return "nie";
  const n = daysAgo(iso);
  const time = new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (n <= 0) return `heute ${time}`;
  if (n === 1) return `gestern ${time}`;
  if (n < 14) return `vor ${n} Tagen`;
  return new Date(iso).toLocaleDateString("de-DE");
}

const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });

// ---------- Bausteine ---------------------------------------------------
function Trend({ now, prev, show }: { now: number; prev: number; show: boolean }) {
  if (!show) return null;
  if (prev === 0) return <span className="trend muted">{now > 0 ? "neu im Zeitraum" : "–"}</span>;
  const change = Math.round(((now - prev) / prev) * 100);
  const cls = change > 0 ? "trend up" : change < 0 ? "trend down" : "trend muted";
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "■";
  return <span className={cls}>{arrow} {change > 0 ? "+" : ""}{change} % ggü. Vorzeitraum</span>;
}

function Kpi({ label, value, sub, children, hint }: {
  label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode; hint?: string;
}) {
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub muted">{sub}</div>}
      {children}
    </div>
  );
}

/** Säulendiagramm mit einer Reihe; Wert erscheint beim Zeigen/Tippen auf eine Säule. */
function Bars({ data, label, format = num, every = 1 }: {
  data: { key: string; label: string; tip: string; value: number }[];
  label: string;
  format?: (n: number) => string;
  every?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="bars" aria-label={label}>
      <figcaption>
        <span>{label}</span>
        <span className="muted">
          {h ? <><strong className="bars-tip">{format(h.value)}</strong> · {h.tip}</> : <>max. {format(max === 1 && total === 0 ? 0 : max)}</>}
        </span>
      </figcaption>
      <div className="bars-plot" onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <button
            type="button"
            key={d.key}
            className={hover === i ? "bar-slot on" : "bar-slot"}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onClick={() => setHover(i)}
            aria-label={`${d.tip}: ${format(d.value)}`}
          >
            <span className="bar" style={{ height: `${(d.value / max) * 100}%` }} data-zero={d.value === 0 || undefined} />
          </button>
        ))}
      </div>
      <div className="bars-axis">
        {data.map((d, i) => (
          <span key={d.key}>{i % every === 0 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

type SortDir = 1 | -1;
function useSort<T>(rows: T[], initial: keyof T, dir: SortDir = -1) {
  const [sort, setSort] = useState<{ key: keyof T; dir: SortDir }>({ key: initial, dir });
  const sorted = useMemo(() => {
    const val = (r: T) => {
      const v = r[sort.key] as unknown;
      return v === null || v === undefined ? null : typeof v === "string" ? v.toLowerCase() : (v as number);
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * sort.dir;
    });
  }, [rows, sort]);
  const th = (key: keyof T, text: string, numeric = false) => (
    <th
      className={numeric ? "num sortable" : "sortable"}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as SortDir) : numeric ? -1 : 1 }))}
      >
        {text}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  return { sorted, th };
}

// ---------- Seite -------------------------------------------------------
type DailyMetric = "users" | "plays" | "minutes" | "scores";
const DAILY_METRICS: { key: DailyMetric; label: string }[] = [
  { key: "users", label: "Aktive Spieler" },
  { key: "plays", label: "Spielstarts" },
  { key: "minutes", label: "Spielminuten" },
  { key: "scores", label: "Ergebnisse" },
];

export default function AdminStats() {
  const [days, setDays] = useState(30);
  const [withAdmins, setWithAdmins] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<DailyMetric>("users");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const args = { p_days: days, p_include_admins: withAdmins };
    const [main, det] = await Promise.all([
      supabase.rpc("admin_stats", args),
      supabase.rpc("admin_stats_detail", args),
    ]);
    if (main.error) setError(main.error.message);
    else setStats(main.data as Stats);
    if (det.error) { setDetailError(det.error.message); setDetail(null); }
    else { setDetailError(null); setDetail(det.data as Detail); }
    setLoading(false);
  }, [days, withAdmins]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="card wide">
      <AdminTabs />
      <div className="stats-head">
        <h2>Nutzungsstatistik</h2>
        <div className="stats-controls">
          <div className="tabs small" role="group" aria-label="Zeitraum">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                className={p.days === days ? "" : "secondary"}
                aria-pressed={p.days === days}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={withAdmins} onChange={(e) => setWithAdmins(e.target.checked)} />
            Admins mitzählen
          </label>
          <button type="button" className="secondary" onClick={load} disabled={loading}>
            {loading ? "Lade…" : "↻ Aktualisieren"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!stats && !error && <p className="muted">Lade…</p>}
      {stats && <Dashboard stats={stats} metric={metric} setMetric={setMetric} />}
      {stats && <DetailSection detail={detail} error={detailError} days={stats.period_days} />}
    </main>
  );
}

function Dashboard({ stats, metric, setMetric }: {
  stats: Stats; metric: DailyMetric; setMetric: (m: DailyMetric) => void;
}) {
  const { users: u, totals: t, period_days: days } = stats;
  const trackingStart = stats.tracking_since ? new Date(stats.tracking_since) : null;
  // Vergleich mit dem Vorzeitraum nur, wenn die Messung der Spielstarts den ganzen Vorzeitraum abdeckt
  const prevFrom = new Date(stats.daily[0]?.day + "T00:00:00");
  prevFrom.setDate(prevFrom.getDate() - days);
  const fullPrevPlays = !!trackingStart && trackingStart <= prevFrom;

  const avgDaily = stats.daily.reduce((s, d) => s + d.users, 0) / Math.max(1, stats.daily.length);
  const avgPlaySecs = t.plays > 0 ? t.play_seconds / t.plays : 0;

  const gameRows = useMemo(() => stats.games.map((g) => ({
    ...g,
    title: gameLabel(g.game_key),
    reach: g.eligible > 0 ? g.players / g.eligible : null,
    avg_seconds: g.plays > 0 ? g.play_seconds / g.plays : null,
    short_rate: g.plays > 0 ? g.short_plays / g.plays : null,
  })), [stats.games]);
  const games = useSort(gameRows, "plays");
  const maxPlays = Math.max(1, ...gameRows.map((g) => g.plays));
  const unplayed = gameRows.filter((g) => g.players === 0 && g.eligible > 0);
  const unreleased = gameRows.filter((g) => g.eligible === 0);

  const userRows = useMemo(() => stats.user_list.map((x) => ({ ...x, groupText: x.groups.join(", ") })), [stats.user_list]);
  const users = useSort(userRows, "last_active");
  const neverPlayed = userRows.filter((x) => !x.last_active);
  const inactive = userRows.filter((x) => x.last_active && daysAgo(x.last_active) >= INACTIVE_DAYS);
  const noGroup = userRows.filter((x) => x.groups.length === 0 && x.role === "user");

  const groupRows = useMemo(() => stats.groups.map((g) => ({ ...g, rate: g.members > 0 ? g.active / g.members : null })), [stats.groups]);
  const groups = useSort(groupRows, "name", 1);

  const dailyEvery = days <= 7 ? 1 : days <= 30 ? 5 : 15;
  const metricLabel = DAILY_METRICS.find((m) => m.key === metric)!.label;

  return (
    <>
      <p className="muted small">
        Stand {relative(stats.generated_at)} · Zeitraum: letzte {days} Tage
        {trackingStart
          ? <> · Spielstarts und Spielzeit werden seit {trackingStart.toLocaleDateString("de-DE")} gemessen, Ergebnisse schon länger.</>
          : <> · Spielstarts und Spielzeit werden ab jetzt gemessen – bisher gibt es nur gespeicherte Ergebnisse.</>}
      </p>

      {/* ---------- Überblick ---------- */}
      <h3 className="stats-section">Überblick</h3>
      <div className="kpi-grid">
        <Kpi label="Aktive Spieler" value={num(u.active_period)} sub={`von ${num(u.total)} (${pct(u.active_period, u.total)})`}
          hint="Spieler mit mindestens einem Spielstart oder Ergebnis im Zeitraum">
          <Trend now={u.active_period} prev={u.active_prev} show />
        </Kpi>
        <Kpi label="Spielstarts" value={num(t.plays)} sub={`${num(t.games_played)} von ${num(t.games_total)} Spielen genutzt`}>
          <Trend now={t.plays} prev={t.plays_prev} show={fullPrevPlays} />
        </Kpi>
        <Kpi label="Spielzeit gesamt" value={duration(t.play_seconds)} sub={`Ø ${duration(avgPlaySecs)} pro Start`}
          hint="Zeit, in der ein Spiel sichtbar geöffnet war (höchstens 3 h je Start)">
          <Trend now={t.play_seconds} prev={t.play_seconds_prev} show={fullPrevPlays} />
        </Kpi>
        <Kpi label="Ergebnisse" value={num(t.scores)} sub={t.plays > 0 ? `${(t.scores / t.plays).toFixed(1).replace(".", ",")} je Start` : "beendete Runden"}
          hint="Gespeicherte Ergebnisse = zu Ende gespielte Runden (nur Spiele mit Highscore)">
          <Trend now={t.scores} prev={t.scores_prev} show />
        </Kpi>
        <Kpi label="Ø Spieler pro Tag" value={avgDaily.toFixed(1).replace(".", ",")}
          sub={`Bindung ${pct(avgDaily, u.active_period)}`}
          hint="Bindung = Ø aktive Spieler pro Tag ÷ aktive Spieler im Zeitraum. Hoch = Kinder kommen regelmäßig wieder." />
        <Kpi label="Kurzbesuche" value={pct(t.short_plays, t.plays)} sub={`${num(t.short_plays)} Starts unter 30 s`}
          hint="Spiel geöffnet und nach weniger als 30 Sekunden wieder verlassen – Hinweis auf zu schwer, falsch angeklickt oder langweilig" />
      </div>

      <div className="tabs small" role="group" aria-label="Kennzahl pro Tag">
        {DAILY_METRICS.map((m) => (
          <button key={m.key} type="button" className={m.key === metric ? "" : "secondary"}
            aria-pressed={m.key === metric} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <Bars
        label={`${metricLabel} pro Tag`}
        every={dailyEvery}
        data={stats.daily.map((d) => ({
          key: d.day,
          label: new Date(`${d.day}T12:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }),
          tip: shortDay(d.day),
          value: d[metric],
        }))}
      />

      {/* ---------- Spieler ---------- */}
      <h3 className="stats-section">Spieler</h3>
      <div className="kpi-grid">
        <Kpi label="Spieler gesamt" value={num(u.total)} sub={`${num(u.new_in_period)} neu im Zeitraum`} />
        <Kpi label="Heute aktiv" value={num(u.active_today)} sub={pct(u.active_today, u.total)} />
        <Kpi label="Aktiv 7 Tage" value={num(u.active_7d)} sub={pct(u.active_7d, u.total)} />
        <Kpi label="Aktiv 30 Tage" value={num(u.active_30d)} sub={pct(u.active_30d, u.total)} />
        <Kpi label="Login 7 Tage" value={num(u.login_7d)} sub="mit Passwort angemeldet" />
        <Kpi label="Noch nie gespielt" value={num(u.never_played)} sub={`${num(u.without_group)} ohne Gruppe`} />
      </div>

      {(neverPlayed.length > 0 || inactive.length > 0 || noGroup.length > 0) && (
        <div className="attention">
          <strong>Brauchen Aufmerksamkeit</strong>
          {noGroup.length > 0 && <p>🚫 Ohne Gruppe (sehen keine Spiele): {noGroup.map((x) => x.username).join(", ")}</p>}
          {neverPlayed.length > 0 && <p>💤 Noch nie gespielt: {neverPlayed.map((x) => x.username).join(", ")}</p>}
          {inactive.length > 0 && (
            <p>⏳ Seit über {INACTIVE_DAYS} Tagen nicht gespielt: {inactive.map((x) => `${x.username} (${relative(x.last_active)})`).join(", ")}</p>
          )}
        </div>
      )}

      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              {users.th("username", "Spieler")}
              {users.th("groupText", "Gruppen")}
              {users.th("last_active", "Zuletzt gespielt")}
              {users.th("last_sign_in_at", "Letzter Login")}
              {users.th("active_days", "Aktive Tage", true)}
              {users.th("plays", "Starts", true)}
              {users.th("play_seconds", "Spielzeit", true)}
              {users.th("scores", "Ergebnisse", true)}
              {users.th("games", "Spiele", true)}
              {users.th("top_game", "Lieblingsspiel")}
            </tr>
          </thead>
          <tbody>
            {users.sorted.map((x) => (
              <tr key={x.username}>
                <td>{x.username}{x.role === "admin" && <span className="badge">admin</span>}</td>
                <td className="muted">{x.groupText || "–"}</td>
                <td>{relative(x.last_active)}</td>
                <td className="muted">{relative(x.last_sign_in_at)}</td>
                <td className="num">{x.active_days} / {days}</td>
                <td className="num">{num(x.plays)}</td>
                <td className="num">{duration(x.play_seconds)}</td>
                <td className="num">{num(x.scores)}</td>
                <td className="num">{x.games}</td>
                <td>{gameLabel(x.top_game)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- Spiele ---------- */}
      <h3 className="stats-section">Spiele</h3>
      <p className="muted small">
        Reichweite = Spieler im Zeitraum ÷ Spieler, für deren Gruppe das Spiel freigegeben ist.
        Kurzbesuche = Starts unter 30 Sekunden.
      </p>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              {games.th("title", "Spiel")}
              {games.th("plays", "Starts", true)}
              {games.th("players", "Spieler", true)}
              {games.th("reach", "Reichweite", true)}
              {games.th("play_seconds", "Spielzeit", true)}
              {games.th("avg_seconds", "Ø pro Start", true)}
              {games.th("scores", "Ergebnisse", true)}
              {games.th("short_rate", "Kurzbesuche", true)}
              {games.th("last_played", "Zuletzt")}
            </tr>
          </thead>
          <tbody>
            {games.sorted.map((g) => (
              <tr key={g.game_key}>
                <td>{g.title}</td>
                <td className="num">
                  <span className="inline-bar" aria-hidden="true"><span style={{ width: `${(g.plays / maxPlays) * 100}%` }} /></span>
                  {num(g.plays)}
                </td>
                <td className="num">{num(g.players)}</td>
                <td className="num">{g.eligible > 0 ? `${pct(g.players, g.eligible)}` : <span className="muted">nicht freigegeben</span>}</td>
                <td className="num">{duration(g.play_seconds)}</td>
                <td className="num">{g.avg_seconds === null ? "–" : duration(g.avg_seconds)}</td>
                <td className="num">{g.highscore === "none" ? <span className="muted">–</span> : num(g.scores)}</td>
                <td className="num">{pct(g.short_plays, g.plays)}</td>
                <td>{relative(g.last_played)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(unplayed.length > 0 || unreleased.length > 0) && (
        <div className="attention">
          {unplayed.length > 0 && <p>💤 Freigegeben, aber im Zeitraum nicht gespielt: {unplayed.map((g) => g.title).join(", ")}</p>}
          {unreleased.length > 0 && <p>🔒 Für keine Gruppe mit Spielern freigegeben: {unreleased.map((g) => g.title).join(", ")}</p>}
        </div>
      )}

      {/* ---------- Wann ---------- */}
      <h3 className="stats-section">Wann wird gespielt?</h3>
      <p className="muted small">Aktivität = Spielstarts und Ergebnisse im Zeitraum, deutsche Zeit.</p>
      <div className="chart-pair">
        <Bars
          label="Nach Uhrzeit"
          every={3}
          data={stats.hours.map((h) => ({ key: String(h.hour), label: `${h.hour}`, tip: `${h.hour}–${h.hour + 1} Uhr`, value: h.count }))}
        />
        <Bars
          label="Nach Wochentag"
          data={stats.weekdays.map((w) => ({ key: String(w.dow), label: WEEKDAYS[w.dow - 1], tip: WEEKDAYS[w.dow - 1], value: w.count }))}
        />
      </div>

      {/* ---------- Gruppen ---------- */}
      <h3 className="stats-section">Gruppen</h3>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              {groups.th("name", "Gruppe")}
              {groups.th("members", "Mitglieder", true)}
              {groups.th("active", "Aktiv", true)}
              {groups.th("rate", "Aktiv-Quote", true)}
              {groups.th("plays", "Starts", true)}
              {groups.th("play_seconds", "Spielzeit", true)}
              {groups.th("games", "Spiele", true)}
            </tr>
          </thead>
          <tbody>
            {groups.sorted.map((g) => (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td className="num">{num(g.members)}</td>
                <td className="num">{num(g.active)}</td>
                <td className="num">{pct(g.active, g.members)}</td>
                <td className="num">{num(g.plays)}</td>
                <td className="num">{duration(g.play_seconds)}</td>
                <td className="num">{num(g.games)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Detail: Wer spielt was? ------------------------------------
type DetailView = "pairs" | "matrix" | "sessions";
const DETAIL_VIEWS: { key: DetailView; label: string }[] = [
  { key: "pairs", label: "Spieler × Spiel" },
  { key: "matrix", label: "Übersicht" },
  { key: "sessions", label: "Letzte Sitzungen" },
];

function dateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DetailSection({ detail, error, days }: { detail: Detail | null; error: string | null; days: number }) {
  const [view, setView] = useState<DetailView>("pairs");
  const [player, setPlayer] = useState("");
  const [game, setGame] = useState("");

  const pairs = detail?.pairs ?? [];
  const sessions = detail?.sessions ?? [];
  const players = useMemo(() => [...new Set(pairs.map((p) => p.username))].sort((a, b) => a.localeCompare(b, "de")), [pairs]);
  const gameKeys = useMemo(() => {
    const secs = new Map<string, number>();
    for (const p of pairs) secs.set(p.game_key, (secs.get(p.game_key) ?? 0) + p.play_seconds + p.plays + p.scores);
    return [...secs.keys()].sort((a, b) => secs.get(b)! - secs.get(a)! || a.localeCompare(b));
  }, [pairs]);

  const match = (x: { username: string; game_key: string }) =>
    (!player || x.username === player) && (!game || x.game_key === game);

  const pairRows = useMemo(() => pairs.filter(match).map((p) => ({
    ...p,
    title: gameLabel(p.game_key),
    avg_seconds: p.plays > 0 ? p.play_seconds / p.plays : null,
    short_rate: p.plays > 0 ? p.short_plays / p.plays : null,
  })), [pairs, player, game]);
  const pairSort = useSort(pairRows, "play_seconds");
  const maxSecs = Math.max(1, ...pairRows.map((p) => p.play_seconds));
  const sessionRows = sessions.filter(match);

  const sum = pairRows.reduce((a, p) => ({ plays: a.plays + p.plays, secs: a.secs + p.play_seconds, scores: a.scores + p.scores }),
    { plays: 0, secs: 0, scores: 0 });

  const pick = (u: string, g: string) => { setPlayer(u); setGame(g); setView("pairs"); };

  return (
    <section>
      <h3 className="stats-section">Wer spielt was?</h3>
      <p className="muted small">
        Jede Kombination aus Spieler und Spiel in den letzten {days} Tagen. Spielzeit = Zeit, in der das Spiel sichtbar
        geöffnet war (höchstens 3 h je Start). In der Übersicht auf ein Feld tippen, um die Details zu sehen.
      </p>
      {error && <p className="error">Detail-Auswertung nicht verfügbar: {error}</p>}
      {!detail && !error && <p className="muted">Lade…</p>}
      {detail && (
        <>
          <div className="stats-controls detail-controls">
            <div className="tabs small" role="group" aria-label="Ansicht">
              {DETAIL_VIEWS.map((v) => (
                <button key={v.key} type="button" className={v.key === view ? "" : "secondary"}
                  aria-pressed={v.key === view} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
            <select aria-label="Spieler" value={player} onChange={(e) => setPlayer(e.target.value)}>
              <option value="">Alle Spieler</option>
              {players.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select aria-label="Spiel" value={game} onChange={(e) => setGame(e.target.value)}>
              <option value="">Alle Spiele</option>
              {gameKeys.map((k) => <option key={k} value={k}>{gameLabel(k)}</option>)}
            </select>
            {(player || game) && (
              <button type="button" className="secondary" onClick={() => { setPlayer(""); setGame(""); }}>✕ Filter löschen</button>
            )}
          </div>

          {(player || game) && (
            <div className="kpi-grid">
              <Kpi label="Starts" value={num(sum.plays)} />
              <Kpi label="Spielzeit" value={duration(sum.secs)} sub={sum.plays > 0 ? `Ø ${duration(sum.secs / sum.plays)} pro Start` : undefined} />
              <Kpi label="Ergebnisse" value={num(sum.scores)} />
              <Kpi label={player ? "Verschiedene Spiele" : "Verschiedene Spieler"}
                value={num(new Set(pairRows.map((p) => (player ? p.game_key : p.username))).size)} />
            </div>
          )}

          {pairs.length === 0 && <p className="muted">Im Zeitraum wurde nicht gespielt.</p>}

          {pairs.length > 0 && view === "pairs" && (
            <div className="table-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    {pairSort.th("username", "Spieler")}
                    {pairSort.th("title", "Spiel")}
                    {pairSort.th("plays", "Starts", true)}
                    {pairSort.th("play_seconds", "Spielzeit", true)}
                    {pairSort.th("avg_seconds", "Ø pro Start", true)}
                    {pairSort.th("active_days", "Tage", true)}
                    {pairSort.th("scores", "Ergebnisse", true)}
                    {pairSort.th("short_rate", "Kurzbesuche", true)}
                    {pairSort.th("first_played", "Zuerst")}
                    {pairSort.th("last_played", "Zuletzt")}
                  </tr>
                </thead>
                <tbody>
                  {pairSort.sorted.map((p) => (
                    <tr key={`${p.username}|${p.game_key}`}>
                      <td>{p.username}</td>
                      <td>{p.title}</td>
                      <td className="num">{num(p.plays)}</td>
                      <td className="num">
                        <span className="inline-bar" aria-hidden="true"><span style={{ width: `${(p.play_seconds / maxSecs) * 100}%` }} /></span>
                        {duration(p.play_seconds)}
                      </td>
                      <td className="num">{p.avg_seconds === null ? "–" : duration(p.avg_seconds)}</td>
                      <td className="num">{p.active_days}</td>
                      <td className="num">{num(p.scores)}</td>
                      <td className="num">{pct(p.short_plays, p.plays)}</td>
                      <td className="muted">{relative(p.first_played)}</td>
                      <td>{relative(p.last_played)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pairs.length > 0 && view === "matrix" && (
            <Matrix pairs={pairs} players={player ? [player] : players} gameKeys={game ? [game] : gameKeys} onPick={pick} />
          )}

          {pairs.length > 0 && view === "sessions" && (
            <>
              <p className="muted small">
                Die neuesten {num(sessions.length)} Spielstarts im Zeitraum{(player || game) ? `, davon ${num(sessionRows.length)} passend zum Filter` : ""}.
              </p>
              <div className="table-scroll">
                <table className="stats-table">
                  <thead>
                    <tr><th>Gestartet</th><th>Spieler</th><th>Spiel</th><th className="num">Dauer</th></tr>
                  </thead>
                  <tbody>
                    {sessionRows.map((x, i) => (
                      <tr key={`${x.started_at}|${x.username}|${i}`}>
                        <td>{dateTime(x.started_at)}</td>
                        <td>{x.username}</td>
                        <td>{gameLabel(x.game_key)}</td>
                        <td className="num">{x.secs < 30 ? <span className="muted">{duration(x.secs)}</span> : duration(x.secs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Spieler (Zeilen) × Spiele (Spalten), Feld = Spielzeit, je dunkler desto länger. */
function Matrix({ pairs, players, gameKeys, onPick }: {
  pairs: PairStat[]; players: string[]; gameKeys: string[]; onPick: (username: string, gameKey: string) => void;
}) {
  const cell = new Map(pairs.map((p) => [`${p.username}|${p.game_key}`, p]));
  const max = Math.max(1, ...pairs.map((p) => p.play_seconds));
  const rowTotal = (u: string) => pairs.filter((p) => p.username === u).reduce((s, p) => s + p.play_seconds, 0);
  const rows = [...players].sort((a, b) => rowTotal(b) - rowTotal(a) || a.localeCompare(b, "de"));
  return (
    <div className="table-scroll">
      <table className="stats-table matrix">
        <thead>
          <tr>
            <th>Spieler</th>
            {gameKeys.map((k) => {
              const g = GAME_BY_KEY.get(k);
              return <th key={k} className="matrix-game" title={g?.title ?? k}>{g ? g.emoji : k}</th>;
            })}
            <th className="num">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u}>
              <td>{u}</td>
              {gameKeys.map((k) => {
                const p = cell.get(`${u}|${k}`);
                if (!p) return <td key={k} className="matrix-cell empty" />;
                const level = Math.max(0.12, Math.sqrt(p.play_seconds / max));
                const tip = `${u} · ${gameLabel(k)}: ${num(p.plays)} Starts, ${duration(p.play_seconds)}, ${num(p.scores)} Ergebnisse`;
                return (
                  <td key={k} className="matrix-cell">
                    <button type="button" title={tip} aria-label={tip} onClick={() => onPick(u, k)}
                      style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(level * 100)}%, transparent)` }}
                      className={level > 0.55 ? "strong" : undefined}>
                      {p.play_seconds >= 60 ? Math.round(p.play_seconds / 60) : p.plays > 0 ? "<1" : "✓"}
                    </button>
                  </td>
                );
              })}
              <td className="num">{duration(rowTotal(u))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Zahl im Feld = Spielminuten (✓ = nur Ergebnis gespeichert). Spiel-Namen beim Zeigen auf das Symbol.</p>
    </div>
  );
}
