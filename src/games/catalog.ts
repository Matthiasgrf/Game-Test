import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import gamesJson from "./games.json";

/*
 * Alle Spiele stehen in games.json – Übersicht, Routen, Highscores, Admin und die
 * Werkzeuge in tools/ lesen diese Datei. Neues Spiel: node tools/neues-spiel.js (siehe CLAUDE.md).
 *
 * Felder in games.json
 *   key          Kennung, nur a-z 0-9 - _ (wie in den Tabellen games, game_groups, game_scores)
 *   type         "react" → src/games/<key>/index.tsx · "html" → public/games/<key>/index.html (im iframe)
 *   title, description (1 Satz), age (z. B. "3. Klasse"), emoji (Tabs/Admin), color (Hintergrund)
 *   highscore    HighscoreConfig oder null (= Spiel ohne Highscores, in games: 'none')
 * Abgeleitet, nicht eintragen: path (#/spiele/<key>), image (games/<key>/thumbnail.jpg), html.
 */

/** Highscore-Einstellungen eines Spiels. Muss zur Spalte games.highscore passen (prüft tools/check.js). */
export interface HighscoreConfig {
  /** "high": mehr Punkte sind besser (Sterne) · "low": weniger sind besser (Versuche, Fehler) */
  better: "high" | "low";
  /** Spaltenüberschrift für die Punkte, z. B. "Sterne" */
  pointsLabel: string;
  /** Zeichen vor den Punkten, z. B. "⭐" */
  pointsIcon?: string;
  /** Spalte „Zeit“ anzeigen (Gleichstand entscheidet immer die kürzere Zeit) */
  showTime?: boolean;
  /** Varianten mit eigener Bestenliste, z. B. Schwierigkeitsstufen */
  variants?: { id: string; label: string }[];
  /** Erklärung über der Bestenliste */
  rule: string;
}

export interface GameEntry {
  key: string;
  type: "react" | "html";
  title: string;
  description: string;
  age: string;
  emoji: string;
  color: string;
  highscore: HighscoreConfig | null;
}

export interface GameInfo extends GameEntry {
  /** Route in der App (#/spiele/<key>) */
  path: string;
  /** Vorschaubild 900×600 */
  image: string;
  /** nur HTML-Spiele: Adresse der Spieldatei */
  html?: string;
}

export const GAMES: GameInfo[] = (gamesJson as GameEntry[]).map((g) => ({
  ...g,
  path: `/spiele/${g.key}`,
  image: `games/${g.key}/thumbnail.jpg`,
  html: g.type === "html" ? `games/${g.key}/index.html` : undefined,
}));

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
