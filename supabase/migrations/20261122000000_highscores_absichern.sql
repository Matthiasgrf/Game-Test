-- =====================================================================
-- Highscores absichern
--
-- Bisher hat der Browser jedes Ergebnis selbst in game_scores eingetragen.
-- Per DevTools liess sich so jeder beliebige Wert speichern.
--
--   1) Zahlenraten laeuft jetzt in der Datenbank: Die Geheimzahl liegt in
--      zahlenraten_runden (fuer Clients gesperrt). Die App ruft nur
--      zahlenraten_start() und zahlenraten_raten() auf; bei einem Treffer
--      speichert die Datenbank das Ergebnis selbst.
--   2) Alle anderen Spiele laufen im Browser – dort ist echte Faelschungs-
--      sicherheit nicht moeglich. Ein Trigger prueft deshalb jedes Ergebnis,
--      das der Browser direkt eintraegt, auf Plausibilitaet:
--        - es gibt einen Spielstart (game_plays) aus den letzten 12 Stunden,
--          und die gemeldete Zeit (seconds) passt dazu
--        - hoechstens ein Ergebnis je Spiel alle 3 Sekunden
--        - hoechstens 300 Ergebnisse je Spieler und Tag
--        - Spiele mit games.server_scored = true nehmen gar keine Ergebnisse
--          vom Browser an (wird fuer Zahlenraten erst nach dem Deploy in
--          20261122000100_zahlenraten_nur_server.sql gesetzt)
--   3) Die alten Tabellen scores / labyrinth_scores nimmt die App seit
--      game_scores nicht mehr – Schreibrechte entfernen.
--
-- Rueckwaertskompatibel: Die veroeffentlichte App meldet Spielstarts schon
-- (useGamePlay) und speichert Zahlenraten bis zum Deploy weiter direkt.
-- =====================================================================

-- ---------- games.server_scored ---------------------------------------
alter table public.games
  add column server_scored boolean not null default false;

comment on column public.games.server_scored is
  'true = Ergebnisse speichert nur die Datenbank selbst (z. B. Zahlenraten), nie der Browser';

