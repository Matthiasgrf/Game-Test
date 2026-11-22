import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import type { GameInfo } from "./catalog";
import { loadMyScores, parseScore, saveScore } from "./scores";
import { loadState, parseState, saveState, type GameState } from "./states";

// Zeigt ein eigenständiges HTML-Spiel (public/games/<key>/index.html) bildschirmfüllend.
// Das Spiel meldet sein Ergebnis über public/games/shared/game-test.js per postMessage;
// hier wird es geprüft und für den eingeloggten Spieler gespeichert.
// Den Weg zurück zur Übersicht bietet das Spiel selbst (Link mit target="_top").
// Fragt das Spiel seine eigenen Ergebnisse ab (GameTest.getScores / kit/storage.js), antwortet die App
// mit den Ergebnissen des eingeloggten Spielers.
//
// Spielstand (nur Spiele mit saveKey in games.json): Vor dem Start wird der Stand des
// Spielers aus game_states geladen und unter saveKey in localStorage geschrieben – das
// Spiel liest ihn wie gewohnt von dort. Änderungen meldet das Spiel mit GameTest.saveState,
// sie werden kurz gesammelt und dann gespeichert.

const SAVE_DELAY = 1000;
/** Wem der Spielstand in localStorage gehört (user_id) – damit Kinder am selben Gerät getrennt bleiben. */
const ownerKey = (gameKey: string) => `game-test-owner:${gameKey}`;

function storage(fn: () => void) {
  try { fn(); } catch { /* localStorage gesperrt, z. B. privates Fenster */ }
}

export default function HtmlGame({ game }: { game: GameInfo }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const frame = useRef<HTMLIFrameElement>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [ready, setReady] = useState(!game.saveKey);
  const sync = useRef(false); // Spielstand zum Server speichern? (nur wenn das Laden geklappt hat)
  const pending = useRef<GameState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Spielstand laden, bevor das Spiel startet
  useEffect(() => {
    const saveKey = game.saveKey;
    if (!saveKey || !userId) return;
    let active = true;
    sync.current = false;
    setReady(false);
    loadState(game.key, userId)
      .then((state) => {
        if (!active) return;
        if (state) {
          storage(() => localStorage.setItem(saveKey, JSON.stringify(state)));
        } else {
          // Noch kein Stand auf dem Server: einen alten Stand ohne Besitzer übernimmt das Kind,
          // den Stand eines anderen Kinds nicht.
          let owner: string | null = null;
          storage(() => { owner = localStorage.getItem(ownerKey(game.key)); });
          if (owner && owner !== userId) storage(() => localStorage.removeItem(saveKey));
        }
        storage(() => localStorage.setItem(ownerKey(game.key), userId));
        sync.current = true;
      })
      .catch(() => {
        if (!active) return;
        let owner: string | null = null;
        storage(() => { owner = localStorage.getItem(ownerKey(game.key)); });
        if (owner && owner !== userId) storage(() => localStorage.removeItem(saveKey));
        setToast({ text: "Spielstand konnte nicht geladen werden – er wird diesmal nicht gespeichert.", error: true });
      })
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, [game, userId]);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const state = pending.current;
    pending.current = null;
    if (!state || !userId || !sync.current) return;
    const error = await saveState(game.key, userId, state);
    if (error) setToast({ text: `Spielstand speichern fehlgeschlagen: ${error}`, error: true });
  }, [game, userId]);

  // Beim Verlassen des Spiels oder der Seite sofort speichern
  useEffect(() => {
    const onHide = () => { void flush(); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      // Nur Nachrichten aus genau diesem iframe und von der eigenen Seite annehmen
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (!data || data.source !== "game-test") return;

      if (data.type === "getScores") {
        const reply = (scores: unknown[]) => frame.current?.contentWindow?.postMessage(
          { source: "game-test-app", type: "scores", id: data.id, scores }, window.location.origin);
        if (!userId || !game.highscore) { reply([]); return; }
        loadMyScores(game.key, userId)
          .then((rows) => reply(rows.map((r) => ({ points: r.points, maxPoints: r.max_points, seconds: r.seconds, variant: r.variant }))))
          .catch(() => reply([]));
        return;
      }

      if (data.type === "state") {
        if (!game.saveKey || !sync.current) return;
        const state = parseState(data.data);
        if (!state) return;
        pending.current = state;
        if (!timer.current) timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY);
        return;
      }

      if (data.type !== "score") return;
      if (!game.highscore) return; // Spiel ohne Highscores
      const score = parseScore(data);
      if (!score) return;
      setToast({ text: "Ergebnis wird gespeichert…" });
      const error = await saveScore(game.key, score);
      setToast(error ? { text: `Speichern fehlgeschlagen: ${error}`, error: true } : { text: "🏅 Ergebnis in der Bestenliste gespeichert" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [game, flush, userId]);

  useEffect(() => {
    if (!toast || toast.text.endsWith("…")) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {ready
        ? <iframe ref={frame} className="html-game" src={game.html} title={game.title} allow="fullscreen" />
        : <p className="center muted">Spielstand wird geladen…</p>}
      {toast && <div className={`html-game-toast${toast.error ? " error" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}
