-- =====================================================================
-- Einheitliche Highscores fuer alle Spiele
--   games          : ein Eintrag pro Spiel, legt fest ob/wie es Highscores gibt
--                    highscore = 'high' -> mehr Punkte sind besser (Sterne)
--                                'low'  -> weniger Punkte sind besser (Versuche, Fehler)
--                                'none' -> Spiel ohne Highscores
--   game_scores    : jedes gespeicherte Ergebnis, egal welches Spiel
--   game_highscores: bestes Ergebnis je Spieler, Top 10 je Gruppe/Spiel/Variante
--                    Gleichstand: kuerzere Zeit (seconds), dann frueheres Datum
--
-- Neues Spiel: Zeile in games einfuegen (neue Migration) und im Frontend in
-- src/games/catalog.ts eintragen. Spiele ohne Highscore: highscore = 'none'
-- und im Katalog highscore: null.
--
-- Die alten Tabellen scores / labyrinth_scores und ihre Views bleiben vorerst
-- stehen, damit die bereits veroeffentlichte App bis zum Deploy weiterlaeuft.
-- Ihre Daten werden unten nach game_scores kopiert. Entfernen in einer
-- spaeteren Migration.
-- =====================================================================

-- ---------- games -----------------------------------------------------
create table public.games (
  key        text primary key check (key ~ '^[a-z0-9_-]{1,40}$'),
  highscore  text not null default 'none' check (highscore in ('high', 'low', 'none')),
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

-- Lesen fuer alle Eingeloggten; Aendern nur per Migration (keine Policy).
create policy "games: authenticated can read"
  on public.games for select to authenticated using (true);

insert into public.games (key, highscore) values
  ('labyrinth',   'high'),   -- Sterne
  ('zahlenraten', 'low'),    -- Versuche
  ('elisabeth',   'low');    -- Fehlversuche

-- Freigaben duerfen nur bekannte Spiele betreffen.
alter table public.game_groups
  add constraint game_groups_game_key_fkey
  foreign key (game_key) references public.games (key) on delete cascade;

-- ---------- game_scores -----------------------------------------------
create table public.game_scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_key   text not null references public.games (key) on delete cascade,
  -- optionale Spielvariante, z.B. Schwierigkeitsstufe ('leicht'); '' = keine
  variant    text not null default '' check (variant ~ '^[a-z0-9_-]{0,40}$'),
  points     integer not null check (points between 0 and 1000000),
  max_points integer check (max_points between 1 and 1000000),
  seconds    integer check (seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  check (max_points is null or points <= max_points)
);

create index game_scores_user_id_idx on public.game_scores (user_id);
create index game_scores_game_idx on public.game_scores (game_key, variant);

alter table public.game_scores enable row level security;

-- Sichtbar wie bisher: eigene, Admin, oder Mitspieler aus einer Gruppe,
-- fuer die das Spiel freigegeben ist (can_see_score aus group_highscores).
create policy "game_scores: read same group"
  on public.game_scores for select to authenticated
  using (public.can_see_score(user_id, game_key));

-- Speichern nur fuer sich selbst, nur freigegebene Spiele, nur Spiele mit Highscore.
create policy "game_scores: users insert own"
  on public.game_scores for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_play(game_key)
    and exists (select 1 from public.games g where g.key = game_key and g.highscore <> 'none')
  );

-- ---------- vorhandene Ergebnisse uebernehmen -------------------------
insert into public.game_scores (user_id, game_key, variant, points, max_points, seconds, created_at)
select user_id, 'labyrinth', mode, stars, max_stars, seconds, created_at
from public.labyrinth_scores;

insert into public.game_scores (user_id, game_key, points, created_at)
select user_id, 'zahlenraten', attempts, created_at
from public.scores;

-- ---------- game_highscores -------------------------------------------
-- security_invoker: RLS auf game_scores, user_groups usw. gilt weiter.
create view public.game_highscores
with (security_invoker = true) as
with scoped as (
  select s.id, s.user_id, s.game_key, s.variant, s.points, s.max_points, s.seconds, s.created_at,
         gg.group_id,
         case when g.highscore = 'high' then -s.points else s.points end as sort_points
  from public.game_scores s
  join public.games g on g.key = s.game_key and g.highscore <> 'none'
  join public.user_groups ug on ug.user_id = s.user_id
  join public.game_groups gg on gg.group_id = ug.group_id and gg.game_key = s.game_key
), best as (
  select distinct on (sc.group_id, sc.game_key, sc.variant, sc.user_id) sc.*
  from scoped sc
  order by sc.group_id, sc.game_key, sc.variant, sc.user_id,
           sc.sort_points, sc.seconds asc nulls last, sc.created_at asc
), ranked as (
  select b.*, row_number() over (
    partition by b.group_id, b.game_key, b.variant
    order by b.sort_points, b.seconds asc nulls last, b.created_at asc
  ) as rank
  from best b
)
select r.id, r.game_key, r.variant, r.group_id, r.rank, p.username,
       r.points, r.max_points, r.seconds, r.created_at
from ranked r
join public.profiles p on p.id = r.user_id
where r.rank <= 10;

-- ---------- Rechte (siehe 20261118000100_grants.sql) ------------------
revoke all on public.games, public.game_scores, public.game_highscores from anon;
revoke truncate, references, trigger on public.games, public.game_scores, public.game_highscores from authenticated;
grant select on public.games to authenticated;
grant select, insert on public.game_scores to authenticated;
grant select on public.game_highscores to authenticated;
grant select, insert, update, delete on public.games, public.game_scores to service_role;
grant select on public.game_highscores to service_role;

-- ---------- Freigabe: Elisabeth fuer Klasse-3c ------------------------
insert into public.game_groups (game_key, group_id)
select 'elisabeth', gr.id from public.groups gr where gr.name = 'Klasse-3c'
on conflict do nothing;
