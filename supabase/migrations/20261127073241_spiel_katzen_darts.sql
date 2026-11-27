-- =====================================================================
-- Spiel katzen-darts („Katzen-Darts“)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser,
--              'none' = Spiel ohne Highscores (muss zu src/games/games.json passen)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values ('katzen-darts', 'high');

-- Freigabe für Gruppen (weitere später im Tab Admin)
insert into public.game_groups (game_key, group_id)
select 'katzen-darts', g.id from public.groups g
where g.name in ('Fisser-Flitzer')
on conflict do nothing;


-- Kategorie in der Übersicht (ändern im Tab Admin)
insert into public.game_categories (game_key, category_id)
select 'katzen-darts', c.id from public.categories c
where c.name = 'Freizeit'
on conflict do nothing;

