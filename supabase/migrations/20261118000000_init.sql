-- =====================================================================
-- Game-Test: Grundschema
--   profiles  : ein Eintrag pro Auth-User (Username + Rolle)
--   scores    : Ergebnisse des Zahlenraten-Spiels
--   highscores: View mit den besten Ergebnissen inkl. Username
-- =====================================================================

-- ---------- profiles --------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Eingeloggte User duerfen Usernames/Rollen lesen (fuer Highscores & UI).
-- Schreiben ist vom Client aus NICHT erlaubt (keine Policy) -> nur die
-- Edge Function mit Service-Role-Key kann Profile aendern.
create policy "profiles: authenticated can read"
  on public.profiles for select
  to authenticated
  using (true);

-- Trigger: legt beim Anlegen eines Auth-Users automatisch ein Profil an.
--   username: aus user_metadata.username, sonst Teil vor dem @ der E-Mail
--   role    : aus app_metadata.role (nur per Service-Role setzbar), sonst 'user'
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(new.raw_app_meta_data ->> 'role', 'user')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- scores ----------------------------------------------------
create table public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  attempts   integer not null check (attempts between 1 and 100),
  created_at timestamptz not null default now()
);

create index scores_user_id_idx on public.scores (user_id);
create index scores_attempts_idx on public.scores (attempts, created_at);

alter table public.scores enable row level security;

create policy "scores: authenticated can read"
  on public.scores for select
  to authenticated
  using (true);

create policy "scores: users insert own"
  on public.scores for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- ---------- highscores view ------------------------------------------
-- security_invoker: die View laeuft mit den Rechten des Aufrufers,
-- d.h. die RLS-Policies oben gelten weiterhin.
create view public.highscores
with (security_invoker = true) as
select s.id, p.username, s.attempts, s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
order by s.attempts asc, s.created_at asc
limit 10;

revoke all on public.highscores from anon;
grant select on public.highscores to authenticated;
