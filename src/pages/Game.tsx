import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

// Die Geheimzahl liegt ausschliesslich in der Datenbank (Tabelle game_rounds,
// fuer den Client nicht lesbar). Der Browser ruft nur start_round() und
// guess() auf; der Score wird serverseitig eingetragen und ist so nicht faelschbar.
export default function Game() {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("Ich denke mir eine Zahl zwischen 1 und 100.");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async (text: string) => {
    setError(null);
    const { data, error } = await supabase.rpc("start_round");
    if (error) return setError(error.message);
    setRoundId(data as string);
    setAttempts(0);
    setDone(false);
    setHint(text);
  }, []);

  useEffect(() => { start("Ich denke mir eine Zahl zwischen 1 und 100."); }, [start]);

  const onGuess = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(guess);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setHint("Bitte eine ganze Zahl von 1 bis 100 eingeben.");
      return;
    }
    if (!roundId) return;
    setBusy(true);
    setGuess("");
    const { data, error } = await supabase.rpc("guess", { p_round: roundId, p_guess: n });
    setBusy(false);
    if (error) return setError(error.message);
    const { result, attempts: tries } = (data as { result: string; attempts: number }[])[0];
    setAttempts(tries);
    if (result === "low") setHint(`${n} ist zu klein.`);
    else if (result === "high") setHint(`${n} ist zu groß.`);
    else if (result === "correct") {
      setHint(`Richtig! ${n} in ${tries} Versuchen. Score gespeichert ✔`);
      setDone(true);
    } else {
      setHint("Maximale Anzahl Versuche erreicht.");
      setDone(true);
    }
  };

  return (
    <main className="card">
      <h2>Zahlenraten</h2>
      <p className="hint" data-testid="hint">{hint}</p>
      <p className="muted">Versuche: {attempts}</p>
      {error && <p className="error">{error}</p>}
      {done ? (
        <button onClick={() => start("Neue Runde! Zahl zwischen 1 und 100.")}>Nochmal spielen</button>
      ) : (
        <form onSubmit={onGuess} className="row">
          <input
            type="number"
            min={1}
            max={100}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            aria-label="Dein Tipp"
            autoFocus
          />
          <button disabled={busy || !roundId}>Raten</button>
        </form>
      )}
    </main>
  );
}
