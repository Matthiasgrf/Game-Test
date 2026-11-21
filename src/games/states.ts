import { supabase } from "../lib/supabase";

// Spielstand pro Spieler und Spiel (Tabelle game_states), z. B. Zahnräder und
// gekaufte Teile bei Robi. HTML-Spiele melden ihren Stand mit GameTest.saveState,
// HtmlGame.tsx lädt ihn vor dem Spielstart und schreibt ihn in localStorage.

export type GameState = Record<string, unknown>;

/** Größte erlaubte Größe (wie in der Datenbank, Zeichen als JSON). */
export const MAX_STATE_SIZE = 100000;

/** Prüft einen Spielstand aus einer fremden Quelle (postMessage). */
export function parseState(data: unknown): GameState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  try {
    if (JSON.stringify(data).length > MAX_STATE_SIZE) return null;
  } catch {
    return null;
  }
  return data as GameState;
}

/** Eigener Spielstand oder null, wenn es noch keinen gibt. Wirft bei Fehlern. */
export async function loadState(gameKey: string, userId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from("game_states")
    .select("data")
    .eq("game_key", gameKey)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as GameState | undefined) ?? null;
}

/** Speichert den Spielstand (legt ihn an oder überschreibt ihn). Gibt eine Fehlermeldung zurück oder null. */
export async function saveState(gameKey: string, userId: string, state: GameState): Promise<string | null> {
  const { error } = await supabase.from("game_states").upsert(
    { user_id: userId, game_key: gameKey, data: state, updated_at: new Date().toISOString() },
    { onConflict: "user_id,game_key" },
  );
  return error ? error.message : null;
}
