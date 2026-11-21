import { useRef, useState } from "react";
import { Link } from "react-router-dom";
// HIGHSCORE-START
import { saveScore } from "../scores";
// HIGHSCORE-ENDE

// Vorlage für ein React-Spiel in Game-Test: ein einfaches Quiz mit allem, was jedes Spiel braucht –
// Start-, Spiel- und Gewinn-Bildschirm, Link „Alle Spiele“, Fortschritt, freundliches Feedback,
// große Knöpfe für Touch und (bei Spielen mit Highscore) Ergebnis speichern.

// TODO: eigene Fragen. q = Frage, a = Antworten, r = Nummer der richtigen Antwort (ab 0),
// e = kurze Erklärung, die nach der richtigen Antwort erscheint.
const QUESTIONS = [
  { q: "Wie viele Tage hat eine Woche?", a: ["5", "7", "10"], r: 1, e: "Eine Woche hat 7 Tage: von Montag bis Sonntag." },
  { q: "Welche Jahreszeit kommt nach dem Winter?", a: ["Frühling", "Herbst", "Sommer"], r: 0, e: "Nach dem Winter kommt der Frühling." },
  { q: "Was ist 6 · 4?", a: ["18", "24", "28"], r: 1, e: "6 · 4 = 24." },
];

type Screen = "start" | "game" | "win";

export default function Game() {
  const [screen, setScreen] = useState<Screen>("start");
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [result, setResult] = useState("");
  const startedAt = useRef(0);
  const item = QUESTIONS[index];

  const start = () => {
    setIndex(0);
    setWrong([]);
    setSolved(false);
    setMistakes(0);
    startedAt.current = Date.now();
    setScreen("game");
  };

  const answer = (i: number) => {
    if (i === item.r) setSolved(true);
    else {
      setWrong((w) => [...w, i]);
      setMistakes((m) => m + 1);
    }
  };

  const next = () => {
    if (index + 1 < QUESTIONS.length) {
      setIndex(index + 1);
      setWrong([]);
      setSolved(false);
      return;
    }
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    setResult(`Fehlversuche: ${mistakes} · Zeit: ${seconds} s`);
    setScreen("win");
    // HIGHSCORE-START
    // Ergebnis speichern – erscheint in der Bestenliste (weniger Fehlversuche sind besser)
    void saveScore("SPIEL_KEY", { points: mistakes, seconds }).then((error) =>
      setResult((r) => `${r}${error ? " · Speichern fehlgeschlagen" : " · 🏅 gespeichert"}`),
    );
    // HIGHSCORE-ENDE
  };

  return (
    <main className="card quiz">
      <Link to="/" className="back-link">🏠 Alle Spiele</Link>
      {screen === "start" && (
        <>
          <h2>SPIEL_TITEL</h2>
          <p className="hint">TODO: Erkläre in zwei kurzen Sätzen, was zu tun ist.</p>
          <button className="quiz-btn main" onClick={start}>▶ Los geht's!</button>
        </>
      )}
      {screen === "game" && (
        <>
          <p className="muted">Frage {index + 1} / {QUESTIONS.length}</p>
          <h2>{item.q}</h2>
          {item.a.map((text, i) => (
            <button
              key={text}
              className={`quiz-btn${solved && i === item.r ? " right" : ""}${wrong.includes(i) ? " wrong" : ""}`}
              disabled={solved || wrong.includes(i)}
              onClick={() => answer(i)}
            >
              {text}
            </button>
          ))}
          <p className="hint" aria-live="polite">
            {solved ? `✅ Richtig! ${item.e}` : wrong.length ? "🤔 Noch nicht ganz. Versuch es noch einmal!" : ""}
          </p>
          {solved && <button className="quiz-btn main" onClick={next}>Weiter ➜</button>}
        </>
      )}
      {screen === "win" && (
        <>
          <div className="quiz-trophy">🏆</div>
          <h2>Geschafft!</h2>
          <p className="hint">Du hast alle Fragen gelöst. Super gemacht!</p>
          <p>{result}</p>
          <button className="quiz-btn main" onClick={start}>🔄 Nochmal spielen</button>
        </>
      )}
    </main>
  );
}
