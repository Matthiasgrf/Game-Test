import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ZIELGRUPPEN, useAllowedGames, useCategories, type GameInfo, type Zielgruppe } from "../games/catalog";

// Gewählte Kategorie und Bereich merken (nur Bequemlichkeit, darf fehlen).
const FILTER_KEY = "game-test-uebersicht-kategorie";
const AREA_KEY = "game-test-uebersicht-bereich";
const read = (key: string) => {
  try { return localStorage.getItem(key) ?? "alle"; } catch { return "alle"; }
};
const write = (key: string, v: string) => {
  try { localStorage.setItem(key, v); } catch { /* egal */ }
};

interface Section { id: string; title: string; games: GameInfo[] }
type Area = "alle" | Zielgruppe;

function GameTile({ g }: { g: GameInfo }) {
  return (
    <Link to={g.path} className="game-tile">
      <img className="game-tile-img" src={g.image} alt="" loading="lazy" style={{ background: g.color }} />
      <div className="game-tile-body">
        <h3>{g.title}</h3>
        <p className="muted">{g.description}</p>
        <span className="game-tile-age">{g.age}</span>
        {g.highscore && <span className="game-tile-age" title="mit Bestenliste">🏅 Bestenliste</span>}
        {g.status === "beta" && <span className="game-tile-age" title="wird noch getestet">🧪 Beta</span>}
        {g.status === "entwurf" && <span className="game-tile-age" title="nur für Admins sichtbar">📝 Entwurf</span>}
      </div>
    </Link>
  );
}

export default function Overview() {
  const { profile } = useAuth();
  const { games, error } = useAllowedGames();
  const { categories, categoryOf } = useCategories();
  const [filter, setFilter] = useState(() => read(FILTER_KEY));
  const [area, setArea] = useState(() => read(AREA_KEY) as Area);

  const label = (c: { emoji: string; name: string }) => `${c.emoji ? c.emoji + " " : ""}${c.name}`;
  const catName = new Map(categories.map((c) => [c.id, label(c)]));

  // Kategorie-Abschnitte einer Liste: jede Kategorie mit mindestens einem Spiel, Spiele ohne Kategorie am Ende.
  const sectionsOf = (list: GameInfo[], withTitles: boolean): Section[] => {
    const sections: Section[] = [];
    for (const c of categories) {
      const inCat = list.filter((g) => categoryOf.get(g.key) === c.id);
      if (inCat.length) sections.push({ id: String(c.id), title: label(c), games: inCat });
    }
    const rest = list.filter((g) => !catName.has(categoryOf.get(g.key) ?? -1));
    if (rest.length) sections.push({ id: "weitere", title: sections.length || withTitles ? "🎲 Weitere Spiele" : "", games: rest });
    return sections;
  };

  // Bereiche nach Zielgruppe (Kinder · Lernen / Erwachsene · Spaß) – nur wenn beide vorkommen.
  const areas = ZIELGRUPPEN.filter((z) => games?.some((g) => g.zielgruppe === z.id));
  const showAreas = areas.length > 1;
  const activeArea: Area = showAreas && areas.some((a) => a.id === area) ? area : "alle";
  const blocks = (games ? (showAreas && activeArea === "alle" ? areas : [{ id: activeArea, label: "" }]) : [])
    .map((z) => {
      const list = games!.filter((g) => z.id === "alle" || g.zielgruppe === z.id);
      return { id: z.id, title: z.label, sections: sectionsOf(list, showAreas) };
    })
    .filter((b) => b.sections.length);

  // Kategorie-Filter über alle sichtbaren Abschnitte (gleiche Kategorie kann in beiden Bereichen vorkommen)
  const chips = [...new Map(blocks.flatMap((b) => b.sections).map((s) => [s.id, s.title || "🎲 Weitere Spiele"])).entries()];
  const showFilter = chips.length > 1;
  const active = showFilter && chips.some(([id]) => id === filter) ? filter : "alle";

  const chooseCategory = (id: string) => { setFilter(id); write(FILTER_KEY, id); };
  const chooseArea = (id: Area) => { setArea(id); write(AREA_KEY, id); };

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
      {showAreas && (
        <nav className="area-filter" aria-label="Bereiche">
          {[{ id: "alle" as Area, label: "⭐ Alle Spiele" }, ...areas].map((a) => (
            <button
              key={a.id}
              type="button"
              className={a.id === activeArea ? "chip big on" : "chip big"}
              aria-pressed={a.id === activeArea}
              onClick={() => chooseArea(a.id)}
            >
              {a.label}
            </button>
          ))}
        </nav>
      )}
      {showFilter && (
        <nav className="category-filter" aria-label="Kategorien">
          {[["alle", "⭐ Alle"], ...chips].map(([id, title]) => (
            <button
              key={id}
              type="button"
              className={id === active ? "chip big on" : "chip big"}
              aria-pressed={id === active}
              onClick={() => chooseCategory(id)}
            >
              {title}
            </button>
          ))}
        </nav>
      )}
      {blocks.map((b) => {
        const visible = b.sections.filter((s) => active === "alle" || s.id === active);
        if (!visible.length) return null;
        return (
          <div key={b.id} className="area-block" data-area={b.id}>
            {showAreas && activeArea === "alle" && <h2 className="area-title">{b.title}</h2>}
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
          </div>
        );
      })}
    </main>
  );
}
