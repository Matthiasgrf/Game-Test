import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useAllowedGames, useCategories, type GameInfo } from "../games/catalog";

// Gewählte Kategorie merken (nur Bequemlichkeit, darf fehlen).
const FILTER_KEY = "game-test-uebersicht-kategorie";
const readFilter = () => {
  try { return localStorage.getItem(FILTER_KEY) ?? "alle"; } catch { return "alle"; }
};
const writeFilter = (v: string) => {
  try { localStorage.setItem(FILTER_KEY, v); } catch { /* egal */ }
};

interface Section { id: string; title: string; games: GameInfo[] }

function GameTile({ g }: { g: GameInfo }) {
  return (
    <Link to={g.path} className="game-tile">
      <img className="game-tile-img" src={g.image} alt="" style={{ background: g.color }} />
      <div className="game-tile-body">
        <h3>{g.title}</h3>
        <p className="muted">{g.description}</p>
        <span className="game-tile-age">{g.age}</span>
        {g.highscore && <span className="game-tile-age" title="mit Bestenliste">🏅 Bestenliste</span>}
      </div>
    </Link>
  );
}

export default function Overview() {
  const { profile } = useAuth();
  const { games, error } = useAllowedGames();
  const { categories, categoryOf } = useCategories();
  const [filter, setFilter] = useState(readFilter);

  const label = (c: { emoji: string; name: string }) => `${c.emoji ? c.emoji + " " : ""}${c.name}`;
  const catName = new Map(categories.map((c) => [c.id, label(c)]));

  // Abschnitte: jede Kategorie mit mindestens einem Spiel, Spiele ohne Kategorie am Ende.
  const sections: Section[] = [];
  if (games) {
    for (const c of categories) {
      const list = games.filter((g) => categoryOf.get(g.key) === c.id);
      if (list.length) sections.push({ id: String(c.id), title: label(c), games: list });
    }
    const rest = games.filter((g) => !catName.has(categoryOf.get(g.key) ?? -1));
    if (rest.length) {
      sections.push({ id: "weitere", title: sections.length ? "🎲 Weitere Spiele" : "", games: rest });
    }
  }
  const showFilter = sections.length > 1;
  const active = showFilter && sections.some((s) => s.id === filter) ? filter : "alle";
  const visible = active === "alle" ? sections : sections.filter((s) => s.id === active);

  const choose = (id: string) => { setFilter(id); writeFilter(id); };

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
      {showFilter && (
        <nav className="category-filter" aria-label="Kategorien">
          {[{ id: "alle", title: "⭐ Alle" }, ...sections].map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active ? "chip big on" : "chip big"}
              aria-pressed={s.id === active}
              onClick={() => choose(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
      )}
      {visible.map((s) => (
        <section key={s.id} className="category-section">
          {s.title && <h3 className="category-title">{s.title}</h3>}
          <div className="game-grid">
            {s.games.map((g) => (
              <GameTile key={g.key} g={g} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
