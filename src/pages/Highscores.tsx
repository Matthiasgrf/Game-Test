import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Row {
  id: number;
  username: string;
  attempts: number;
  created_at: string;
}

export default function Highscores() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("highscores")
      .select("*")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data as Row[]);
      });
  }, []);

  return (
    <main className="card">
      <h2>Highscores Zahlenraten – Top 10</h2>
      {error && <p className="error">{error}</p>}
      {rows.length === 0 && !error ? (
        <p className="muted">Noch keine Ergebnisse.</p>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Spieler</th><th>Versuche</th><th>Datum</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.username}</td>
                <td>{r.attempts}</td>
                <td>{new Date(r.created_at).toLocaleString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
