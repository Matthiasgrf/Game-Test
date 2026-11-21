-- =====================================================================
-- Spiel SPIEL_KEY („SPIEL_TITEL“)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser,
--              'none' = Spiel ohne Highscores (muss zu src/games/games.json passen)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values ('SPIEL_KEY', 'SPIEL_MODUS');
SPIEL_FREIGABE