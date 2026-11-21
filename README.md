# Game-Test – GitHub + Supabase + Claude Code (Lernbeispiel)

Kleine React-App (Vite + TypeScript) mit **Username/Passwort-Login**, einer
**Spiele-Übersicht** (Labyrinth für Kinder, Zahlenraten, Elisabeth von Thüringen) und **Highscores**. User können **nur vom Admin**
angelegt werden – es gibt keine Selbstregistrierung.

## Architektur

```
Browser (React, GitHub Pages)
  │  Publishable Key + User-JWT
  ├──► Supabase Auth      signInWithPassword(<username>@game-test.local)
  ├──► Postgres (REST)    profiles, games, game_scores, game_highscores  ── abgesichert per RLS
  └──► Edge Function      admin-users  ── prüft role='admin', nutzt Service-Role-Key
                                         (createUser / deleteUser / updateUserById)
```

| Baustein | Datei | Wie angelegt |
|---|---|---|
| DB-Schema, RLS, Trigger | `supabase/migrations/20261118000000_init.sql` | Claude via Supabase-MCP `apply_migration` |
| Labyrinth-Ergebnisse | `supabase/migrations/20261118210000_labyrinth_scores.sql` | Claude via Supabase-MCP `apply_migration` |
| Highscores für alle Spiele | `supabase/migrations/20261121140000_game_scores.sql` | Claude via Supabase-MCP `apply_migration` |
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

### Gruppen
- Tabellen `groups`, `user_groups` (User ↔ Gruppe) und `game_groups` (Spiel ↔ Gruppe),
  siehe `supabase/migrations/20261121100000_groups.sql`.
- Ein Spieler sieht ein Spiel, wenn er in mindestens einer Gruppe des Spiels ist;
  Admins sehen alle Spiele. Verwaltet wird alles im Tab **Admin**.
- Nur Admins dürfen Zuordnungen ändern (RLS über `public.is_admin()`).
  Ergebnisse werden nur gespeichert, wenn `public.can_play('<spiel>')` stimmt.
- Spiele stehen in `src/games/catalog.ts` (`key` = `game_groups.game_key`).
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
`src/games/catalog.ts` (`GAMES`); Übersicht, Routen, Highscores und Admin bauen sich daraus auf.

Es gibt zwei Arten von Spielen:

| Art | Wo | Beispiel |
|---|---|---|
| React-Komponente | `src/games/<key>/`, in `REACT_GAMES` in `src/App.tsx` eintragen | Labyrinth, Zahlenraten |
| Eigenständige HTML-Datei | `public/games/<key>/index.html`, im Katalog `html: "games/<key>/index.html"` | Elisabeth |

HTML-Spiele zeigt `src/games/HtmlGame.tsx` bildschirmfüllend in einem iframe. Der Link
„🏠 Alle Spiele“ im Spiel zeigt auf `../../#/` mit `target="_top"` und führt so zurück zur Übersicht.

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
- Im Katalog beschreibt `highscore: { better, pointsLabel, pointsIcon?, showTime?, variants?, rule }`
  die Anzeige. `highscore: null` heißt: kein Highscore, das Spiel erscheint dann nicht unter **Highscores**.
- Speichern aus React: `saveScore(key, { points, maxPoints?, seconds?, variant? })` (`src/games/scores.ts`).
- Speichern aus HTML-Spielen: `public/games/shared/game-test.js` einbinden und am Ende
  `GameTest.reportScore({ points, maxPoints?, seconds?, variant? })` aufrufen. Das Spiel schickt das
  Ergebnis per `postMessage` an die App. Die App nimmt nur Nachrichten aus dem eigenen iframe
  an, prüft die Werte und speichert sie für den eingeloggten Spieler.
- Die alten Tabellen `scores` / `labyrinth_scores` (und ihre Views) werden nicht mehr benutzt.
  Ihre Daten wurden nach `game_scores` kopiert; entfernen in einer späteren Migration.

### Neues Spiel hinzufügen – Checkliste
1. Spiel anlegen (React-Komponente oder `public/games/<key>/index.html`).
2. Eintrag in `src/games/catalog.ts` mit `highscore: {...}` oder `highscore: null`.
3. Neue Migration: `insert into public.games (key, highscore) values ('<key>', 'high'|'low'|'none');`
   und bei Bedarf eine Freigabe in `game_groups` (oder später im Tab **Admin**).
4. `npm run build`, im Browser durchspielen.

### Elisabeth von Thüringen (3. Klasse, Gruppe Klasse-3c) – `public/games/elisabeth/`
- Übernommen aus dem Repository `3c-Lernspiele` (`games/elisabeth/`), Inhalt unverändert,
  siehe `public/games/elisabeth/readme.md`.
- Angepasst für Game-Test: Links „🏠 Alle Spiele“ führen zur App-Übersicht, Zoom-Schutz liegt
  unter `public/games/shared/`, und das Spiel zählt jetzt Fehlversuche und die Zeit.
  Am Ende zeigt es beides an und meldet es per `GameTest.reportScore` an die App.
- Bestenliste: wenigste Fehlversuche, bei Gleichstand die schnellste Zeit.
- Die HTML-Datei ist öffentlich abrufbar (wie alles auf GitHub Pages). Ohne App und Login
  läuft sie normal weiter, speichert dann aber nichts.

### Labyrinth-Abenteuer (ab ca. 5–6 Jahren) – `src/games/labyrinth/`
- Challenge aus **5 Labyrinthen** hintereinander, jedes Level ein anderes Tier
  (Maus → Käse, Hase → Karotte, Hund → Knochen, Biene → Blume, Pinguin → Fisch).
- Drei Stufen: *Leicht* (4×4 bis 6×6), *Mittel* (5×5 bis 8×8), *Knifflig* (7×7 bis 11×11).
- In jedem Labyrinth liegen 3 ⭐ Sterne – bevorzugt in Sackgassen versteckt.
- Labyrinthe werden jedes Mal neu erzeugt (`maze.ts`, Recursive Backtracker mit
  ein paar Extra-Durchgängen, damit es weniger frustrierend ist).
- **Steuerung:** Pfeiltasten oder WASD (Desktop); auf dem Handy die Figur mit dem
  Finger durch die Gänge ziehen oder das Steuerkreuz antippen (gedrückt halten = weiterlaufen).
- Soundeffekte per WebAudio (abschaltbar), Konfetti.
- Jede abgeschlossene Challenge wird in **`game_scores`** gespeichert (Variante = Stufe,
  Punkte = Sterne). Bestenliste je Stufe: meiste Sterne, dann schnellste Zeit, zu sehen unter **Highscores**.

## Lokal starten

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Ablauf zum Ausprobieren
1. Als `admin` einloggen → Tab **Admin** → User `spieler1` anlegen.
2. Logout, als `spieler1` einloggen → kein Admin-Tab sichtbar.
3. Übersicht → Labyrinth oder Zahlenraten spielen → Ergebnisse erscheinen unter **Highscores** (Tabs Labyrinth / Zahlenraten).

## Was Claude Code hier gemacht hat
- **Supabase-MCP:** Projekt gefunden, Migration angewendet, Security-Advisors
  geprüft, Edge Function deployt, URL + Publishable Key ausgelesen.
- **Git/GitHub:** Code geschrieben, gebaut (`npm run build`), committet und
  auf einen Feature-Branch gepusht; Pull Request nach `main` auf Wunsch.

Ideen zum Weiterlernen: Supabase CLI lokal (`supabase start`), Migrationen
per GitHub Action automatisch deployen, Tests mit Playwright.
