import { Link, Navigate, useParams } from "react-router-dom";
import { staticGames } from "../games/catalog";

export default function GamePlayer() {
  const { id } = useParams();
  const game = staticGames.find((g) => g.id === id);
  if (!game) return <Navigate to="/spiele" />;

  return (
    <main className="player">
      <div className="player-bar">
        <Link to="/spiele">← Alle Spiele</Link>
        <strong>{game.title}</strong>
        <a href={game.file} target="_blank" rel="noreferrer">Vollbild ↗</a>
      </div>
      <iframe
        key={game.id}
        src={game.file}
        title={game.title}
        allow="fullscreen"
        // Fokus ins Spiel, damit die Tastatursteuerung sofort funktioniert
        onLoad={(e) => e.currentTarget.focus()}
      />
    </main>
  );
}
