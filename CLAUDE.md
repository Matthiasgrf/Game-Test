# Game-Test – Regeln für Claude

React-App (Vite + TypeScript) mit Login über Supabase, Spiele-Übersicht, Gruppen und Highscores.
Veröffentlicht über GitHub Pages aus `main` (Workflow „Spiele prüfen“, Jobs „Veröffentlichen“, nach den schnellen Checks).
Zielgruppen: Lernspiele für Kinder (Kindergarten bis Grundschule, vor allem 8–10 Jahre) und Spaßspiele für
Erwachsene – genutzt auf Computer, iPad, iPhone und Android, im Browser und als Home-Bildschirm-App.
Sprache aller Texte: Deutsch, kindgerecht, kurze Sätze.

**Verbindlich für jedes Spiel: [`docs/GAME_STANDARD.md`](docs/GAME_STANDARD.md)** (Aufbau, Darstellung, Bedienung,
Kit, Design, Speicher, Qualität, Performance, Definition of Done, Test-Strategie). Qualitätsmaßstab für Grafik und
Bedienung: „Flug über die Welt“ und „Flug über Europa“. Neue Spiele: Briefing [`docs/GAME_BRIEF.md`](docs/GAME_BRIEF.md),
dann `node tools/neues-spiel.js` – die Vorlage erfüllt den Standard schon.

## Struktur

```
src/games/games.json          Liste aller Spiele – steuert Übersicht, Routen, Highscores, Admin und die Werkzeuge
src/games/catalog.ts          Typen und abgeleitete Felder (path, image, html) zu games.json
src/games/scores.ts           saveScore / loadMyScores – Ergebnisse speichern (Tabelle game_scores)
src/games/states.ts           loadState / saveState – Spielstand pro Spieler (Tabelle game_states)
src/games/plays.ts            useGamePlay – meldet Spielstart + Spielzeit (Tabelle game_plays, für die Statistik)
src/pages/AdminStats.tsx      Admin-Dashboard #/admin/statistik, Zahlen aus der DB-Funktion admin_stats
src/games/HtmlGame.tsx        zeigt HTML-Spiele im iframe, nimmt deren Ergebnisse an
src/games/<key>/index.tsx     React-Spiel – nur Altbestand (Labyrinth, Rohr-Flitzer), neue Spiele sind HTML-Spiele
public/games/<key>/           pro Spiel: index.html, game.js, assets/, readme.md, thumbnail.jpg (900×600)
public/games/shared/kit/      gemeinsame Bausteine: theme.css (Design), kit.js (startKit: Leiste, Pause, Ton,
                              Vollbild, Auto-Pause, Drehen-Hinweis), viewport, loop, input, sound, storage, quality
public/games/shared/          zoom-schutz.js, game-test.js (Verbindung HTML-Spiel ↔ App)
public/games/shared/vendor/   Bibliotheken aus der festen Liste (Three.js r128, flag-icons 7.6.0, mit Lizenz)
public/manifest.webmanifest   Home-Bildschirm-App (PWA), Icons in public/icons/ (node tools/icons.js)
supabase/migrations/          Datenbank; jedes Spiel braucht eine Zeile in der Tabelle games
                              Kategorien der Übersicht (Schulfächer): Tabellen categories, game_categories (pflegt der Admin)
tools/                        neues-spiel.js, check.js, smoke.js, spieltest.js, geaendert.js, schnell.js, leistung.js,
                              thumbnail.js, lib.js
tools/spieltests/<key>.js     Durchspiel-Test pro Spiel
tools/flugtest.js             gemeinsamer Durchspiel-Test der Flugspiele (europaflug, deutschlandflug, weltflug)
tools/vorlage/                Startpunkt für neue Spiele: lauffähiges Mini-Spiel mit dem Kit (index.html, game.js),
                              readme, Migration, Durchspiel-Test – geprüft mit tools/vorlage-test.js
.github/workflows/pruefen.yml „Spiele prüfen“ bei jedem Push: schnelle Checks, geänderte Spiele durchspielen,
                              auf main veröffentlichen
.github/workflows/pruefen-voll.yml  „Spiele prüfen (ausführlich)“: main, nachts, per Hand – alle Größen, WebKit, Leistung
docs/GAME_STANDARD.md         Standard für Spiele, Definition of Done, Test-Strategie mit Laufzeiten
docs/GAME_BRIEF.md            Briefing-Vorlage für neue Spiele
```