-- ---------- Plausibilitaetspruefung fuer Browser-Ergebnisse -----------
-- Gibt den Grund zurueck, warum ein Ergebnis nicht passt, sonst null.
-- security definer: liest game_plays/game_scores des Users, die er per RLS
-- nicht (vollstaendig) sehen darf.
create function public.score_problem(p_game_key text, p_seconds integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'Nicht eingeloggt.';
  end if;

  if exists (select 1 from public.games g where g.key = p_game_key and g.server_scored) then
    return 'Dieses Spiel speichert Ergebnisse selbst.';
  end if;

  -- Spielstart muss vor Beginn der gemeldeten Spielzeit liegen
  -- (60 s Toleranz fuer Netz und Uhren).
  if not exists (
    select 1 from public.game_plays p
    where p.user_id = v_uid
      and p.game_key = p_game_key
      and p.started_at > now() - interval '12 hours'
      and p.started_at <= now() - make_interval(secs => coalesce(p_seconds, 0)) + interval '60 seconds'
  ) then
    return 'Kein passender Spielstart gefunden.';
  end if;

  if exists (
    select 1 from public.game_scores s
    where s.user_id = v_uid and s.game_key = p_game_key
      and s.created_at > now() - interval '3 seconds'
  ) then
    return 'Zu viele Ergebnisse auf einmal.';
  end if;

  if (select count(*) from public.game_scores s
      where s.user_id = v_uid and s.created_at > now() - interval '1 day') >= 300 then
    return 'Zu viele Ergebnisse heute.';
  end if;

  return null;
end;
$$;

revoke execute on function public.score_problem(text, integer) from public, anon;
grant execute on function public.score_problem(text, integer) to authenticated;

-- Trigger-Funktion laeuft als Aufrufer (kein security definer): So ist
-- current_user beim Browser 'authenticated', in den Server-Funktionen
-- (security definer, z. B. zahlenraten_raten) aber der Eigentuemer – deren
-- Ergebnisse werden nicht geprueft.
create function public.game_scores_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_problem text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_problem := public.score_problem(new.game_key, new.seconds);
  if v_problem is not null then
    raise exception 'Ergebnis nicht gespeichert: %', v_problem using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.game_scores_check() from public, anon, authenticated;

create trigger game_scores_check
  before insert on public.game_scores
  for each row execute function public.game_scores_check();

-- ---------- Zahlenraten in der Datenbank ------------------------------
create table public.zahlenraten_runden (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  secret      integer not null check (secret between 1 and 100),
  attempts    integer not null default 0 check (attempts >= 0),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

-- Pro Spieler hoechstens eine offene Runde. Eine schlechte Runde durch
-- Neuladen verwerfen geht nicht: zahlenraten_start() setzt sie fort.
create unique index zahlenraten_runden_offen_idx
  on public.zahlenraten_runden (user_id) where finished_at is null;
create index zahlenraten_runden_user_id_idx on public.zahlenraten_runden (user_id);

alter table public.zahlenraten_runden enable row level security;
-- Absichtlich keine Policy und keine Rechte fuer Clients: nur die beiden
-- Funktionen unten greifen zu (die Geheimzahl bleibt verborgen).
revoke all on public.zahlenraten_runden from anon, authenticated;
grant select, insert, update, delete on public.zahlenraten_runden to service_role;

-- Offene Runde fortsetzen oder neue starten.
-- Ergebnis: {"runde": id, "versuche": n}
create function public.zahlenraten_start()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r     public.zahlenraten_runden%rowtype;
begin
  if v_uid is null or not public.can_play('zahlenraten') then
    raise exception 'Zahlenraten ist für dich nicht freigegeben.' using errcode = '42501';
  end if;

  select * into r
  from public.zahlenraten_runden
  where user_id = v_uid and finished_at is null;

  if not found then
    insert into public.zahlenraten_runden (user_id, secret)
    values (v_uid, 1 + floor(random() * 100)::integer)
    returning * into r;
  end if;

  return jsonb_build_object('runde', r.id, 'versuche', r.attempts);
end;
$$;

-- Einen Tipp auswerten. Bei Treffer wird das Ergebnis gespeichert.
-- Ergebnis: {"ergebnis": "zu_klein"|"zu_gross"|"richtig", "versuche": n}
create function public.zahlenraten_raten(p_runde bigint, p_tipp integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  r        public.zahlenraten_runden%rowtype;
  v_result text;
begin
  if v_uid is null or not public.can_play('zahlenraten') then
    raise exception 'Zahlenraten ist für dich nicht freigegeben.' using errcode = '42501';
  end if;
  if p_tipp is null or p_tipp not between 1 and 100 then
    raise exception 'Bitte eine ganze Zahl von 1 bis 100 eingeben.' using errcode = '22023';
  end if;

  -- for update: gleichzeitige Tipps auf dieselbe Runde nacheinander auswerten
  select * into r
  from public.zahlenraten_runden
  where id = p_runde and user_id = v_uid and finished_at is null
  for update;

  if not found then
    raise exception 'Diese Runde ist schon vorbei.' using errcode = 'P0002';
  end if;

  r.attempts := r.attempts + 1;
  v_result := case
    when p_tipp < r.secret then 'zu_klein'
    when p_tipp > r.secret then 'zu_gross'
    else 'richtig'
  end;

  update public.zahlenraten_runden
  set attempts    = r.attempts,
      finished_at = case when v_result = 'richtig' then now() end
  where id = r.id;

  if v_result = 'richtig' then
    insert into public.game_scores (user_id, game_key, points)
    values (v_uid, 'zahlenraten', r.attempts);
  end if;

  return jsonb_build_object('ergebnis', v_result, 'versuche', r.attempts);
end;
$$;

revoke execute on function public.zahlenraten_start() from public, anon;
revoke execute on function public.zahlenraten_raten(bigint, integer) from public, anon;
grant execute on function public.zahlenraten_start() to authenticated;
grant execute on function public.zahlenraten_raten(bigint, integer) to authenticated;

-- ---------- alte Tabellen: kein Schreiben mehr ------------------------
drop policy "scores: users insert own" on public.scores;
drop policy "labyrinth_scores: users insert own" on public.labyrinth_scores;
revoke insert on public.scores, public.labyrinth_scores from authenticated;
