# Game-Test – GitHub + Supabase + Claude Code (Lernbeispiel)

Kleine React-App (Vite + TypeScript) mit **Username/Passwort-Login**, einer
**Spiele-Übersicht** (u. a. Labyrinth für Kinder und die Lernspiele der Klasse 3c) und **Highscores**. User können **nur vom Admin**
angelegt werden – es gibt keine Selbstregistrierung.

## Architektur

```
Browser (React, GitHub Pages)
  │  Publishable Key + User-JWT
  ├──► Supabase Auth      signInWithPassword(<username>@game-test.local)
  ├──► Postgres (REST)    profiles, games, game_scores, game_highscores, game_states  ── abgesichert per RLS
  └──► Edge Function      admin-users  ── prüft role='admin', nutzt Service-Role-Key
                                         (createUser / deleteUser / updateUserById)
```

| Baustein | Datei | Wie angelegt |
|---|---|---|
| DB-Schema, RLS, Trigger | `supabase/migrations/20261118000000_init.sql` | Claude via Supabase-MCP `apply_migration` |
| Labyrinth-Ergebnisse | `supabase/migrations/20261118210000_labyrinth_scores.sql` | Claude via Supabase-MCP `apply_migration` |
| Highscores für alle Spiele | `supabase/migrations/20261121140000_game_scores.sql` | Claude via Supabase-MCP `apply_migration` |
| Spielstand pro Spieler (z. B. Robis Zahnräder) | `supabase/migrations/20261121200000_game_states.sql` | Claude via Supabase-MCP `apply_migration` |
| Admin-API | `supabase/functions/admin-users/index.ts` | Claude via Supabase-MCP `deploy_edge_function` |
| Spiele, Werkzeuge, Tests | `src/games/games.json`, `public/games/`, `tools/`, `CLAUDE.md` | `node tools/neues-spiel.js`, `npm test` |
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

### Gruppen
- Tabellen `groups`, `user_groups` (User ↔ Gruppe) und `game_groups` (Spiel ↔ Gruppe),
  siehe `supabase/migrations/20261121100000_groups.sql`.
- Ein Spieler sieht ein Spiel, wenn er in mindestens einer Gruppe des Spiels ist;
  Admins sehen alle Spiele. Verwaltet wird alles im Tab **Admin**.
- Nur Admins dürfen Zuordnungen ändern (RLS über `public.is_admin()`).
  Ergebnisse werden nur gespeichert, wenn `public.can_play('<spiel>')` stimmt.
- Spiele stehen in `src/games/games.json` (`key` = `game_groups.game_key` = `games.key`).
- Highscores (`20261121120000_group_highscores.sql`): Spieler sehen nur Ergebnisse
  von Mitspielern aus ihren Gruppen und nur für Spiele dieser Gruppen
  (RLS über `public.can_see_score()`). Die Bestenlisten werden je Gruppe berechnet.

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

## Spiele

Nach dem Login erscheint die **Übersicht** (`src/pages/Overview.tsx`) mit allen
Spielen, die für eine Gruppe des Spielers freigegeben sind. Alle Spiele stehen in
**`src/games/games.json`**; Übersicht, Routen, Highscores, Admin und die Werkzeuge in `tools/`
lesen diese Datei. Jedes Spiel hat einen Ordner `public/games/<key>/` mit `readme.md`
(Beschreibung, Steuerung, Highscore) und `thumbnail.jpg` (Kachelbild, 900×600).

| Spiel | Art | Gruppe | Beschreibung |
|---|---|---|---|
| Labyrinth-Abenteuer | React, `src/games/labyrinth/` | Kindergarten | `public/games/labyrinth/readme.md` |
| Elisabeth von Thüringen | HTML, `public/games/elisabeth/` | Klasse-3c | `public/games/elisabeth/readme.md` |
| Flug über Europa | HTML, `public/games/europaflug/` | Klasse-3c | `public/games/europaflug/readme.md` |
| Getreide-Abenteuer | HTML, `public/games/sachunterricht-getreide/` | Klasse-3c | `public/games/sachunterricht-getreide/readme.md` |
| Flug über Deutschland | HTML, `public/games/deutschlandflug/` | Klasse-3c | `public/games/deutschlandflug/readme.md` |
| Flug über die Welt | HTML, `public/games/weltflug/` | Klasse-3c | `public/games/weltflug/readme.md` |
| Robi in der Zahlenfabrik | HTML, `public/games/mathe-robi/` | Klasse-3c | `public/games/mathe-robi/readme.md` |
| Bauer Franz und die Getreideernte | HTML, `public/games/sachunterricht-getreideernte/` | Klasse-3c | `public/games/sachunterricht-getreideernte/readme.md` |
| Die Formen-Werkstatt | HTML, `public/games/mathe-formen/` | Klasse-3c | `public/games/mathe-formen/readme.md` |
| Die Wortmonster | HTML, `public/games/deutsch-wortmonster/` | Klasse-3c | `public/games/deutsch-wortmonster/readme.md` |

Es gibt zwei Arten von Spielen:

