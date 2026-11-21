import type { ReactNode } from "react";
import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import NumberGuess from "./pages/NumberGuess";
import Labyrinth from "./games/labyrinth/Labyrinth";
import Highscores from "./pages/Highscores";
import Admin from "./pages/Admin";
import GameGate from "./games/GameGate";
import HtmlGame from "./games/HtmlGame";
import { GAMES } from "./games/catalog";

// Spiele als React-Komponente; Spiele mit `html` im Katalog laufen im iframe.
const REACT_GAMES: Record<string, ReactNode> = {
  labyrinth: <Labyrinth />,
  zahlenraten: <NumberGuess />,
};

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
            element={<GameGate gameKey={g.key}>{g.html ? <HtmlGame game={g} /> : REACT_GAMES[g.key]}</GameGate>}
          />
        ))}
        <Route path="/highscores" element={<Highscores />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  );
}
