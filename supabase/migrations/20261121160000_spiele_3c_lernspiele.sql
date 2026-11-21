-- =====================================================================
-- Spiele aus dem Repository 3c-Lernspiele (HTML-Spiele unter public/games/)
--   highscore: 'high' = mehr Punkte sind besser, 'low' = weniger sind besser
--              (muss zu src/games/games.json passen, prüft tools/check.js)
-- Einspielen: Claude via Supabase-MCP apply_migration (siehe CLAUDE.md)
-- =====================================================================

insert into public.games (key, highscore) values
  ('europaflug',                   'high'),  -- Punkte für besuchte Länder
  ('sachunterricht-getreide',      'low'),   -- Fehlversuche
  ('deutschlandflug',              'high'),  -- Punkte für besuchte Bundesländer
  ('weltflug',                     'high'),  -- Punkte für besuchte Länder und Bauwerke
  ('mathe-robi',                   'low'),   -- Fehlversuche
  ('sachunterricht-getreideernte', 'low'),   -- Fehlversuche
  ('mathe-formen',                 'low'),   -- Fehlversuche
  ('deutsch-wortmonster',          'high');  -- richtig beim ersten Versuch

-- Freigabe für die Klasse 3c (weitere Gruppen später im Tab Admin)
insert into public.game_groups (game_key, group_id)
select k.key, g.id
from public.groups g
cross join (values
  ('europaflug'), ('sachunterricht-getreide'), ('deutschlandflug'), ('weltflug'),
  ('mathe-robi'), ('sachunterricht-getreideernte'), ('mathe-formen'), ('deutsch-wortmonster')
) as k(key)
where g.name = 'Klasse-3c'
on conflict do nothing;
