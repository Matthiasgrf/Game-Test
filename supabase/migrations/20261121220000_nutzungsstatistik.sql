-- =====================================================================
-- Nutzungsstatistik fuer das Admin-Dashboard
--   game_plays      : ein Eintrag je Spielstart (Spiel geoeffnet), dazu
--                     last_active_at -> daraus ergibt sich die Spielzeit.
--                     Die App meldet sich alle 30 s, solange das Spiel sichtbar ist.
--   game_play_start : RPC, legt einen Spielstart an (nur freigegebene Spiele)
--   game_play_ping  : RPC, setzt last_active_at = now() (Serverzeit)
--   admin_stats     : RPC, alle Kennzahlen als JSON – nur fuer Admins
-- Nur neue Objekte -> rueckwaertskompatibel. Startzeitpunkt der Messung =
-- erster Eintrag in game_plays; Ergebnisse (game_scores) gibt es schon laenger.
-- =====================================================================

-- ---------- game_plays ------------------------------------------------
create table public.game_plays (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_key       text not null references public.games (key) on delete cascade,
  started_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  check (last_active_at >= started_at)
);

create index game_plays_started_at_idx on public.game_plays (started_at);
create index game_plays_user_id_idx on public.game_plays (user_id);
create index game_plays_game_key_idx on public.game_plays (game_key, started_at);
create index game_scores_created_at_idx on public.game_scores (created_at);

alter table public.game_plays enable row level security;

-- Lesen nur fuer Admins. Schreiben nur ueber die beiden Funktionen unten
-- (keine Insert/Update-Policy) -> Zeiten kommen immer vom Server.
create policy "game_plays: admin read"
  on public.game_plays for select to authenticated
  using ((select public.is_admin()));

