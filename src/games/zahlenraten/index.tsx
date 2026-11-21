import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

// Die Geheimzahl kennt nur die Datenbank (Highscores lassen sich so nicht fälschen).
// Siehe supabase/migrations/20261122000000_highscores_absichern.sql:
//   zahlenraten_start()            -> angefangene Runde fortsetzen oder neue starten
//   zahlenraten_raten(runde, tipp) -> "zu_klein" | "zu_gross" | "richtig";
//                                     bei Treffer speichert die Datenbank das Ergebnis selbst.
interface Runde {
  runde: number;
  versuche: number;
}
interface Antwort {
  ergebnis: "zu_klein" | "zu_gross" | "richtig";
  versuche: number;
}

export default function NumberGuess() {
  const [runde, setRunde] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("Einen Moment…");
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showRunde = (r: Runde, neu: boolean) => {
    setRunde(r.runde);
    setAttempts(r.versuche);
    setWon(false);
    setHint(
      r.versuche > 0
        ? "Deine Runde geht weiter. Zahl zwischen 1 und 100."
        : neu
          ? "Neue Runde! Zahl zwischen 1 und 100."
          : "Ich denke mir eine Zahl zwischen 1 und 100.",
    );
  };

  useEffect(() => {
    let ignore = false;
    supabase.rpc("zahlenraten_start").then(({ data, error }) => {
      if (ignore) return;
      if (error) setError(`Spiel konnte nicht starten: ${error.message}`);
      else showRunde(data as Runde, false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const restart = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("zahlenraten_start");
    setBusy(false);
    if (error) setError(`Spiel konnte nicht starten: ${error.message}`);
    else showRunde(data as Runde, true);
  };

  const onGuess = async (e: FormEvent) => {
    e.preventDefault();
    if (runde === null || busy) return;
    const n = Number(guess);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setHint("Bitte eine ganze Zahl von 1 bis 100 eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("zahlenraten_raten", { p_runde: runde, p_tipp: n });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const a = data as Antwort;
    setAttempts(a.versuche);
    setGuess("");
    if (a.ergebnis === "zu_klein") setHint(`${n} ist zu klein.`);
    else if (a.ergebnis === "zu_gross") setHint(`${n} ist zu groß.`);
    else {
      setHint(`Richtig! ${n} in ${a.versuche} Versuchen.`);
      setWon(true);
    }
  };

  return (
    <main className="card">
      <Link to="/" className="back-link">🏠 Alle Spiele</Link>
      <h2>Zahlenraten</h2>
      <p className="hint" data-testid="hint">{hint}</p>
      <p className="muted">Versuche: {attempts}</p>
      {error && <p className="error">{error}</p>}
      {won ? (
        <>
          <p>Score gespeichert ✔</p>
          <button onClick={restart} disabled={busy}>Nochmal spielen</button>
        </>
      ) : (
        <form onSubmit={onGuess} className="row">
          <input
            type="number"
            min={1}
            max={100}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            aria-label="Dein Tipp"
            disabled={runde === null}
            autoFocus
          />
          <button disabled={runde === null || busy}>Raten</button>
        </form>
      )}
    </main>
  );
}
