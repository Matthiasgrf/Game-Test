-- =====================================================================
-- Zahlenraten: Ergebnisse nur noch aus der Datenbank
--
-- ERST NACH DEM DEPLOY EINSPIELEN: Die bis dahin veroeffentlichte App
-- speichert Zahlenraten-Ergebnisse noch direkt in game_scores. Ab jetzt
-- lehnt der Trigger game_scores_check solche Eintraege ab; gespeichert wird
-- nur noch ueber zahlenraten_raten() (siehe 20261122000000_highscores_absichern.sql).
-- =====================================================================

update public.games set server_scored = true where key = 'zahlenraten';
