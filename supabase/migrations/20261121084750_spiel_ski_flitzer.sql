-- =====================================================================
-- Spiel ski-flitzer („Ski-Flitzer“)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser,
--              'none' = Spiel ohne Highscores (muss zu src/games/games.json passen)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values ('ski-flitzer', 'high');

-- Freigabe für Gruppen (weitere später im Tab Admin)
insert into public.game_groups (game_key, group_id)
select 'ski-flitzer', g.id from public.groups g
where g.name in ('Fisser-Flitzer')
on conflict do nothing;
