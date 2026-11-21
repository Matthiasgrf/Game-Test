import { useEffect, useRef, useState } from "react";
import type { GameInfo } from "./catalog";
import { parseScore, saveScore } from "./scores";

// Zeigt ein eigenständiges HTML-Spiel (public/games/<key>/index.html) bildschirmfüllend.
// Das Spiel meldet sein Ergebnis über public/games/shared/game-test.js per postMessage;
// hier wird es geprüft und für den eingeloggten Spieler gespeichert.
// Den Weg zurück zur Übersicht bietet das Spiel selbst (Link mit target="_top").
export default function HtmlGame({ game }: { game: GameInfo }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      // Nur Nachrichten aus genau diesem iframe und von der eigenen Seite annehmen
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (!data || data.source !== "game-test" || data.type !== "score") return;
      if (!game.highscore) return; // Spiel ohne Highscores
      const score = parseScore(data);
      if (!score) return;
      setToast({ text: "Ergebnis wird gespeichert…" });
      const error = await saveScore(game.key, score);
      setToast(error ? { text: `Speichern fehlgeschlagen: ${error}`, error: true } : { text: "🏅 Ergebnis in der Bestenliste gespeichert" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game]);

  useEffect(() => {
    if (!toast || toast.text.endsWith("…")) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <iframe ref={frame} className="html-game" src={game.html} title={game.title} allow="fullscreen" />
      {toast && <div className={`html-game-toast${toast.error ? " error" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}
