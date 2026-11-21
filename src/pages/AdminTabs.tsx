import { NavLink } from "react-router-dom";

/** Umschalter zwischen den Admin-Seiten. */
export default function AdminTabs() {
  return (
    <nav className="admin-tabs" aria-label="Admin-Bereich">
      <NavLink to="/admin/statistik">📊 Statistik</NavLink>
      <NavLink to="/admin" end>⚙️ Verwaltung</NavLink>
    </nav>
  );
}
