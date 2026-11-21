-- =====================================================================
-- Zahlenraten entfernen
--
-- Das Spiel wird nicht mehr angeboten. Entfernt werden:
--   - die Datenbank-Spiellogik aus 20261122000000_highscores_absichern.sql
--     (zahlenraten_start, zahlenraten_raten, Tabelle zahlenraten_runden)
--   - die alte Zahlenraten-Tabelle scores samt View highscores (leer, die
--     App nutzt seit game_scores nur noch die gemeinsame Tabelle)
--   - der Eintrag in games; per ON DELETE CASCADE auch die Freigaben
--     (game_groups), Kategorie (game_categories), Spielstarts (game_plays),
--     Ergebnisse (game_scores) und Spielstaende (game_states) dieses Spiels
--
-- Die Plausibilitaetspruefung (game_scores_check, games.server_scored)
-- bleibt fuer alle anderen Spiele bestehen.
--
-- Rueckwaertskompatibel: Die veroeffentlichte App zeigt nur freigegebene
-- Spiele – ohne game_groups-Zeile verschwindet die Kachel, GameGate leitet
-- einen direkten Aufruf auf die Uebersicht um.
-- =====================================================================

drop function public.zahlenraten_raten(bigint, integer);
drop function public.zahlenraten_start();
drop table public.zahlenraten_runden;

drop view public.highscores;
drop table public.scores;

delete from public.games where key = 'zahlenraten';
