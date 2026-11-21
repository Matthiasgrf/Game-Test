import { useEffect, useMemo, useState } from "react";
import { supabase, type Group } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useAllowedGames } from "../games/catalog";

// Die Datenbank liefert nur Ergebnisse aus den eigenen Gruppen (RLS);
// die Bestenlisten sind je Gruppe berechnet (Spalte group_id).

interface GuessRow {
  id: number;
  group_id: number;
  rank: number;
  username: string;
  attempts: number;
  created_at: string;
}

interface LabRow {
  id: number;
  group_id: number;
  mode: string;
  rank: number;
  username: string;
  stars: number;
  max_stars: number;
  seconds: number;
  created_at: string;
}

const LAB_MODES = [
  { id: "leicht", label: "🐣 Leicht" },
  { id: "mittel", label: "🦊 Mittel" },
  { id: "knifflig", label: "🦁 Knifflig" },
];

const date = (s: string) => new Date(s).toLocaleDateString("de-DE");
const time = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);
const medal = (rank: number) => (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank);

export default function Highscores() {
  const { profile } = useAuth();
  const { games, error: gamesError } = useAllowedGames();
  const [tab, setTab] = useState<string | null>(null);
  const [mode, setMode] = useState("leicht");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gameGroups, setGameGroups] = useState<{ game_key: string; group_id: number }[]>([]);
  const [guess, setGuess] = useState<GuessRow[]>([]);
  const [lab, setLab] = useState<LabRow[]>([]);
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
      const [g, gg, hs, lh] = await Promise.all([
        groupQuery,
        supabase.from("game_groups").select("game_key, group_id"),
        supabase.from("highscores").select("*").order("rank"),
        supabase.from("labyrinth_highscores").select("*").order("rank"),
      ]);
      const err = g.error ?? gg.error ?? hs.error ?? lh.error;
      if (err) throw err;
      setGroups((g.data ?? []) as Group[]);
      setGameGroups((gg.data ?? []) as { game_key: string; group_id: number }[]);
      setGuess((hs.data ?? []) as GuessRow[]);
      setLab((lh.data ?? []) as LabRow[]);
    })().catch((e) => setError((e as Error).message));
  }, [profile]);

  // Erstes erlaubtes Spiel vorauswählen
  useEffect(() => {
    if (games && !games.some((g) => g.key === tab)) setTab(games[0]?.key ?? null);
  }, [games, tab]);

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

  const labRows = lab.filter((r) => r.mode === mode && r.group_id === groupId);
  const guessRows = guess.filter((r) => r.group_id === groupId);

  return (
    <main className="card">
      <h2>Highscores</h2>
      {err && <p className="error">{err}</p>}

      {games && games.length === 0 && (
        <p className="muted">Für dich sind noch keine Spiele freigeschaltet – daher gibt es auch keine Highscores.</p>
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

      {groupId !== null && tab === "labyrinth" && (
        <>
          <div className="tabs small">
            {LAB_MODES.map((m) => (
              <button key={m.id} className={mode === m.id ? "" : "secondary"} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="muted">Bestes Ergebnis je Spieler: meiste Sterne, bei Gleichstand die schnellste Zeit.</p>
          {labRows.length === 0 ? (
            <p className="muted">Noch keine Ergebnisse auf dieser Stufe.</p>
          ) : (
            <table>
              <thead>
                <tr><th>#</th><th>Spieler</th><th>Sterne</th><th>Zeit</th><th>Datum</th></tr>
              </thead>
              <tbody>
                {labRows.map((r) => (
                  <tr key={r.id}>
                    <td>{medal(r.rank)}</td>
                    <td>{r.username}</td>
                    <td>⭐ {r.stars} / {r.max_stars}</td>
                    <td>{time(r.seconds)}</td>
                    <td>{date(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {groupId !== null && tab === "zahlenraten" && (
        guessRows.length === 0 ? (
          <p className="muted">Noch keine Ergebnisse.</p>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Spieler</th><th>Versuche</th><th>Datum</th></tr>
            </thead>
            <tbody>
              {guessRows.map((r) => (
                <tr key={r.id}>
                  <td>{medal(r.rank)}</td>
                  <td>{r.username}</td>
                  <td>{r.attempts}</td>
                  <td>{date(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </main>
  );
}