-- ---------- Spielstart melden ----------------------------------------
create function public.game_play_start(p_game_key text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
begin
  if v_uid is null or not public.can_play(p_game_key)
     or not exists (select 1 from public.games g where g.key = p_game_key) then
    return null;
  end if;
  -- Doppelte Meldungen (Neuladen, React StrictMode) innerhalb von 5 s zusammenfassen
  select p.id into v_id
  from public.game_plays p
  where p.user_id = v_uid and p.game_key = p_game_key
    and p.started_at > now() - interval '5 seconds'
  order by p.started_at desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.game_plays (user_id, game_key) values (v_uid, p_game_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- "spielt noch" melden -------------------------------------
-- Hoechstens 3 Stunden nach dem Start, danach zaehlt eine Sitzung nicht weiter.
create function public.game_play_ping(p_id bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.game_plays
  set last_active_at = now()
  where id = p_id
    and user_id = (select auth.uid())
    and started_at > now() - interval '3 hours';
$$;

-- ---------- Kennzahlen fuer das Dashboard ----------------------------
-- p_days          : Zeitraum in Tagen (1–365), Tage nach deutscher Zeit
-- p_include_admins: Admins mitzaehlen? (Standard: nein – sonst zaehlen Tests mit)
create function public.admin_stats(p_days integer default 30, p_include_admins boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     constant text := 'Europe/Berlin';
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today  date := (now() at time zone 'Europe/Berlin')::date;
  v_day0   timestamptz := (v_today::timestamp at time zone 'Europe/Berlin');
  v_from   timestamptz := ((v_today - (v_days - 1))::timestamp at time zone 'Europe/Berlin');
  v_prev   timestamptz := ((v_today - (2 * v_days - 1))::timestamp at time zone 'Europe/Berlin');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Nur für Admins' using errcode = '42501';
  end if;

  with
  counted as (           -- Nutzer, die in die Statistik eingehen
    select pr.id from public.profiles pr
    where p_include_admins or pr.role = 'user'
  ),
  plays as (
    select p.user_id, p.game_key, p.started_at as at,
           extract(epoch from least(p.last_active_at, p.started_at + interval '3 hours') - p.started_at)::integer as secs
    from public.game_plays p
    join counted c on c.id = p.user_id
    where p.started_at >= v_prev
  ),
  scores as (
    select s.user_id, s.game_key, s.created_at as at
    from public.game_scores s
    join counted c on c.id = s.user_id
  ),
  -- Aktivitaet = Spielstart oder gespeichertes Ergebnis
  activity as (
    select user_id, game_key, at from plays
    union all
    select user_id, game_key, at from scores
  ),
  cur  as (select * from activity where at >= v_from),
  days as (
    select d::date as day
    from generate_series((v_today - (v_days - 1))::timestamp, v_today::timestamp, interval '1 day') d
  ),
  per_user as (
    select pr.id, pr.username, pr.role, pr.created_at, au.last_sign_in_at,
      (select max(a.at) from activity a where a.user_id = pr.id) as last_active,
      (select count(*) from plays p where p.user_id = pr.id and p.at >= v_from) as plays,
      (select coalesce(sum(p.secs), 0) from plays p where p.user_id = pr.id and p.at >= v_from) as play_seconds,
      (select count(*) from scores s where s.user_id = pr.id and s.at >= v_from) as scores,
      (select count(distinct (a.at at time zone v_tz)::date) from cur a where a.user_id = pr.id) as active_days,
      (select count(distinct a.game_key) from cur a where a.user_id = pr.id) as games,
      (select a.game_key from cur a where a.user_id = pr.id
         group by a.game_key order by count(*) desc, a.game_key limit 1) as top_game,
      (select coalesce(jsonb_agg(g.name order by g.name), '[]'::jsonb)
         from public.user_groups ug join public.groups g on g.id = ug.group_id
         where ug.user_id = pr.id) as groups,
      exists (select 1 from scores s where s.user_id = pr.id)
        or exists (select 1 from public.game_plays gp where gp.user_id = pr.id) as ever_played
    from public.profiles pr
    join counted c on c.id = pr.id
    left join auth.users au on au.id = pr.id
  )
  select jsonb_build_object(
    'generated_at',   now(),
    'period_days',    v_days,
    'from',           v_from,
    'include_admins', p_include_admins,
    'tracking_since', (select min(started_at) from public.game_plays),

    'users', (select jsonb_build_object(
      'total',          count(*),
      'new_in_period',  count(*) filter (where u.created_at >= v_from),
      'active_today',   count(*) filter (where u.last_active >= v_day0),
      'active_7d',      count(*) filter (where u.last_active >= v_day0 - interval '6 days'),
      'active_30d',     count(*) filter (where u.last_active >= v_day0 - interval '29 days'),
      'active_period',  count(*) filter (where u.last_active >= v_from),
      'active_prev',    (select count(distinct a.user_id) from activity a where a.at >= v_prev and a.at < v_from),
      'login_7d',       count(*) filter (where u.last_sign_in_at >= now() - interval '7 days'),
      'never_played',   count(*) filter (where not u.ever_played),
      'without_group',  count(*) filter (where u.groups = '[]'::jsonb)
    ) from per_user u),

    'totals', jsonb_build_object(
      'plays',             (select count(*) from plays where at >= v_from),
      'plays_prev',        (select count(*) from plays where at < v_from),
      'scores',            (select count(*) from scores where at >= v_from),
      'scores_prev',       (select count(*) from scores where at >= v_prev and at < v_from),
      'play_seconds',      (select coalesce(sum(secs), 0) from plays where at >= v_from),
      'play_seconds_prev', (select coalesce(sum(secs), 0) from plays where at < v_from),
      'short_plays',       (select count(*) from plays where at >= v_from and secs < 30),
      'games_played',      (select count(distinct game_key) from cur),
      'games_total',       (select count(*) from public.games)
    ),

    'daily', (select jsonb_agg(jsonb_build_object(
        'day',     d.day,
        'users',   (select count(distinct a.user_id) from cur a where (a.at at time zone v_tz)::date = d.day),
        'plays',   (select count(*) from plays p where p.at >= v_from and (p.at at time zone v_tz)::date = d.day),
        'scores',  (select count(*) from scores s where s.at >= v_from and (s.at at time zone v_tz)::date = d.day),
        'minutes', (select coalesce(round(sum(p.secs) / 60.0), 0) from plays p
                      where p.at >= v_from and (p.at at time zone v_tz)::date = d.day)
      ) order by d.day) from days d),

    -- Aktivitaet nach Uhrzeit (0–23) und Wochentag (1 = Montag … 7 = Sonntag)
    'hours', (select jsonb_agg(jsonb_build_object('hour', h,
        'count', (select count(*) from cur a where extract(hour from a.at at time zone v_tz) = h)
      ) order by h) from generate_series(0, 23) h),
    'weekdays', (select jsonb_agg(jsonb_build_object('dow', w,
        'count', (select count(*) from cur a where extract(isodow from a.at at time zone v_tz) = w)
      ) order by w) from generate_series(1, 7) w),

    'games', (select coalesce(jsonb_agg(to_jsonb(x) order by x.plays desc, x.scores desc, x.game_key), '[]'::jsonb) from (
      select g.key as game_key, g.highscore,
        (select count(*) from plays p where p.game_key = g.key and p.at >= v_from) as plays,
        (select count(*) from plays p where p.game_key = g.key and p.at < v_from) as plays_prev,
        (select count(distinct a.user_id) from cur a where a.game_key = g.key) as players,
        (select count(*) from scores s where s.game_key = g.key and s.at >= v_from) as scores,
        (select coalesce(sum(p.secs), 0) from plays p where p.game_key = g.key and p.at >= v_from) as play_seconds,
        (select count(*) from plays p where p.game_key = g.key and p.at >= v_from and p.secs < 30) as short_plays,
        (select max(a.at) from activity a where a.game_key = g.key) as last_played,
        -- Wie viele (gezaehlte) Nutzer duerfen das Spiel spielen?
        (select count(distinct ug.user_id)
           from public.game_groups gg
           join public.user_groups ug on ug.group_id = gg.group_id
           join counted c on c.id = ug.user_id
           where gg.game_key = g.key) as eligible
      from public.games g
    ) x),

    'groups', (select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb) from (
      select gr.name,
        (select count(*) from public.user_groups ug join counted c on c.id = ug.user_id
           where ug.group_id = gr.id) as members,
        (select count(distinct a.user_id) from cur a
           join public.user_groups ug on ug.user_id = a.user_id and ug.group_id = gr.id) as active,
        (select count(*) from plays p
           join public.user_groups ug on ug.user_id = p.user_id and ug.group_id = gr.id
           where p.at >= v_from) as plays,
        (select coalesce(sum(p.secs), 0) from plays p
           join public.user_groups ug on ug.user_id = p.user_id and ug.group_id = gr.id
           where p.at >= v_from) as play_seconds,
        (select count(*) from public.game_groups gg where gg.group_id = gr.id) as games
      from public.groups gr
    ) x),

    'user_list', (select coalesce(jsonb_agg(jsonb_build_object(
        'username', u.username, 'role', u.role, 'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at, 'last_active', u.last_active,
        'plays', u.plays, 'play_seconds', u.play_seconds, 'scores', u.scores,
        'active_days', u.active_days, 'games', u.games, 'top_game', u.top_game, 'groups', u.groups
      ) order by u.last_active desc nulls last, u.username), '[]'::jsonb) from per_user u)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------- Rechte (siehe 20261118000100_grants.sql) ------------------
revoke all on public.game_plays from anon;
revoke truncate, references, trigger on public.game_plays from authenticated;
grant select on public.game_plays to authenticated;
grant select, insert, update, delete on public.game_plays to service_role;

revoke execute on function public.game_play_start(text) from public, anon;
revoke execute on function public.game_play_ping(bigint) from public, anon;
revoke execute on function public.admin_stats(integer, boolean) from public, anon;
grant execute on function public.game_play_start(text) to authenticated;
grant execute on function public.game_play_ping(bigint) to authenticated;
grant execute on function public.admin_stats(integer, boolean) to authenticated;
