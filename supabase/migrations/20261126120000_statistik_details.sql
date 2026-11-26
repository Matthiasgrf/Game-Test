-- =====================================================================
-- Detail-Auswertung fuer das Admin-Dashboard (#/admin/statistik):
-- Wer spielt welches Spiel wie lange?
--   admin_stats_detail : RPC, nur fuer Admins. Liefert als JSON
--     pairs    : eine Zeile je Spieler und Spiel mit Aktivitaet im Zeitraum
--                (Starts, Spielzeit, Kurzbesuche, Ergebnisse, aktive Tage,
--                erster/letzter Start)
--     sessions : die letzten Spielstarts im Zeitraum (hoechstens p_limit)
-- Gleiche Zaehlweise wie admin_stats (20261121220000_nutzungsstatistik.sql):
-- Tage nach deutscher Zeit, Spielzeit je Start hoechstens 3 h, Kurzbesuch < 30 s.
-- Nur eine neue Funktion -> rueckwaertskompatibel.
-- =====================================================================

create function public.admin_stats_detail(
  p_days integer default 30,
  p_include_admins boolean default false,
  p_limit integer default 300
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     constant text := 'Europe/Berlin';
  v_days   integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_limit  integer := least(greatest(coalesce(p_limit, 300), 0), 2000);
  v_today  date := (now() at time zone 'Europe/Berlin')::date;
  v_from   timestamptz := ((v_today - (v_days - 1))::timestamp at time zone 'Europe/Berlin');
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Nur für Admins' using errcode = '42501';
  end if;

  with
  counted as (
    select pr.id, pr.username from public.profiles pr
    where p_include_admins or pr.role = 'user'
  ),
  plays as (
    select c.username, p.game_key, p.started_at as at,
           extract(epoch from least(p.last_active_at, p.started_at + interval '3 hours') - p.started_at)::integer as secs
    from public.game_plays p
    join counted c on c.id = p.user_id
    where p.started_at >= v_from
  ),
  scores as (
    select c.username, s.game_key, s.created_at as at
    from public.game_scores s
    join counted c on c.id = s.user_id
    where s.created_at >= v_from
  ),
  activity as (
    select username, game_key, at from plays
    union all
    select username, game_key, at from scores
  ),
  pair_keys as (
    select distinct username, game_key from activity
  )
  select jsonb_build_object(
    'generated_at', now(),
    'period_days',  v_days,
    'pairs', (select coalesce(jsonb_agg(to_jsonb(x) order by x.username, x.play_seconds desc, x.game_key), '[]'::jsonb) from (
      select k.username, k.game_key,
        (select count(*) from plays p where p.username = k.username and p.game_key = k.game_key) as plays,
        (select coalesce(sum(p.secs), 0) from plays p where p.username = k.username and p.game_key = k.game_key) as play_seconds,
        (select count(*) from plays p where p.username = k.username and p.game_key = k.game_key and p.secs < 30) as short_plays,
        (select count(*) from scores s where s.username = k.username and s.game_key = k.game_key) as scores,
        (select count(distinct (a.at at time zone v_tz)::date) from activity a
           where a.username = k.username and a.game_key = k.game_key) as active_days,
        (select min(a.at) from activity a where a.username = k.username and a.game_key = k.game_key) as first_played,
        (select max(a.at) from activity a where a.username = k.username and a.game_key = k.game_key) as last_played
      from pair_keys k
    ) x),
    'sessions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc), '[]'::jsonb) from (
      select p.username, p.game_key, p.at as started_at, p.secs
      from plays p
      order by p.at desc
      limit v_limit
    ) x)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_stats_detail(integer, boolean, integer) from public, anon;
grant execute on function public.admin_stats_detail(integer, boolean, integer) to authenticated;