## Spiele: HTML mit dem Kit

Jedes Spiel ist ein HTML-Spiel ohne Build (`"type": "html"`): `index.html` (Gerüst), `game.js` (ES-Modul), `assets/`.
Es bindet `../shared/kit/theme.css` ein und ruft `startKit({ key, orientation, pause, resume })` aus
`../shared/kit/kit.js` auf (✓ check.js). Das Kit liefert Leiste (Pause, Ton, Vollbild, 🏠 Alle Spiele), Pause-Fenster,
Auto-Pause, Drehen-Hinweis, Eingaben, Ton, Speicher und Design – nichts davon selbst nachbauen.

| Aufgabe | so |
|---|---|
| Ergebnis für die Bestenliste | `kit.storage.saveScore({ points, maxPoints?, seconds?, variant? })` |
| Spielstand pro Spieler | `"saveKey"` in games.json, `startKit({ saveKey })`, `kit.storage.saveProgress(daten)` / `loadProgress()` |
| eigene Ergebnisse („Dein Rekord“) | `await kit.storage.getScores()` |
| Zurück zur Übersicht | Leiste des Kits, im Start- und Ende-Fenster `<a class="gt-btn gt-alt" href="../../#/" target="_top">🏠 Alle Spiele</a>` |

Altbestand (in `tools/check.js` → `ALTBESTAND`): ältere Spiele melden noch direkt über
`GameTest.reportScore(...)` / `GameTest.saveState(...)` (`public/games/shared/game-test.js`); Labyrinth und Rohr-Flitzer
sind React-Spiele (`src/games/<key>/`, `saveScore` aus `scores.ts`). Beim Umstellen auf das Kit (Spielregeln und
Inhalte bleiben gleich) aus der Liste streichen.

## Highscores

- Jedes Spiel hat in `games.json` entweder `"highscore": { ... }` oder `"highscore": null` (Spiel ohne Bestenliste).
- Dazu passend in der Tabelle `games`: `'high'` (mehr Punkte besser), `'low'` (weniger besser) oder `'none'`.
  `tools/check.js` prüft, dass games.json und Migrationen übereinstimmen.
- `highscore`-Felder: `better` ("high"/"low"), `pointsLabel` (Spaltenüberschrift), `rule` (Erklärung),
  optional `pointsIcon`, `showTime` (Spalte Zeit), `variants` (eigene Bestenliste je Stufe: `[{ id, label }]`).
- Gleichstand entscheidet immer die kürzere Zeit (`seconds`). Pro Spieler zählt nur das beste Ergebnis.
- Quiz-Spiele: Punkte = Fehlversuche (`low`), dazu die Zeit – „richtige Antworten“ taugen nicht, weil
  Kinder so lange probieren, bis es stimmt.
- **Plausibilitätsprüfung** (Trigger `game_scores_check`, Migration `20261122000000_highscores_absichern.sql`):
  Ein Ergebnis vom Browser wird nur gespeichert, wenn es einen passenden Spielstart in `game_plays` gibt
  (meldet `GameGate` automatisch; die gemeldete Zeit `seconds` muss danach liegen), höchstens eins je Spiel
  alle 3 Sekunden und höchstens 300 je Spieler und Tag. Spiele immer über `GameGate` einbinden.
- `"serverScored": true` (nur React-Spiele): Die Spiellogik läuft in der Datenbank und die speichert das
  Ergebnis selbst (eigene RPC-Funktionen als `security definer`). Dann kein `saveScore`,
  dafür in einer Migration `update public.games set server_scored = true where key = '<key>';` –
  erst nach dem Deploy einspielen. `tools/check.js` prüft beides; die RPCs in `mockSupabase` nachstellen.
  Derzeit nutzt kein Spiel diesen Weg.

