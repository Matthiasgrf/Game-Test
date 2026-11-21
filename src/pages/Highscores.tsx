import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Row {
  id: number;
  username: string;
  created_at: string;
  attempts?: number;
  time_ms?: number;
}

function Board({ view, title, col, unit, format }: {
  view: string;
  title: string;
  col: string;
  unit: string;
  format: (r: Row) => string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from(view)
      .select("*")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data as Row[]);
      });
  }, [view]);

  return (
    <section>
      <h2>{title}</h2>
      {error && <p className="error">{error}</p>}
      {rows.length === 0 && !error ? (
        <p className="muted">Noch keine Ergebnisse.</p>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Spieler</th><th>{col}</th><th>Datum</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.username}</td>
                <td>{format(r)} {unit}</td>
                <td>{new Date(r.created_at).toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function Highscores() {
  return (
    <main className="card">
      <Board
        view="rohr_highscores"
        title="💩 Rohr-Flitzer – Top 10"
        col="Zeit"
        unit="s"
        format={(r) => ((r.time_ms ?? 0) / 1000).toFixed(2)}
      />
      <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "24px 0" }} />
      <Board
        view="highscores"
        title="Zahlenraten – Top 10"
        col="Versuche"
        unit=""
        format={(r) => String(r.attempts)}
      />
    </main>
  );
}
