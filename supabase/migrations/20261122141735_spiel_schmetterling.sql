-- =====================================================================
-- Spiel schmetterling („Flatter, der Schmetterling“)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser,
--              'none' = Spiel ohne Highscores (muss zu src/games/games.json passen)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values ('schmetterling', 'high');

-- Freigabe für Gruppen (weitere später im Tab Admin)
insert into public.game_groups (game_key, group_id)
select 'schmetterling', g.id from public.groups g
where g.name in ('Kindergarten')
on conflict do nothing;

-- Neue Kategorie „Kindergarten“ (vor den Schulfächern), falls es sie noch nicht gibt
insert into public.categories (name, emoji, sort_order) values ('Kindergarten', '🧸', 5)
on conflict (name) do nothing;

-- Kategorie in der Übersicht (ändern im Tab Admin)
insert into public.game_categories (game_key, category_id)
select 'schmetterling', c.id from public.categories c
where c.name = 'Kindergarten'
on conflict do nothing;
