import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

export interface GameInfo {
  /** Kennung in der Tabelle game_groups */
  key: string;
  path: string;
  title: string;
  emoji: string;
  description: string;
  age: string;
  color: string;
}

// Neue Spiele hier eintragen – Übersicht und Admin bauen sich daraus auf.
// Freigabe für Gruppen: Admin → Gruppen (Tabelle game_groups).
export const GAMES: GameInfo[] = [
  {
    key: "labyrinth",
    path: "/spiele/labyrinth",
    title: "Labyrinth-Abenteuer",
    emoji: "🐭🧀",
    description: "Führe die Tiere durch 5 Labyrinthe und sammle Sterne!",
    age: "ab 5 Jahren",
    color: "linear-gradient(135deg, #ffd43b, #ff922b)",
  },
  {
    key: "zahlenraten",
    path: "/spiele/zahlenraten",
    title: "Zahlenraten",
    emoji: "🔢",
    description: "Errate die geheime Zahl zwischen 1 und 100.",
    age: "ab 8 Jahren",
    color: "linear-gradient(135deg, #74c0fc, #5c7cfa)",
  },
];

/**
 * Spiele, die der eingeloggte User sehen darf: Spiele, die mindestens einer
 * seiner Gruppen zugeordnet sind. Admins sehen alle.
 * Die Datenbank prüft das zusätzlich beim Speichern von Ergebnissen (can_play).
 */
export function useAllowedGames(): { games: GameInfo[] | null; error: string | null } {
  const { profile } = useAuth();
  const [games, setGames] = useState<GameInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "admin") {
      setGames(GAMES);
      return;
    }
    let active = true;
    (async () => {
      const { data: mine, error: e1 } = await supabase
        .from("user_groups").select("group_id").eq("user_id", profile.id);
      if (e1) throw e1;
      const groupIds = (mine ?? []).map((r) => r.group_id as number);
      let keys = new Set<string>();
      if (groupIds.length) {
        const { data: gg, error: e2 } = await supabase
          .from("game_groups").select("game_key").in("group_id", groupIds);
        if (e2) throw e2;
        keys = new Set((gg ?? []).map((r) => r.game_key as string));
      }
      if (active) setGames(GAMES.filter((g) => keys.has(g.key)));
    })().catch((e) => active && setError((e as Error).message));
    return () => { active = false; };
  }, [profile]);

  return { games, error };
}
