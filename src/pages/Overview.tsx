import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAllowedGames } from "../games/catalog";

export default function Overview() {
  const { profile } = useAuth();
  const { games, error } = useAllowedGames();
  return (
    <main className="overview">
      <h2>Hallo {profile?.username}! Was möchtest du spielen?</h2>
      {error && <p className="error">{error}</p>}
      {!games && !error && <p className="muted">Lade…</p>}
      {games && games.length === 0 && (
        <p className="card muted">
          Für dich sind noch keine Spiele freigeschaltet. Bitte frag den Admin,
          dich einer Gruppe zuzuordnen.
        </p>
      )}
      <div className="game-grid">
        {games?.map((g) => (
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
