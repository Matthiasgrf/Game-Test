import { useEffect, useMemo, useState } from "react";
import { supabase, type Group } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useAllowedGames } from "../games/catalog";

// Eine Bestenliste für alle Spiele mit Highscore (View game_highscores).
// Die Datenbank liefert nur Ergebnisse aus den eigenen Gruppen (RLS);
// die Listen sind je Gruppe, Spiel und Variante berechnet.
// Spiele ohne Highscore (highscore: null im Katalog) erscheinen hier nicht.

interface Row {
  id: number;
  game_key: string;
  variant: string;
  group_id: number;
  rank: number;
  username: string;
  points: number;
  max_points: number | null;
  seconds: number | null;
  created_at: string;
}

const date = (s: string) => new Date(s).toLocaleDateString("de-DE");
const time = (s: number | null) =>
  s === null ? "–" : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`;
const medal = (rank: number) => (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank);

export default function Highscores() {
  const { profile } = useAuth();
  const { games: allowed, error: gamesError } = useAllowedGames();
  const games = useMemo(() => allowed?.filter((g) => g.highscore) ?? null, [allowed]);
  const [tab, setTab] = useState<string | null>(null);
  const [variant, setVariant] = useState("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gameGroups, setGameGroups] = useState<{ game_key: string; group_id: number }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      // Eigene Gruppen (Admin: alle)
      let groupQuery = supabase.from("groups").select("id, name").order("name");
      if (profile.role !== "admin") {
        const { data: mine, error: e } = await supabase
          .from("user_groups").select("group_id").eq("user_id", profile.id);
        if (e) throw e;
        groupQuery = groupQuery.in("id", (mine ?? []).map((r) => r.group_id as number));
      }
      const [g, gg, hs] = await Promise.all([
        groupQuery,
        supabase.from("game_groups").select("game_key, group_id"),
        supabase.from("game_highscores").select("*").order("rank"),
      ]);
      const err = g.error ?? gg.error ?? hs.error;
      if (err) throw err;
      setGroups((g.data ?? []) as Group[]);
      setGameGroups((gg.data ?? []) as { game_key: string; group_id: number }[]);
      setRows((hs.data ?? []) as Row[]);
    })().catch((e) => setError((e as Error).message));
  }, [profile]);

  // Erstes Spiel mit Highscore vorauswählen
  useEffect(() => {
    if (games && !games.some((g) => g.key === tab)) setTab(games[0]?.key ?? null);
  }, [games, tab]);

  const game = games?.find((g) => g.key === tab) ?? null;
  const config = game?.highscore ?? null;

  // Erste Variante vorauswählen ('' = Spiel ohne Varianten)
  useEffect(() => {
    const ids = config?.variants?.map((v) => v.id) ?? [""];
    if (!ids.includes(variant)) setVariant(ids[0]);
  }, [config, variant]);

  // Gruppen, für die das gewählte Spiel freigegeben ist
  const tabGroups = useMemo(
    () => groups.filter((g) => gameGroups.some((gg) => gg.game_key === tab && gg.group_id === g.id)),
    [groups, gameGroups, tab],
  );
  useEffect(() => {
    if (!tabGroups.some((g) => g.id === groupId)) setGroupId(tabGroups[0]?.id ?? null);
  }, [tabGroups, groupId]);

  const err = error ?? gamesError;
  if (!games && !err) return <main className="card"><p className="muted">Lade…</p></main>;

  const shown = rows.filter((r) => r.game_key === tab && r.variant === variant && r.group_id === groupId);

  return (
    <main className="card">
      <h2>Highscores</h2>
      {err && <p className="error">{err}</p>}

      {games && games.length === 0 && (
        <p className="muted">Für deine Spiele gibt es noch keine Bestenlisten.</p>
      )}

      {games && games.length > 0 && (
        <div className="tabs">
          {games.map((g) => (
            <button key={g.key} className={tab === g.key ? "" : "secondary"} onClick={() => setTab(g.key)}>
              {g.emoji} {g.title}
            </button>
          ))}
        </div>
      )}

      {tab && tabGroups.length === 0 && (
        <p className="muted">Dieses Spiel ist keiner deiner Gruppen zugeordnet.</p>
      )}

      {tabGroups.length > 1 && (
        <div className="tabs small" aria-label="Gruppe">
          {tabGroups.map((g) => (
            <button key={g.id} className={groupId === g.id ? "" : "secondary"} onClick={() => setGroupId(g.id)}>
              👥 {g.name}
            </button>
          ))}
        </div>
      )}
      {tabGroups.length === 1 && <p className="muted">Gruppe: 👥 {tabGroups[0].name}</p>}

      {groupId !== null && config && (
        <>
          {config.variants && (
            <div className="tabs small">
              {config.variants.map((v) => (
                <button key={v.id} className={variant === v.id ? "" : "secondary"} onClick={() => setVariant(v.id)}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <p className="muted">{config.rule}</p>
          {shown.length === 0 ? (
            <p className="muted">Noch keine Ergebnisse.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Spieler</th><th>{config.pointsLabel}</th>
                  {config.showTime && <th>Zeit</th>}
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>{medal(r.rank)}</td>
                    <td>{r.username}</td>
                    <td>
                      {config.pointsIcon && `${config.pointsIcon} `}
                      {r.points}{r.max_points !== null && ` / ${r.max_points}`}
                    </td>
                    {config.showTime && <td>{time(r.seconds)}</td>}
                    <td>{date(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}
