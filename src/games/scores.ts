import { supabase } from "../lib/supabase";

// Ein Ergebnis für die gemeinsame Tabelle game_scores.
// Ob mehr oder weniger Punkte besser sind, steht in der Tabelle games (Spalte highscore)
// und in src/games/games.json (highscore.better).
export interface ScoreInput {
  points: number;
  maxPoints?: number | null;
  seconds?: number | null;
  /** z. B. Schwierigkeitsstufe; leer = keine Variante */
  variant?: string;
}

export interface ScoreRow {
  variant: string;
  points: number;
  max_points: number | null;
  seconds: number | null;
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** Prüft ein Ergebnis aus einer fremden Quelle (z. B. postMessage aus einem HTML-Spiel). */
export function parseScore(data: Record<string, unknown>): ScoreInput | null {
  if (!isCount(data.points)) return null;
  const maxPoints = data.maxPoints ?? null;
  const seconds = data.seconds ?? null;
  const variant = data.variant ?? "";
  if (maxPoints !== null && !isCount(maxPoints)) return null;
  if (seconds !== null && !isCount(seconds)) return null;
  if (typeof variant !== "string" || !/^[a-z0-9_-]{0,40}$/.test(variant)) return null;
  return { points: data.points, maxPoints, seconds, variant };
}

/** Speichert ein Ergebnis. Gibt eine Fehlermeldung zurück oder null. */
export async function saveScore(gameKey: string, s: ScoreInput): Promise<string | null> {
  // user_id setzt die DB per default auf auth.uid(); RLS erlaubt nur eigene,
  // freigegebene Spiele mit Highscore.
  const { error } = await supabase.from("game_scores").insert({
    game_key: gameKey,
    variant: s.variant ?? "",
    points: s.points,
    max_points: s.maxPoints ?? null,
    seconds: s.seconds ?? null,
  });
  return error ? error.message : null;
}

/** Alle eigenen Ergebnisse eines Spiels (z. B. für „Dein Rekord“). */
export async function loadMyScores(gameKey: string, userId: string): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("game_scores")
    .select("variant, points, max_points, seconds")
    .eq("game_key", gameKey)
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as ScoreRow[];
}
