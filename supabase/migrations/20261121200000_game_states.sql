-- =====================================================================
-- Spielstand pro Spieler und Spiel
--   game_states: ein Eintrag je Spieler und Spiel mit dem Spielstand als JSON
--                (z. B. Robi: Zahnraeder, gekaufte Teile, Lernstufen).
--   Die App laedt den Stand vor dem Spiel und speichert jede Aenderung, die das
--   Spiel mit GameTest.saveState meldet (src/games/HtmlGame.tsx, src/games/states.ts).
--   Nur neue Tabelle -> rueckwaertskompatibel.
-- =====================================================================

create table public.game_states (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_key   text not null references public.games (key) on delete cascade,
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_key)
);

create index game_states_game_key_idx on public.game_states (game_key);

alter table public.game_states enable row level security;

-- Jeder sieht und aendert nur den eigenen Spielstand.
create policy "game_states: read own"
  on public.game_states for select to authenticated
  using (user_id = (select auth.uid()));

-- Neu anlegen nur fuer sich selbst und nur fuer freigegebene Spiele.
create policy "game_states: insert own"
  on public.game_states for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_play(game_key));

create policy "game_states: update own"
  on public.game_states for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_play(game_key));

-- ---------- Rechte (siehe 20261118000100_grants.sql) ------------------
revoke all on public.game_states from anon;
revoke truncate, references, trigger on public.game_states from authenticated;
grant select, insert, update on public.game_states to authenticated;
grant select, insert, update, delete on public.game_states to service_role;