## Spielstand pro Spieler

- Fortschritt, der bleiben soll (Münzen/Zahnräder, gekaufte Teile, Stufen), gehört in die Tabelle `game_states`
  (eine Zeile je Spieler und Spiel, `data` als JSON-Objekt, höchstens 100 000 Zeichen), nicht nur in `localStorage`.
- HTML-Spiel: in games.json `"saveKey": "<localStorage-Schlüssel>"` eintragen, `startKit({ saveKey })` und zum
  Speichern `kit.storage.saveProgress(daten)`, zum Laden `kit.storage.loadProgress()` (Altbestand: überall, wo das
  Spiel in den Schlüssel schreibt, zusätzlich `GameTest.saveState(store)`). Die App lädt den Stand vor dem Start aus
  Supabase und legt ihn unter `saveKey` ab – das Spiel liest ihn synchron aus `localStorage`.
  Andere Kinder am selben Gerät bekommen ihn nicht (`game-test-owner:<key>`). `tools/check.js` prüft beides.
- Im Durchspiel-Test: `page.states` (gespeicherte Stände), Startwerte mit `t.newPage(…, { states: { '<key>': {…} } })`.
- Einstellungen wie Ton an/aus dürfen im Spielstand stehen, Highscores nicht (die gehören nach `game_scores`).

## Aussehen auf Handy und Tablet

Die Spiele werden vor allem auf Handy und Tablet gespielt – dort muss ein Spiel so gut aussehen wie am Computer.
Vorbild: „Flug über die Welt“ und „Flug über Europa“ (`public/games/weltflug`, `public/games/europaflug`).
Details: `docs/GAME_STANDARD.md`, Abschnitte 2 (Darstellung) und 6 (Design).

- **Spielszene bildschirmfüllend**, hoch **und** quer gehalten. Kein festes Hochformat-Raster mit Rand drumherum:
  Raster, Kamera bzw. Ausschnitt an das Seitenverhältnis anpassen. Braucht ein Spielbrett ein festes
  Seitenverhältnis, liegt es mittig in der bildschirmfüllenden Szene (`board()` aus dem Kit) – keine schwarzen Balken.
  Ist eine Ausrichtung klar besser: `orientation` in games.json, dann zeigt das Kit „Bitte Gerät drehen“.
- **Anzeigen und Steuerung liegen über der Szene** (halbtransparent, an den Rändern, `env(safe-area-inset-*)`),
  nicht in eigenen Leisten darüber/darunter. Kopfzeile auf dem Handy höchstens eine Zeile.
  Touch: Joystick/Steuerkreuz unten links bzw. rechts, Aktionsknopf auf der anderen Seite, mindestens 56 px.
- **Groß genug**: Figuren auf dem Handy mindestens ca. 32 px; Texte und Banner laufen nie über den Bildschirm.
- **Grafik mit Tiefe**: Schatten, Licht, Farbverläufe, kleine Animationen – keine flachen Platzhalter-Formen.
  Three.js liegt bereit (`public/games/shared/vendor/`), lohnt sich bei Bewegungs- und Erkundungsspielen.
- `tools/smoke.js` prüft auf Tablet und Handy (hoch und quer), dass die Spielfläche mindestens 60 % des
  Bildschirms bedeckt. Das reicht nicht: im Durchspiel-Test die **laufende** Szene auf `t.PHONE` und
  `t.PHONE_QUER` fotografieren, ansehen und mindestens eine Verbesserungsrunde einplanen, bevor der Pull Request
  entsteht.

## Werkzeuge

