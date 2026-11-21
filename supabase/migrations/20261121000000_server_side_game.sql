-- =====================================================================
-- Serverseitige Spiellogik: Highscores absichern
--
-- Vorher: Geheimzahl + Versuche lagen im Browser, der Client hat seinen
-- Score selbst in public.scores eingetragen -> per DevTools faelschbar.
--
-- Jetzt:
--   games          : laufende/beendete Runden inkl. Geheimzahl. Fuer
--                    Client-Rollen komplett gesperrt (kein GRANT, keine Policy).
--   start_game()   : setzt die offene Runde fort oder startet eine neue.
--   guess(id, n)   : wertet einen Tipp aus; bei Treffer schreibt die
--                    Funktion den Score selbst.
--   scores         : Clients duerfen nur noch lesen.
-- =====================================================================

-- ---------- games -----------------------------------------------------
create table public.games (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  secret      integer not null check (secret between 1 and 100),
  attempts    integer not null default 0 check (attempts >= 0),
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- Pro User hoechstens eine offene Runde. Neu starten, um eine schlechte
-- Runde zu verwerfen, geht damit nicht: start_game() setzt sie fort.
create unique index games_one_open_per_user_idx
  on public.games (user_id) where finished_at is null;
create index games_user_id_idx on public.games (user_id);

alter table public.games enable row level security;
-- Absichtlich keine Policy: nur die security-definer-Funktionen unten
-- (und service_role) greifen auf die Tabelle zu.
revoke all on public.games from anon, authenticated;
grant select, insert, update, delete on public.games to service_role;

-- ---------- scores: kein direkter Insert mehr -------------------------
drop policy "scores: users insert own" on public.scores;
revoke insert on public.scores from authenticated;

-- Wer mehr als 100 Versuche braucht, soll trotzdem gewertet werden
-- (sonst wuerde guess() beim Treffer am Check scheitern).
alter table public.scores drop constraint scores_attempts_check;
alter table public.scores add constraint scores_attempts_check check (attempts >= 1);

-- ---------- start_game ------------------------------------------------
-- Liefert die offene Runde des Users (fortsetzen) oder legt eine neue an.
create function public.start_game()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  g   public.games%rowtype;
begin
  if uid is null then
    raise exception 'Nicht eingeloggt' using errcode = '28000';
  end if;

  select * into g
  from public.games
  where user_id = uid and finished_at is null;

  if not found then
    insert into public.games (user_id, secret)
    values (uid, 1 + floor(random() * 100)::integer)
    returning * into g;
  end if;

  return jsonb_build_object('game_id', g.id, 'attempts', g.attempts);
end;
$$;

-- ---------- guess -----------------------------------------------------
-- Ergebnis: {"result": "low"|"high"|"correct", "attempts": n}
create function public.guess(p_game_id bigint, p_guess integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  g      public.games%rowtype;
  result text;
begin
  if uid is null then
    raise exception 'Nicht eingeloggt' using errcode = '28000';
  end if;
  if p_guess is null or p_guess not between 1 and 100 then
    raise exception 'Bitte eine ganze Zahl von 1 bis 100 eingeben.' using errcode = '22023';
  end if;

  -- FOR UPDATE: parallele Tipps auf dieselbe Runde werden serialisiert
  select * into g
  from public.games
  where id = p_game_id and user_id = uid and finished_at is null
  for update;

  if not found then
    raise exception 'Runde nicht gefunden oder bereits beendet' using errcode = 'P0002';
  end if;

  g.attempts := g.attempts + 1;
  result := case
    when p_guess < g.secret then 'low'
    when p_guess > g.secret then 'high'
    else 'correct'
  end;

  update public.games
  set attempts    = g.attempts,
      finished_at = case when result = 'correct' then now() end
  where id = g.id;

  if result = 'correct' then
    insert into public.scores (user_id, attempts) values (uid, g.attempts);
  end if;

  return jsonb_build_object('result', result, 'attempts', g.attempts);
end;
$$;

-- Nur eingeloggte User duerfen spielen
revoke execute on function public.start_game() from public, anon;
revoke execute on function public.guess(bigint, integer) from public, anon;
grant execute on function public.start_game() to authenticated;
grant execute on function public.guess(bigint, integer) to authenticated;
