-- =====================================================================
-- Security-Hardening
--   1) admin_audit_log : Protokoll aller Admin-/Passwort-Aktionen
--   2) Spiel serverseitig: Geheimzahl + Versuche liegen in der DB,
--      Scores entstehen nur noch ueber guess() -> nicht faelschbar
--   3) Datensparsamkeit: profiles/scores nur noch eigene Zeilen lesbar,
--      Highscores ueber get_highscores() (nur Username + Versuche)
-- =====================================================================

-- ---------- 1) Audit-Log ---------------------------------------------
create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid not null,
  action     text not null,
  target_id  uuid,
  success    boolean not null,
  detail     text,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- RLS an, keine Policy: nur service_role (Edge Function) kommt ran
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select, insert on public.admin_audit_log to service_role;

-- ---------- 2) Serverseitiges Spiel ----------------------------------
create table public.game_rounds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  secret     integer not null check (secret between 1 and 100),
  attempts   integer not null default 0,
  finished   boolean not null default false,
  created_at timestamptz not null default now()
);
create index game_rounds_user_created_idx on public.game_rounds (user_id, created_at desc);

-- Kein Client-Zugriff auf die Tabelle (secret!) – nur ueber die Funktionen
alter table public.game_rounds enable row level security;
revoke all on public.game_rounds from anon, authenticated;
grant select, insert, update, delete on public.game_rounds to service_role;

-- Neue Runde starten. Rate-Limit gegen "so lange neu starten bis Zufallstreffer".
create function public.start_round()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if (select count(*) from public.game_rounds
      where user_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Zu viele Runden – bitte spaeter erneut versuchen' using errcode = 'P0001';
  end if;

  -- offene Runden des Users schliessen
  update public.game_rounds set finished = true
   where user_id = uid and not finished;

  insert into public.game_rounds (user_id, secret)
  values (uid, 1 + floor(random() * 100)::int)
  returning id into rid;
  return rid;
end;
$$;

-- Tipp abgeben: liefert 'low' | 'high' | 'correct' | 'over' und die Versuche.
create function public.guess(p_round uuid, p_guess integer)
returns table (result text, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  r public.game_rounds%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_guess is null or p_guess < 1 or p_guess > 100 then
    raise exception 'Tipp muss zwischen 1 und 100 liegen' using errcode = '22023';
  end if;

  select * into r from public.game_rounds g
   where g.id = p_round and g.user_id = uid and not g.finished
   for update;
  if not found then
    raise exception 'Runde nicht gefunden oder beendet' using errcode = 'P0002';
  end if;

  r.attempts := r.attempts + 1;

  if p_guess = r.secret then
    update public.game_rounds g set attempts = r.attempts, finished = true where g.id = r.id;
    insert into public.scores (user_id, attempts) values (uid, r.attempts);
    return query select 'correct'::text, r.attempts;
  elsif r.attempts >= 100 then
    update public.game_rounds g set attempts = r.attempts, finished = true where g.id = r.id;
    return query select 'over'::text, r.attempts;
  else
    update public.game_rounds g set attempts = r.attempts where g.id = r.id;
    return query select (case when p_guess < r.secret then 'low' else 'high' end)::text, r.attempts;
  end if;
end;
$$;

revoke execute on function public.start_round() from public, anon;
revoke execute on function public.guess(uuid, integer) from public, anon;
grant execute on function public.start_round() to authenticated;
grant execute on function public.guess(uuid, integer) to authenticated;

-- Scores darf der Client nicht mehr direkt schreiben
drop policy "scores: users insert own" on public.scores;
revoke insert on public.scores from authenticated;

-- ---------- 3) Datensparsamkeit --------------------------------------
-- profiles: nur das eigene Profil (Rollen anderer User nicht mehr sichtbar)
drop policy "profiles: authenticated can read" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- scores: nur eigene Zeilen
drop policy "scores: authenticated can read" on public.scores;
create policy "scores: read own"
  on public.scores for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Highscores: View ersetzt durch Funktion, die bewusst nur
-- Username, Versuche und Datum der Top 10 herausgibt.
drop view public.highscores;

create function public.get_highscores()
returns table (id bigint, username text, attempts integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, p.username, s.attempts, s.created_at
    from public.scores s
    join public.profiles p on p.id = s.user_id
   order by s.attempts asc, s.created_at asc
   limit 10;
$$;

revoke execute on function public.get_highscores() from public, anon;
grant execute on function public.get_highscores() to authenticated;