| Befehl | Zweck |
| --- | --- |
| `node tools/neues-spiel.js <key> "<Titel>" [--zielgruppe kinder\|erwachsene] [--ausrichtung beide\|quer\|hoch] [--status live\|beta\|entwurf] [--ohne-highscore] [--alter "…"] [--gruppe "…"] [--emoji "…"] [--kategorie "…"]` | Spiel aus der Vorlage anlegen: index.html, game.js, readme, games.json, Migration, Durchspiel-Test. Überschreibt nichts. |
| `node tools/vorlage-test.js` | legt in einer Kopie ein Spiel aus der Vorlage an und prüft es komplett (nach Änderungen an Vorlage/Kit) |
| `node tools/thumbnail.js <key> [--klick "<css>"] [--tippen "<css>" "<text>"] [--verstecken "<css>"] [--warten <ms>]` | `thumbnail.jpg` 900×600 als Screenshot |
| `node tools/check.js` | Regeln prüfen ohne Browser – muss ohne Fehler durchlaufen |
| `node tools/smoke.js [key …] [--groesse handy,…] [--browser webkit]` | Übersicht, Highscores und Spiele im Browser öffnen (Computer, Tablet, Handy hoch und quer – mit hoher Pixeldichte wie iPad/iPhone; mit WebKit iPhone/iPad), Größe der Spielfläche prüfen, Screenshots in `test-ergebnisse/` |
| `node tools/spieltest.js [key …] [--zeichnen]` | Spiele mit Testdatei in `tools/spieltests/` automatisch durchspielen (mehrere gleichzeitig) |
| `node tools/geaendert.js` | zeigt, welche Spiele von den Änderungen seit `main` betroffen sind (so wählt der Workflow aus) |
| `npm run test:schnell` | wie die schnellen Checks im Workflow: tsc, check, Handy-Smoke, betroffene Spiele durchspielen – vor jedem Push |
| `npm run leistung` | Ladegröße, Zeichnen im Menü, 3D-Detailstufe je Spiel |
| `npm test` | alles zusammen (tsc, check, smoke, spieltest) – vor dem Pull Request |

Die Browser-Werkzeuge bauen die App mit Test-Zugangsdaten (`.test-build/`) und stellen Supabase nach
(`mockSupabase` in `tools/lib.js`): eingeloggt als „testkind“, alle Spiele freigegeben, gespeicherte
Ergebnisse landen in `page.scores`. Es wird nie die echte Datenbank benutzt.
Neue Regeln, die sich automatisch prüfen lassen, in `tools/check.js` ergänzen statt nur hier aufzuschreiben.
Tests schnell halten (Test-Strategie in `docs/GAME_STANDARD.md`): 3D wird in Tests nicht gezeichnet (außer für
Screenshots, `t.shot`), Wartezeiten im Spiel mit der Playwright-Uhr überspringen (`page.clock`), keine festen Pausen.

## Neues Spiel hinzufügen – Checkliste

0. **Briefing**: `docs/GAME_BRIEF.md` – was fehlt, nach dem Standard entscheiden und im Pull Request nennen.
1. **Anlegen**: `node tools/neues-spiel.js <key> "<Titel>" --zielgruppe … --ausrichtung … --kategorie … --gruppe …`
   – key kurz, nur `a-z 0-9 - _`. Hochgeladenes HTML-Spiel vorher als `public/games/<key>/index.html` ablegen,
   es wird nicht überschrieben.
2. **Spiel**: `game.js` und `index.html` der Vorlage durch das eigene Spiel ersetzen, Kit weiter benutzen
   (`docs/GAME_STANDARD.md`). Hochgeladene Spiele inhaltlich nicht verändern (Fragen, Antworten, Ablauf), außer
   der Nutzer erlaubt es; offensichtliche Fehler beheben und im Pull Request erwähnen. Erlaubt und im Pull Request
   zu nennen: Kit einbinden (Leiste, Pause, Ton, Vollbild, Drehen-Hinweis), Zoom-Schutz + `game-test.js` im
   `<head>`, viewport, Links „🏠 Alle Spiele“, Ergebnis über `kit.storage.saveScore`, Dateien von CDNs lokal ablegen,
   Ergebnis für die Bestenliste ermitteln (z. B. Fehlversuche und Zeit) und am Ende anzeigen.
