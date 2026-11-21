-- =====================================================================
-- Spiel liftschlange („Liftschlange“)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser,
--              'none' = Spiel ohne Highscores (muss zu src/games/games.json passen)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values ('liftschlange', 'high');

-- Freigabe für Gruppen: bewusst keine – Après-Ski-Humor für Erwachsene, nicht für die Kinder-Gruppen.
-- Freigabe im Tab Admin für die Gruppe der vier Skifahrer (Matze, Dani, Alex, Gabor).


-- Kategorie in der Übersicht (ändern im Tab Admin)
insert into public.game_categories (game_key, category_id)
select 'liftschlange', c.id from public.categories c
where c.name = 'Freizeit'
on conflict do nothing;

