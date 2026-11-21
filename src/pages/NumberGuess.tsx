import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { saveScore } from "../games/scores";

const newSecret = () => Math.floor(Math.random() * 100) + 1;

export default function NumberGuess() {
  const [secret, setSecret] = useState(newSecret);
  const [guess, setGuess] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("Ich denke mir eine Zahl zwischen 1 und 100.");
  const [won, setWon] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const onGuess = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(guess);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setHint("Bitte eine ganze Zahl von 1 bis 100 eingeben.");
      return;
    }
    const tries = attempts + 1;
    setAttempts(tries);
    setGuess("");
    if (n < secret) setHint(`${n} ist zu klein.`);
    else if (n > secret) setHint(`${n} ist zu groß.`);
    else {
      setHint(`Richtig! ${secret} in ${tries} Versuchen.`);
      setWon(true);
      const error = await saveScore("zahlenraten", { points: tries });
      setSaveMsg(error ? `Fehler beim Speichern: ${error}` : "Score gespeichert ✔");
    }
  };

  const restart = () => {
    setSecret(newSecret());
    setAttempts(0);
    setWon(false);
    setSaveMsg(null);
    setHint("Neue Runde! Zahl zwischen 1 und 100.");
  };

  return (
    <main className="card">
      <Link to="/" className="back-link">← Alle Spiele</Link>
      <h2>Zahlenraten</h2>
      <p className="hint" data-testid="hint">{hint}</p>
      <p className="muted">Versuche: {attempts}</p>
      {won ? (
        <>
          {saveMsg && <p>{saveMsg}</p>}
          <button onClick={restart}>Nochmal spielen</button>
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
            autoFocus
          />
          <button>Raten</button>
        </form>
      )}
    </main>
  );
}
