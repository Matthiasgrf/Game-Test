import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface GuessRow {
  id: number;
  username: string;
  attempts: number;
  created_at: string;
}

interface LabRow {
  id: number;
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

export default function Highscores() {
  const [tab, setTab] = useState<"labyrinth" | "zahlenraten">("labyrinth");
  const [mode, setMode] = useState("leicht");
  const [guess, setGuess] = useState<GuessRow[]>([]);
  const [lab, setLab] = useState<LabRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("highscores")
      .select("*")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setGuess(data as GuessRow[]);
      });
    supabase
      .from("labyrinth_highscores")
      .select("*")
      .order("rank")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setLab(data as LabRow[]);
      });
  }, []);

  const labRows = lab.filter((r) => r.mode === mode);

  return (
    <main className="card">
      <h2>Highscores</h2>
      <div className="tabs">
        <button className={tab === "labyrinth" ? "" : "secondary"} onClick={() => setTab("labyrinth")}>
          🐭 Labyrinth
        </button>
        <button className={tab === "zahlenraten" ? "" : "secondary"} onClick={() => setTab("zahlenraten")}>
          🔢 Zahlenraten
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {tab === "labyrinth" ? (
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
                    <td>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
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
      ) : guess.length === 0 ? (
        <p className="muted">Noch keine Ergebnisse.</p>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Spieler</th><th>Versuche</th><th>Datum</th></tr>
          </thead>
          <tbody>
            {guess.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.username}</td>
                <td>{r.attempts}</td>
                <td>{date(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
