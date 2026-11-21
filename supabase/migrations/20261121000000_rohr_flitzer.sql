-- =====================================================================
-- Rohr-Flitzer (Spiel der Gruppe Fisser-Flitzer)
--   rohr_scores    : Zeit in ms, bis die Wurst in der Kanalisation ist
--   rohr_highscores: Top 10 (schnellste Zeiten) inkl. Username
-- =====================================================================

create table public.rohr_scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- unter 3 s ist physikalisch unmoeglich, ueber 60 s ist das Rohr eingetrocknet
  time_ms    integer not null check (time_ms between 3000 and 60000),
  created_at timestamptz not null default now()
);

create index rohr_scores_user_id_idx on public.rohr_scores (user_id);
create index rohr_scores_time_idx on public.rohr_scores (time_ms, created_at);

alter table public.rohr_scores enable row level security;

create policy "rohr_scores: authenticated can read"
  on public.rohr_scores for select
  to authenticated
  using (true);

create policy "rohr_scores: users insert own"
  on public.rohr_scores for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create view public.rohr_highscores
with (security_invoker = true) as
select s.id, p.username, s.time_ms, s.created_at
from public.rohr_scores s
join public.profiles p on p.id = s.user_id
order by s.time_ms asc, s.created_at asc
limit 10;

-- GRANTs (siehe 20261118000100_grants.sql)
revoke all on public.rohr_scores, public.rohr_highscores from anon;
revoke truncate, references, trigger on public.rohr_scores, public.rohr_highscores from authenticated;
grant select, insert on public.rohr_scores to authenticated;
grant select on public.rohr_highscores to authenticated;
grant select, insert, update, delete on public.rohr_scores to service_role;
grant select on public.rohr_highscores to service_role;
