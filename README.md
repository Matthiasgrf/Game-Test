# Game-Test – GitHub + Supabase + Claude Code (Lernbeispiel)

Kleine React-App (Vite + TypeScript) mit **Username/Passwort-Login**, den Spielen
**Rohr-Flitzer** und **Zahlenraten** sowie **Highscores**. User können **nur vom Admin**
angelegt werden – es gibt keine Selbstregistrierung.

## Architektur

```
Browser (React, GitHub Pages)
  │  Publishable Key + User-JWT
  ├──► Supabase Auth      signInWithPassword(<username>@game-test.local)
  ├──► Postgres (REST)    profiles, scores, highscores  ── abgesichert per RLS
  └──► Edge Function      admin-users  ── prüft role='admin', nutzt Service-Role-Key
                                         (createUser / deleteUser / updateUserById)
```

| Baustein | Datei | Wie angelegt |
|---|---|---|
| DB-Schema, RLS, Trigger | `supabase/migrations/20261118000000_init.sql` | Claude via Supabase-MCP `apply_migration` |
| Admin-API | `supabase/functions/admin-users/index.ts` | Claude via Supabase-MCP `deploy_edge_function` |
| Frontend | `src/` | Claude schreibt Code, commit + push nach GitHub |
| Deployment | `.github/workflows/deploy.yml` | GitHub Actions → GitHub Pages |

### Warum Username → Pseudo-E-Mail?
Supabase Auth kennt nur E-Mail/Telefon. Die App wandelt `spieler1` intern in
`spieler1@game-test.local` um (`src/lib/supabase.ts`). Der User sieht davon nichts.

### Sicherheitsmodell
- **Signups deaktiviert** → niemand kann sich selbst registrieren.
- Neue User entstehen nur in der Edge Function mit dem `SUPABASE_SERVICE_ROLE_KEY`
  (liegt nur auf dem Supabase-Server, nie im Repo/Frontend).
- Die Rolle wird in `app_metadata` gesetzt (vom User nicht änderbar) und vom
  Trigger `handle_new_user` in `profiles.role` übernommen.
- RLS: `profiles` nur lesbar; `scores` lesbar, einfügen nur für den eigenen User.
- **GRANTs nicht vergessen** (`20261118000100_grants.sql`): RLS-Policies filtern nur
  Zeilen. Die Rolle braucht zusätzlich Tabellenrechte (`grant select ...`), sonst
  kommt `permission denied`. Neuere Supabase-Projekte vergeben sie nicht automatisch.
  `TRUNCATE` ist für Client-Rollen entzogen, weil es RLS umgeht.

## Rohr-Flitzer (Spiel der Gruppe Fisser-Flitzer)
Eine Kackwurst 💩 muss sich in **Haus Buchhammer** durch ein Labyrinth aus
Abflussrohren vom Klo im Dachgeschoss bis in die Kanalisation kämpfen.
- Steuerung: Pfeiltasten/WASD, am Handy Wischen oder Steuerkreuz.
- Schwerkraft zieht die Wurst nach unten, nach oben geht's nur langsam.
- Im Rohr ist es dunkel: nur die nähere Umgebung ist sichtbar.
- Verstopfte Rohre (Klopapier-Pfropfen ❌) sind unpassierbar – es gibt aber
  immer einen Umweg. Jede Runde erzeugt ein neues Rohrsystem (`src/game/rohrMaze.ts`).
- Rundendauer ca. 20–30 s, nach 60 s ist das Rohr „eingetrocknet“.
- Highscore = schnellste Zeit (Tabelle `rohr_scores`,
  Migration `supabase/migrations/20261121000000_rohr_flitzer.sql`).

## Einmalige Einrichtung

### 1. Supabase (Dashboard)
1. **Admin anlegen:** *Authentication → Users → Add user → Create new user*
   - E-Mail: `admin@game-test.local`, eigenes Passwort, **Auto Confirm User** an.
   - Der Trigger legt automatisch das Profil `admin` (Rolle `user`) an.
2. **Admin-Rolle setzen** (SQL Editor – oder Claude bitten, es per MCP zu tun):
   ```sql
   update public.profiles set role = 'admin' where username = 'admin';
   ```
3. **Signups abschalten:** *Authentication → Sign In / Providers →
   „Allow new users to sign up“* **aus**.

### 2. GitHub
1. *Settings → Pages → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables*:
   - `VITE_SUPABASE_URL` = `https://sqeftnnolnwusepsikyj.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Wert aus `.env.example`
3. Nach dem Merge nach `main` deployt der Workflow automatisch.
   (Pages für private Repos benötigt einen bezahlten GitHub-Plan.)

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Ablauf zum Ausprobieren
1. Als `admin` einloggen → Tab **Admin** → User `spieler1` anlegen.
2. Logout, als `spieler1` einloggen → kein Admin-Tab sichtbar.
3. Zahlenraten spielen → Ergebnis erscheint unter **Highscores**.

## Was Claude Code hier gemacht hat
- **Supabase-MCP:** Projekt gefunden, Migration angewendet, Security-Advisors
  geprüft, Edge Function deployt, URL + Publishable Key ausgelesen.
- **Git/GitHub:** Code geschrieben, gebaut (`npm run build`), committet und
  auf einen Feature-Branch gepusht; Pull Request nach `main` auf Wunsch.

Ideen zum Weiterlernen: Supabase CLI lokal (`supabase start`), Migrationen
per GitHub Action automatisch deployen, Tests mit Playwright.
