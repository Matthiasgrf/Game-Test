-- =====================================================================
-- Gruppen: User und Spiele werden Gruppen zugeordnet.
--   groups      : z.B. Klasse-3c, Fisser-Flitzer, Kindergarten, Alle
--   user_groups : welcher User in welchen Gruppen ist (n:m)
--   game_groups : welches Spiel fuer welche Gruppen freigegeben ist (n:m)
-- Ein User sieht ein Spiel, wenn er in mindestens einer Gruppe des Spiels
-- ist. Admins sehen immer alle Spiele. Nur Admins duerfen zuordnen.
-- =====================================================================

-- ---------- Hilfsfunktion: ist der Aufrufer Admin? --------------------
-- security definer + leerer search_path: liest profiles ohne RLS-Rekursion.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- groups ----------------------------------------------------
create table public.groups (
  id         bigint generated always as identity primary key,
  name       text not null unique check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create policy "groups: authenticated can read"
  on public.groups for select to authenticated using (true);
create policy "groups: admin insert"
  on public.groups for insert to authenticated with check ((select public.is_admin()));
create policy "groups: admin update"
  on public.groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "groups: admin delete"
  on public.groups for delete to authenticated using ((select public.is_admin()));

-- ---------- user_groups -----------------------------------------------
create table public.user_groups (
  user_id  uuid   not null references public.profiles (id) on delete cascade,
  group_id bigint not null references public.groups (id) on delete cascade,
  primary key (user_id, group_id)
);

create index user_groups_group_id_idx on public.user_groups (group_id);

alter table public.user_groups enable row level security;

-- Jeder sieht nur seine eigenen Gruppen, der Admin sieht alle.
create policy "user_groups: read own or admin"
  on public.user_groups for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "user_groups: admin insert"
  on public.user_groups for insert to authenticated with check ((select public.is_admin()));
create policy "user_groups: admin delete"
  on public.user_groups for delete to authenticated using ((select public.is_admin()));

-- ---------- game_groups -----------------------------------------------
-- game_key = Kennung des Spiels im Frontend (src/pages/Overview.tsx, GAMES)
create table public.game_groups (
  game_key text   not null check (game_key ~ '^[a-z0-9_-]{1,40}$'),
  group_id bigint not null references public.groups (id) on delete cascade,
  primary key (game_key, group_id)
);

create index game_groups_group_id_idx on public.game_groups (group_id);

alter table public.game_groups enable row level security;

create policy "game_groups: authenticated can read"
  on public.game_groups for select to authenticated using (true);
create policy "game_groups: admin insert"
  on public.game_groups for insert to authenticated with check ((select public.is_admin()));
create policy "game_groups: admin delete"
  on public.game_groups for delete to authenticated using ((select public.is_admin()));

-- ---------- darf der Aufrufer dieses Spiel spielen? -------------------
create function public.can_play(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.game_groups gg
    join public.user_groups ug on ug.group_id = gg.group_id
    where gg.game_key = p_game_key and ug.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.can_play(text) from public, anon;
grant execute on function public.can_play(text) to authenticated;

-- Ergebnisse nur speichern, wenn das Spiel fuer den User freigegeben ist.
drop policy "scores: users insert own" on public.scores;
create policy "scores: users insert own"
  on public.scores for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.can_play('zahlenraten')));

drop policy "labyrinth_scores: users insert own" on public.labyrinth_scores;
create policy "labyrinth_scores: users insert own"
  on public.labyrinth_scores for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.can_play('labyrinth')));

-- ---------- Rechte (siehe 20261118000100_grants.sql) ------------------
revoke all on public.groups, public.user_groups, public.game_groups from anon;
revoke truncate, references, trigger on public.groups, public.user_groups, public.game_groups from authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, delete on public.user_groups, public.game_groups to authenticated;
grant select, insert, update, delete on public.groups, public.user_groups, public.game_groups to service_role;

-- ---------- Startdaten ------------------------------------------------
insert into public.groups (name) values
  ('Klasse-3c'), ('Fisser-Flitzer'), ('Kindergarten'), ('Alle');

insert into public.game_groups (game_key, group_id)
select g.key, gr.id
from (values ('labyrinth'), ('zahlenraten')) as g(key)
cross join public.groups gr
where gr.name = 'Kindergarten';

-- Bestehende Spieler behalten Zugriff auf ihre bisherigen Spiele.
insert into public.user_groups (user_id, group_id)
select p.id, gr.id
from public.profiles p
cross join public.groups gr
where p.role = 'user' and gr.name = 'Kindergarten';
