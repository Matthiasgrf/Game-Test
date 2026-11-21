-- =====================================================================
-- Highscores nach Gruppen
--   Spieler sehen nur Ergebnisse von Mitspielern aus ihren Gruppen und nur
--   fuer Spiele, die diesen Gruppen zugeordnet sind. Admins sehen alles.
--   Die Bestenlisten werden je Gruppe berechnet (Spalte group_id).
-- =====================================================================

-- Gruppen des Aufrufers (Admin: alle Gruppen).
-- security definer: liest user_groups ohne RLS -> keine Rekursion in der Policy.
create function public.my_group_ids()
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select ug.group_id from public.user_groups ug where ug.user_id = (select auth.uid())
  union
  select g.id from public.groups g where public.is_admin();
$$;

revoke execute on function public.my_group_ids() from public, anon;
grant execute on function public.my_group_ids() to authenticated;

-- Mitgliedschaften: sichtbar fuer alle Gruppen, in denen man selbst ist
-- (noetig, damit die Gruppen-Bestenliste die Mitspieler findet).
drop policy "user_groups: read own or admin" on public.user_groups;
create policy "user_groups: read own groups"
  on public.user_groups for select to authenticated
  using (user_id = (select auth.uid()) or group_id in (select public.my_group_ids()));

-- Ergebnis sichtbar, wenn eigenes, Admin, oder der Spieler ist mit mir in einer
-- Gruppe, fuer die das Spiel freigegeben ist.
create function public.can_see_score(p_user_id uuid, p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
      or public.is_admin()
      or exists (
        select 1
        from public.user_groups mine
        join public.user_groups theirs on theirs.group_id = mine.group_id
        join public.game_groups gg on gg.group_id = mine.group_id
        where mine.user_id = (select auth.uid())
          and theirs.user_id = p_user_id
          and gg.game_key = p_game_key
      );
$$;

revoke execute on function public.can_see_score(uuid, text) from public, anon;
grant execute on function public.can_see_score(uuid, text) to authenticated;

drop policy "scores: authenticated can read" on public.scores;
create policy "scores: read same group"
  on public.scores for select to authenticated
  using (public.can_see_score(user_id, 'zahlenraten'));

drop policy "labyrinth_scores: authenticated can read" on public.labyrinth_scores;
create policy "labyrinth_scores: read same group"
  on public.labyrinth_scores for select to authenticated
  using (public.can_see_score(user_id, 'labyrinth'));

-- ---------- Bestenlisten je Gruppe -----------------------------------
-- security_invoker: RLS oben filtert Gruppen, Mitglieder und Ergebnisse.
drop view public.highscores;
create view public.highscores
with (security_invoker = true) as
with scoped as (
  select s.id, s.user_id, s.attempts, s.created_at, gg.group_id
  from public.scores s
  join public.user_groups ug on ug.user_id = s.user_id
  join public.game_groups gg on gg.group_id = ug.group_id and gg.game_key = 'zahlenraten'
), ranked as (
  select sc.*, row_number() over (partition by sc.group_id order by sc.attempts asc, sc.created_at asc) as rank
  from scoped sc
)
select r.id, r.group_id, r.rank, p.username, r.attempts, r.created_at
from ranked r
join public.profiles p on p.id = r.user_id
where r.rank <= 10;

drop view public.labyrinth_highscores;
create view public.labyrinth_highscores
with (security_invoker = true) as
with scoped as (
  select s.id, s.user_id, s.mode, s.stars, s.max_stars, s.seconds, s.created_at, gg.group_id
  from public.labyrinth_scores s
  join public.user_groups ug on ug.user_id = s.user_id
  join public.game_groups gg on gg.group_id = ug.group_id and gg.game_key = 'labyrinth'
), best as (
  select distinct on (sc.group_id, sc.user_id, sc.mode) sc.*
  from scoped sc
  order by sc.group_id, sc.user_id, sc.mode, sc.stars desc, sc.seconds asc, sc.created_at asc
), ranked as (
  select b.*, row_number() over (
    partition by b.group_id, b.mode order by b.stars desc, b.seconds asc, b.created_at asc
  ) as rank
  from best b
)
select r.id, r.group_id, r.mode, r.rank, p.username, r.stars, r.max_stars, r.seconds, r.created_at
from ranked r
join public.profiles p on p.id = r.user_id
where r.rank <= 10;

-- Rechte der neu angelegten Views (siehe 20261118000100_grants.sql)
revoke all on public.highscores, public.labyrinth_highscores from anon;
revoke truncate, references, trigger on public.highscores, public.labyrinth_highscores from authenticated;
grant select on public.highscores, public.labyrinth_highscores to authenticated, service_role;
