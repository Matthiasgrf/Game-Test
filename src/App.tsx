import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import Game from "./pages/Game";
import RohrFlitzer from "./pages/RohrFlitzer";
import Highscores from "./pages/Highscores";
import Admin from "./pages/Admin";

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
          <NavLink to="/rohr-flitzer">Rohr-Flitzer</NavLink>
          <NavLink to="/game">Zahlenraten</NavLink>
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
        <Route path="/rohr-flitzer" element={<RohrFlitzer />} />
        <Route path="/game" element={<Game />} />
        <Route path="/highscores" element={<Highscores />} />
        <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/rohr-flitzer" />} />
        <Route path="*" element={<Navigate to="/rohr-flitzer" />} />
      </Routes>
    </HashRouter>
  );
}
