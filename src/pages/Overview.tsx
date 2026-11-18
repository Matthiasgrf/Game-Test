import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

interface GameInfo {
  path: string;
  title: string;
  emoji: string;
  description: string;
  age: string;
  color: string;
}

// Neue Spiele hier eintragen – die Übersicht baut sich daraus auf.
export const GAMES: GameInfo[] = [
  {
    path: "/spiele/labyrinth",
    title: "Labyrinth-Abenteuer",
    emoji: "🐭🧀",
    description: "Führe die Tiere durch 5 Labyrinthe und sammle Sterne!",
    age: "ab 5 Jahren",
    color: "linear-gradient(135deg, #ffd43b, #ff922b)",
  },
  {
    path: "/spiele/zahlenraten",
    title: "Zahlenraten",
    emoji: "🔢",
    description: "Errate die geheime Zahl zwischen 1 und 100.",
    age: "ab 8 Jahren",
    color: "linear-gradient(135deg, #74c0fc, #5c7cfa)",
  },
];

export default function Overview() {
  const { profile } = useAuth();
  return (
    <main className="overview">
      <h2>Hallo {profile?.username}! Was möchtest du spielen?</h2>
      <div className="game-grid">
        {GAMES.map((g) => (
          <Link key={g.path} to={g.path} className="game-tile">
            <div className="game-tile-art" style={{ background: g.color }}>{g.emoji}</div>
            <div className="game-tile-body">
              <h3>{g.title}</h3>
              <p className="muted">{g.description}</p>
              <span className="game-tile-age">{g.age}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
