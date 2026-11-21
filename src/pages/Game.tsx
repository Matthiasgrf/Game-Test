import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

// Die Geheimzahl kennt nur die Datenbank. Der Browser ruft zwei
// RPC-Funktionen auf (siehe supabase/migrations/20261121000000_server_side_game.sql):
//   start_game()        -> offene Runde fortsetzen oder neue starten
//   guess(game_id, n)   -> "low" | "high" | "correct"; bei Treffer speichert
//                          die Datenbank den Score selbst.
interface StartResult {
  game_id: number;
  attempts: number;
}
interface GuessResult {
  result: "low" | "high" | "correct";
  attempts: number;
}

export default function Game() {
  const [gameId, setGameId] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("Lade Runde…");
  const [won, setWon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyGame = (game: StartResult) => {
    setGameId(game.game_id);
    setAttempts(game.attempts);
    setWon(false);
    setHint(
      game.attempts > 0
        ? "Deine angefangene Runde geht weiter. Zahl zwischen 1 und 100."
        : "Ich denke mir eine Zahl zwischen 1 und 100.",
    );
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("start_game");
    setBusy(false);
    if (error) setError(`Runde konnte nicht gestartet werden: ${error.message}`);
    else applyGame(data as StartResult);
  };

  useEffect(() => {
    let ignore = false;
    supabase.rpc("start_game").then(({ data, error }) => {
      if (ignore) return;
      if (error) setError(`Runde konnte nicht gestartet werden: ${error.message}`);
      else applyGame(data as StartResult);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const onGuess = async (e: FormEvent) => {
    e.preventDefault();
    if (gameId === null || busy) return;
    const n = Number(guess);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setHint("Bitte eine ganze Zahl von 1 bis 100 eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("guess", { p_game_id: gameId, p_guess: n });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const res = data as GuessResult;
    setAttempts(res.attempts);
    setGuess("");
    if (res.result === "low") setHint(`${n} ist zu klein.`);
    else if (res.result === "high") setHint(`${n} ist zu groß.`);
    else {
      setHint(`Richtig! ${n} in ${res.attempts} Versuchen. Score gespeichert ✔`);
      setWon(true);
    }
  };

  return (
    <main className="card">
      <h2>Zahlenraten</h2>
      <p className="hint" data-testid="hint">{hint}</p>
      <p className="muted">Versuche: {attempts}</p>
      {error && <p className="error">{error}</p>}
      {won ? (
        <button onClick={start} disabled={busy}>Nochmal spielen</button>
      ) : (
        <form onSubmit={onGuess} className="row">
          <input
            type="number"
            min={1}
            max={100}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            aria-label="Dein Tipp"
            disabled={gameId === null}
            autoFocus
          />
          <button disabled={gameId === null || busy}>Raten</button>
        </form>
      )}
    </main>
  );
}
