-- =====================================================================
-- Kategorien (Schulfaecher) fuer Spiele
--   categories      : z.B. Deutsch, Mathe, Sachkunde, Erdkunde, Religion, Freizeit
--   game_categories : welche Kategorie ein Spiel hat (hoechstens eine pro Spiel)
-- Die Uebersicht zeigt die Spiele nach Kategorien. Lesen duerfen alle
-- Eingeloggten, anlegen und zuordnen nur Admins (Tab Admin).
-- =====================================================================

-- ---------- categories ------------------------------------------------
create table public.categories (
  id         bigint generated always as identity primary key,
  name       text not null unique check (char_length(name) between 1 and 40),
  emoji      text not null default '' check (char_length(emoji) <= 10),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories: authenticated can read"
  on public.categories for select to authenticated using (true);
create policy "categories: admin insert"
  on public.categories for insert to authenticated with check ((select public.is_admin()));
create policy "categories: admin update"
  on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "categories: admin delete"
  on public.categories for delete to authenticated using ((select public.is_admin()));

-- ---------- game_categories -------------------------------------------
-- Primaerschluessel game_key: jedes Spiel hat hoechstens eine Kategorie.
create table public.game_categories (
  game_key    text   primary key references public.games (key) on delete cascade,
  category_id bigint not null references public.categories (id) on delete cascade
);

create index game_categories_category_id_idx on public.game_categories (category_id);

alter table public.game_categories enable row level security;

create policy "game_categories: authenticated can read"
  on public.game_categories for select to authenticated using (true);
create policy "game_categories: admin insert"
  on public.game_categories for insert to authenticated with check ((select public.is_admin()));
create policy "game_categories: admin update"
  on public.game_categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "game_categories: admin delete"
  on public.game_categories for delete to authenticated using ((select public.is_admin()));

-- ---------- Rechte (siehe 20261118000100_grants.sql) ------------------
revoke all on public.categories, public.game_categories from anon;
revoke truncate, references, trigger on public.categories, public.game_categories from authenticated;
grant select, insert, update, delete on public.categories, public.game_categories to authenticated;
grant select, insert, update, delete on public.categories, public.game_categories to service_role;

-- ---------- Startdaten ------------------------------------------------
insert into public.categories (name, emoji, sort_order) values
  ('Deutsch',   '📚', 10),
  ('Mathe',     '🔢', 20),
  ('Sachkunde', '🌱', 30),
  ('Erdkunde',  '🌍', 40),
  ('Religion',  '⛪', 50),
  ('Freizeit',  '🎈', 60);

insert into public.game_categories (game_key, category_id)
select k.key, c.id
from (values
  ('europaflug', 'Erdkunde'), ('deutschlandflug', 'Erdkunde'), ('weltflug', 'Erdkunde'),
  ('mathe-robi', 'Mathe'), ('mathe-formen', 'Mathe'),
  ('elisabeth', 'Religion'),
  ('sachunterricht-getreide', 'Sachkunde'), ('sachunterricht-getreideernte', 'Sachkunde'),
  ('deutsch-wortmonster', 'Deutsch'),
  ('labyrinth', 'Freizeit'), ('zahlenraten', 'Freizeit'), ('rohr-flitzer', 'Freizeit'), ('ski-flitzer', 'Freizeit')
) as k(key, category)
join public.categories c on c.name = k.category
join public.games g on g.key = k.key
on conflict do nothing;