3. **Regeln für jedes Spiel** (Standard, Abschnitte 2–9): Szene bildschirmfüllend und scharf (`fitCanvas`),
   Bewegung mit dt, nie Seiten-Scrollen, Maus/Tastatur **und** Touch (große Knöpfe, kein Hover-Zwang),
   Fortschritt sichtbar, bei falscher Antwort freundliches Feedback und neuer Versuch, Gewinn-Bildschirm mit
   „Nochmal spielen“, keine fremden Server, keine Werbung, keine Tracker, keine persönlichen Daten,
   nie `localStorage.clear()` (löscht den Login), Kinder-Spiele ohne Zeitdruck als Pflicht.
4. **games.json**: `description` (1 Satz), `age`, `emoji`, `color`, `zielgruppe`, `orientation`, `status`,
   `highscore` ausfüllen. Fertig getestet → `"status": "live"`.
5. **readme.md** in `public/games/<key>/`: Inhalt, Steuerung, Highscore, Besonderheiten.
6. **Vorschaubild**: `node tools/thumbnail.js <key> …` – typische Spielszene ohne Bedienelemente. Ansehen.
7. **Durchspiel-Test** `tools/spieltests/<key>.js` anpassen (die Vorlage passt zum Sterne-Quiz der Vorlage).
   Er muss Leiste/Pause, Gewinn-Bildschirm und gespeichertes Ergebnis prüfen (`page.scores`) und die laufende
   Szene auf Handy hoch und quer fotografieren (`t.shot`). Lokal unter einer Minute.
8. **Testen**: `npm run test:schnell` beim Arbeiten, vor dem Pull Request `npm test` ohne Fehler;
   Definition of Done in `docs/GAME_STANDARD.md` abhaken; Screenshots in `test-ergebnisse/` (Computer, Tablet, Handy hoch und quer)
   ansehen – auch die laufende Spielszene aus dem Durchspiel-Test, nicht nur den Start-Bildschirm – und mit
   „Aussehen auf Handy und Tablet“ vergleichen; auch die Übersicht (`uebersicht-*.png`) mit der neuen Kachel.
9. **Datenbank**: Migration aus Schritt 1 prüfen (Highscore-Art, Freigabe für Gruppen, Kategorie wie
   Mathe/Deutsch/Sachkunde/Erdkunde/Religion/Freizeit – sonst steht das Spiel unter „Weitere Spiele“) und mit dem
   Supabase-MCP `apply_migration` einspielen (Projekt „Game-test“). Sie legt nur neue Zeilen an und kann vor
   dem Deploy laufen. Danach `get_advisors` (security) ansehen.
10. **Abschluss**: committen, pushen, Pull Request nach `main` (ein Spiel pro Pull Request) mit: was neu ist,
    was am Spiel geändert wurde, ob die Migration schon eingespielt ist. „Schnelle Checks“ und „Durchspielen“
    müssen grün sein.

## Datenbank

- Änderungen nur als neue Datei in `supabase/migrations/`, nie alte Migrationen ändern.
- Einspielen über den Supabase-MCP (`apply_migration`), Inhalt identisch zur Datei.
- Migrationen rückwärtskompatibel halten: die veröffentlichte App läuft weiter, bis der Pull Request gemergt ist.
- RLS: jede neue Tabelle mit Policies und GRANTs (siehe `20261118000100_grants.sql`). Rechte testen mit einem
  Probelauf, der am Ende per Exception zurückrollt, statt Testdaten zu speichern.

## Git

- Nur auf dem vorgegebenen Arbeitsbranch arbeiten, nie direkt auf `main`.
- Ist der vorherige Pull Request schon gemergt, den Branch neu von `origin/main` starten.
- `test-ergebnisse/`, `.test-build/`, `node_modules/`, `.env.local` werden nicht eingecheckt.
