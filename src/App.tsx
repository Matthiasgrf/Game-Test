import { Suspense, createElement, lazy, type ComponentType } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Highscores from "./pages/Highscores";
import Admin from "./pages/Admin";
import AdminStats from "./pages/AdminStats";
import GameGate from "./games/GameGate";
import HtmlGame from "./games/HtmlGame";
import { GAMES } from "./games/catalog";

// React-Spiele: src/games/<key>/index.tsx, werden erst beim Öffnen geladen.
// HTML-Spiele (type "html" in games.json) laufen im iframe (HtmlGame).
const REACT_GAMES = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: ComponentType }>("./games/*/index.tsx")).map(
    ([file, load]) => [file.split("/")[2], lazy(load)],
  ),
);

function GameView({ game }: { game: (typeof GAMES)[number] }) {
  if (game.html) return <HtmlGame game={game} />;
  const component = REACT_GAMES[game.key];
  if (!component) return <p className="center error">Spiel „{game.key}“ fehlt (src/games/{game.key}/index.tsx).</p>;
  return <Suspense fallback={<p className="center muted">Lade…</p>}>{createElement(component)}</Suspense>;
}

export default function App() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <p className="center muted">Lade…</p>;
  if (!session) return <Login />;

  const isAdmin = profile?.role === "admin";

  // HashRouter: GitHub Pages kennt keine SPA-Fallbacks, mit #/pfad klappt
  // das Neuladen jeder Seite trotzdem.
  return (
    <HashRouter>
      <header>
        <nav>
          <NavLink to="/" end>Spiele</NavLink>
          <NavLink to="/highscores">Highscores</NavLink>
          {isAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="who">
          <span>
            {profile?.username}
            {isAdmin && <span className="badge">admin</span>}
          </span>
          <button className="secondary" onClick={signOut}>Logout</button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Overview />} />
        {GAMES.map((g) => (
          <Route
            key={g.key}
            path={g.path}
            element={<GameGate gameKey={g.key}><GameView game={g} /></GameGate>}
          />
        ))}
        <Route path="/highscores" element={<Highscores />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
        <Route path="/admin/statistik" element={isAdmin ? <AdminStats /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
