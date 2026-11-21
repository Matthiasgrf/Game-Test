import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAllowedGames } from "./catalog";

// Zeigt das Spiel nur, wenn es für eine Gruppe des Users freigegeben ist.
export default function GameGate({ gameKey, children }: { gameKey: string; children: ReactNode }) {
  const { games, error } = useAllowedGames();
  if (error) return <p className="center error">{error}</p>;
  if (!games) return <p className="center muted">Lade…</p>;
  if (!games.some((g) => g.key === gameKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