- **React-Spiel** (`"type": "react"`): `src/games/<key>/index.tsx` mit `export default`. Die App lädt es
  automatisch als Route `#/spiele/<key>`, erst wenn es geöffnet wird.
- **HTML-Spiel** (`"type": "html"`): eine eigenständige Datei `public/games/<key>/index.html`, ohne Build.
  `src/games/HtmlGame.tsx` zeigt sie bildschirmfüllend in einem iframe. Der Link „🏠 Alle Spiele“
  zeigt auf `../../#/` mit `target="_top"` und führt so zurück zur Übersicht.

### Highscores (für alle Spiele)
Alle Spiele speichern in **eine** Tabelle, `game_scores`
(`supabase/migrations/20261121140000_game_scores.sql`):

| Spalte | Bedeutung |
|---|---|
| `game_key` | Spiel (Fremdschlüssel auf `games`) |
| `variant` | optionale Variante mit eigener Bestenliste, z. B. Stufe `leicht`; sonst `''` |
| `points` | Punkte – ob mehr oder weniger besser ist, steht in `games.highscore` |
| `max_points` | optional, wird als „3 / 5“ angezeigt |
| `seconds` | optional, entscheidet bei Gleichstand (kürzer ist besser) |

- Tabelle **`games`**: eine Zeile pro Spiel, `highscore` = `high` (mehr Punkte sind besser),
  `low` (weniger sind besser, z. B. Versuche oder Fehler) oder **`none` (Spiel ohne Highscores)**.
  Für `none` lehnt die Datenbank das Speichern ab.
- View **`game_highscores`**: bestes Ergebnis je Spieler, Top 10 je Gruppe, Spiel und Variante.
- In `src/games/games.json` beschreibt `highscore: { better, pointsLabel, pointsIcon?, showTime?, variants?, rule }`
  die Anzeige. `highscore: null` heißt: kein Highscore, das Spiel erscheint dann nicht unter **Highscores**.
  `tools/check.js` prüft, dass games.json und die Tabelle `games` (Migrationen) zusammenpassen.
- Speichern aus React: `saveScore(key, { points, maxPoints?, seconds?, variant? })` (`src/games/scores.ts`).
- Speichern aus HTML-Spielen: `public/games/shared/game-test.js` einbinden und am Ende
  `GameTest.reportScore({ points, maxPoints?, seconds?, variant? })` aufrufen. Das Spiel schickt das
  Ergebnis per `postMessage` an die App. Die App nimmt nur Nachrichten aus dem eigenen iframe
  an, prüft die Werte und speichert sie für den eingeloggten Spieler.
- Die alten Tabellen `scores` / `labyrinth_scores` (und ihre Views) werden nicht mehr benutzt.
  Ihre Daten wurden nach `game_scores` kopiert; entfernen in einer späteren Migration.

### Neues Spiel hinzufügen

```bash
node tools/neues-spiel.js einmaleins "Einmaleins-Rakete" --gruppe Klasse-3c
```

Das legt aus `tools/vorlage/` ein lauffähiges Quiz an (HTML, mit `--react` als React-Spiel),
dazu readme.md, den Eintrag in games.json, die Migration für die Tabelle `games` und einen
Durchspiel-Test. `--ohne-highscore` legt ein Spiel ohne Bestenliste an. Die vollständige
Checkliste und die Regeln für Spiele stehen in **`CLAUDE.md`**.

## Tests

| Befehl | Zweck |
|---|---|
| `npm run check` | Regeln ohne Browser: games.json, Dateien, Vorschaubilder, Links, fremde Server, Highscore ↔ Datenbank |
| `npm run smoke` | Übersicht, Highscores und jedes Spiel im Browser öffnen (Computer + Handy), Screenshots in `test-ergebnisse/` |
| `npm run spieltest` | Spiele mit Test in `tools/spieltests/` automatisch durchspielen, inkl. gespeichertem Ergebnis |
| `npm test` | alles zusammen, wie der Workflow **„Spiele prüfen“** bei jedem Push |

Die Browser-Tests bauen die App mit Test-Zugangsdaten und stellen Supabase im Browser nach
(`tools/lib.js`, `mockSupabase`). Sie brauchen weder Passwort noch Datenbank und speichern nichts.
Einmalig nötig: `npx playwright install chromium`.

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Ablauf zum Ausprobieren
1. Als `admin` einloggen → Tab **Admin** → User `spieler1` anlegen.
2. Logout, als `spieler1` einloggen → kein Admin-Tab sichtbar.
3. Übersicht → ein freigegebenes Spiel spielen → das Ergebnis erscheint unter **Highscores**.

## Was Claude Code hier gemacht hat
- **Supabase-MCP:** Projekt gefunden, Migration angewendet, Security-Advisors
  geprüft, Edge Function deployt, URL + Publishable Key ausgelesen.
- **Git/GitHub:** Code geschrieben, gebaut (`npm run build`), committet und
  auf einen Feature-Branch gepusht; Pull Request nach `main` auf Wunsch.

Ideen zum Weiterlernen: Supabase CLI lokal (`supabase start`), Migrationen
per GitHub Action automatisch deployen.
