import { useEffect } from "react";
import { supabase } from "../lib/supabase";

// Nutzungsstatistik (Tabelle game_plays, Admin-Dashboard #/admin/statistik):
// Beim Öffnen eines Spiels wird ein Spielstart gemeldet, danach alle 30 s ein
// „spielt noch“, solange die Seite sichtbar ist. Daraus ergibt sich die Spielzeit.
// Zeiten setzt der Server. Fehler werden ignoriert – das Spiel läuft immer weiter.

const PING_MS = 30_000;

export function useGamePlay(gameKey: string | null) {
  useEffect(() => {
    if (!gameKey) return;
    let active = true;
    let playId: number | null = null;

    const ping = () => {
      if (playId !== null) void supabase.rpc("game_play_ping", { p_id: playId }).then(() => {}, () => {});
    };

    supabase.rpc("game_play_start", { p_game_key: gameKey }).then(
      ({ data }) => { if (active && typeof data === "number") playId = data; },
      () => {},
    );

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, PING_MS);
    // Beim Wegschalten (Tab, App-Wechsel, Bildschirm aus) die Zeit bis jetzt festhalten
    const onHide = () => { if (document.visibilityState === "hidden") ping(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", ping);

    return () => {
      active = false;
      ping();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", ping);
    };
  }, [gameKey]);
}
