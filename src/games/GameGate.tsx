import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAllowedGames } from "./catalog";
import { useGamePlay } from "./plays";

// Zeigt das Spiel nur, wenn es für eine Gruppe des Users freigegeben ist,
// und meldet den Spielstart für die Nutzungsstatistik (plays.ts).
export default function GameGate({ gameKey, children }: { gameKey: string; children: ReactNode }) {
  const { games, error } = useAllowedGames();
  const allowed = !!games?.some((g) => g.key === gameKey);
  useGamePlay(allowed ? gameKey : null);
  if (error) return <p className="center error">{error}</p>;
  if (!games) return <p className="center muted">Lade…</p>;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
