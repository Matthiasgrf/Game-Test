# Game-Test – GitHub + Supabase + Claude Code (Lernbeispiel)

Kleine React-App (Vite + TypeScript) mit **Username/Passwort-Login**, einem
**Zahlenraten-Spiel** und **Highscores**. User können **nur vom Admin**
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
Ausführlicher Befund und Reifegrad: [`docs/security-review.md`](docs/security-review.md).

- **Signups deaktiviert** → niemand kann sich selbst registrieren.
- Neue User entstehen nur in der Edge Function mit dem `SUPABASE_SERVICE_ROLE_KEY`
  (liegt nur auf dem Supabase-Server, nie im Repo/Frontend).
- Die Rolle wird in `app_metadata` gesetzt (vom User nicht änderbar) und vom
  Trigger `handle_new_user` in `profiles.role` übernommen.
- **MFA (TOTP) ist für Admins Pflicht.** Die Edge Function akzeptiert Admin-Aktionen
  nur mit einer MFA-bestätigten Sitzung (JWT-Claim `aal = aal2`). Normale User können
  MFA freiwillig unter *Konto* einrichten.
- **Start-Passwörter** werden zufällig erzeugt (16 Zeichen), einmalig angezeigt und
  müssen beim ersten Login geändert werden (`app_metadata.must_change_password`).
  Mindestlänge 12 Zeichen.
- Admins können andere Admins weder löschen noch deren Passwort setzen
  (nur im Supabase-Dashboard). Alle Aktionen landen in `admin_audit_log`.
- **Spiel serverseitig:** Geheimzahl und Versuche liegen in `game_rounds`
  (für Clients unlesbar). Scores entstehen nur über die RPC `guess()` → nicht fälschbar.
- RLS: `profiles` und `scores` nur eigene Zeilen lesbar; Highscores über
  `get_highscores()` (nur Username + Versuche + Datum).
- **GRANTs nicht vergessen** (`20261118000100_grants.sql`): RLS-Policies filtern nur
  Zeilen. Die Rolle braucht zusätzlich Tabellenrechte (`grant select ...`), sonst
  kommt `permission denied`. Neuere Supabase-Projekte vergeben sie nicht automatisch.
  `TRUNCATE` ist für Client-Rollen entzogen, weil es RLS umgeht.
- Frontend: Content-Security-Policy per `<meta>` (im Build, `vite.config.ts`),
  `no-referrer`, Logout beendet alle Sessions (`scope: global`).
- CI: Least-Privilege-Permissions pro Job, `npm audit`, Dependabot, CodeQL.

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
4. **Passwort-Sicherheit:** *Authentication → Sign In / Providers → Email*:
   „Prevent use of leaked passwords“ **an**, Minimum length **12**,
   Password requirements mindestens *Letters and digits*.
5. **MFA:** *Authentication → Multi-Factor* → TOTP **enabled** (Standard).
6. **Optional, empfohlen:** *Authentication → Attack Protection* → CAPTCHA
   (Cloudflare Turnstile) aktivieren und Rate-Limits für Sign-in prüfen
   (CAPTCHA erfordert zusätzlich ein Turnstile-Widget im Login-Formular).
7. **Edge Function CORS:** Falls die App nicht unter `https://matthiasgrf.github.io`
   läuft, Secret `ALLOWED_ORIGINS` (kommagetrennt) unter *Edge Functions → Secrets* setzen.

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
