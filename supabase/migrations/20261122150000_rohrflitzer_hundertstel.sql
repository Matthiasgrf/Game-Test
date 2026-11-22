-- Rohr-Flitzer: Punkte jetzt in Hundertstelsekunden (games.json highscore.pointsDecimals = 2).
-- Bisherige Ergebnisse waren ganze Sekunden → × 100, damit sie in der Bestenliste richtig erscheinen.
-- Erst nach dem Deploy der App einspielen (die alte App zeigt sonst 1200 statt 12 Sekunden).
-- Alte Ergebnisse erkennt man an points = seconds (neue: points ≈ seconds × 100), daher mehrfach ausführbar.
update public.game_scores
   set points = points * 100
 where game_key = 'rohr-flitzer'
   and points = seconds;
