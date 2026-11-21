import { Link } from "react-router-dom";
import { staticGames } from "../games/catalog";

export default function Games() {
  return (
    <main className="card">
      <h2>Sachunterricht-Spiele</h2>
      <ul className="game-list">
        {staticGames.map((g) => (
          <li key={g.id}>
            <div>
              <strong>{g.title}</strong>
              <p className="muted">{g.description}</p>
              <small className="muted">Quelle: {g.source}</small>
            </div>
            <Link className="button" to={`/spiele/${g.id}`}>Spielen</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
