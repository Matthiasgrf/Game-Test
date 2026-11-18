-- =====================================================================
-- Labyrinth-Abenteuer: Ergebnisse einer kompletten Challenge (5 Level)
--   labyrinth_scores     : jede abgeschlossene Challenge
--   labyrinth_highscores : bestes Ergebnis je Spieler & Stufe, Top 10 je Stufe
-- =====================================================================

create table public.labyrinth_scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mode       text not null check (mode in ('leicht', 'mittel', 'knifflig')),
  stars      integer not null check (stars >= 0),
  max_stars  integer not null check (max_stars between 1 and 50),
  seconds    integer not null check (seconds between 1 and 86400),
  created_at timestamptz not null default now(),
  check (stars <= max_stars)
);

create index labyrinth_scores_user_id_idx on public.labyrinth_scores (user_id);
create index labyrinth_scores_rank_idx on public.labyrinth_scores (mode, stars desc, seconds asc);

alter table public.labyrinth_scores enable row level security;

create policy "labyrinth_scores: authenticated can read"
  on public.labyrinth_scores for select
  to authenticated
  using (true);

create policy "labyrinth_scores: users insert own"
  on public.labyrinth_scores for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- Bestes Ergebnis pro Spieler und Stufe (mehr Sterne, dann schneller),
-- davon die Top 10 je Stufe. security_invoker -> RLS gilt weiter.
create view public.labyrinth_highscores
with (security_invoker = true) as
with best as (
  select distinct on (s.user_id, s.mode)
         s.id, s.user_id, s.mode, s.stars, s.max_stars, s.seconds, s.created_at
  from public.labyrinth_scores s
  order by s.user_id, s.mode, s.stars desc, s.seconds asc, s.created_at asc
), ranked as (
  select b.*, row_number() over (partition by b.mode order by b.stars desc, b.seconds asc, b.created_at asc) as rank
  from best b
)
select r.id, r.mode, r.rank, p.username, r.stars, r.max_stars, r.seconds, r.created_at
from ranked r
join public.profiles p on p.id = r.user_id
where r.rank <= 10;

-- Rechte (siehe 20261118000100_grants.sql)
revoke all on public.labyrinth_scores, public.labyrinth_highscores from anon;
revoke truncate, references, trigger on public.labyrinth_scores, public.labyrinth_highscores from authenticated;
grant select, insert on public.labyrinth_scores to authenticated;
grant select on public.labyrinth_highscores to authenticated;
grant select, insert, update, delete on public.labyrinth_scores to service_role;
grant select on public.labyrinth_highscores to service_role;
