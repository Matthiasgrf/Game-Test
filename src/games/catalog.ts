import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

/** Highscore-Einstellungen eines Spiels. Muss zur Spalte games.highscore passen. */
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

export interface GameInfo {
  /** Kennung in den Tabellen games, game_groups und game_scores */
  key: string;
  /** Route in der App (#/spiele/…) */
  path: string;
  title: string;
  emoji: string;
  description: string;
  age: string;
  color: string;
  /** Vorschaubild statt Emoji (relativ zur App, z. B. "games/x/thumbnail.jpg") */
  image?: string;
  /** Eigenständiges HTML-Spiel unter public/ – wird im iframe gezeigt (siehe HtmlGame.tsx) */
  html?: string;
  /** null = Spiel ohne Highscores (in games: highscore = 'none') */
  highscore: HighscoreConfig | null;
}

// Neue Spiele hier eintragen – Übersicht, Highscores und Admin bauen sich daraus auf.
// Dazu gehört eine Zeile in der Tabelle games (Migration), siehe README.
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
    highscore: {
      better: "high",
      pointsLabel: "Sterne",
      pointsIcon: "⭐",
      showTime: true,
      variants: [
        { id: "leicht", label: "🐣 Leicht" },
        { id: "mittel", label: "🦊 Mittel" },
        { id: "knifflig", label: "🦁 Knifflig" },
      ],
      rule: "Bestes Ergebnis je Spieler: meiste Sterne, bei Gleichstand die schnellste Zeit.",
    },
  },
  {
    key: "zahlenraten",
    path: "/spiele/zahlenraten",
    title: "Zahlenraten",
    emoji: "🔢",
    description: "Errate die geheime Zahl zwischen 1 und 100.",
    age: "ab 8 Jahren",
    color: "linear-gradient(135deg, #74c0fc, #5c7cfa)",
    highscore: {
      better: "low",
      pointsLabel: "Versuche",
      rule: "Bestes Ergebnis je Spieler: wenigste Versuche.",
    },
  },
  {
    key: "elisabeth",
    path: "/spiele/elisabeth",
    title: "Elisabeth von Thüringen",
    emoji: "🏰🌹",
    description: "Begleite Elisabeth durch ihr Leben und beantworte an 20 Stationen Fragen für den Religionsunterricht.",
    age: "3. Klasse",
    color: "linear-gradient(135deg, #b2f2bb, #fcc2d7)",
    image: "games/elisabeth/thumbnail.jpg",
    html: "games/elisabeth/index.html",
    highscore: {
      better: "low",
      pointsLabel: "Fehlversuche",
      showTime: true,
      rule: "Bestes Ergebnis je Spieler: wenigste Fehlversuche, bei Gleichstand die schnellste Zeit.",
    },
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
