-- =====================================================================
-- Tabellenrechte (GRANTs)
-- RLS-Policies entscheiden WELCHE Zeilen sichtbar sind – vorher muss die
-- Rolle aber ueberhaupt Rechte auf die Tabelle haben. Neuere Supabase-
-- Projekte vergeben diese nicht mehr automatisch.
-- =====================================================================

-- TRUNCATE umgeht RLS -> fuer Client-Rollen entziehen
revoke truncate, references, trigger on public.profiles, public.scores from anon, authenticated;
revoke all on public.highscores from anon;
revoke truncate, references, trigger on public.highscores from authenticated;

-- Eingeloggte User: lesen (RLS filtert), Scores eintragen
grant select on public.profiles to authenticated;
grant select, insert on public.scores to authenticated;
grant select on public.highscores to authenticated;

-- Edge Function (service_role, umgeht RLS): Profile verwalten
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.scores to service_role;
grant select on public.highscores to service_role;
