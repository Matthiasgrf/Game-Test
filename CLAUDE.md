# Game-Test – Regeln für Claude

React-App (Vite + TypeScript) mit Login über Supabase, Spiele-Übersicht, Gruppen und Highscores.
Veröffentlicht über GitHub Pages aus `main` (Workflow „Spiele prüfen“, Jobs „Veröffentlichen“, nach den schnellen Checks).
Zielgruppe der Spiele: Kinder (Kindergarten bis Grundschule), genutzt auf Computer, Tablet und Handy.
Sprache aller Texte: Deutsch, kindgerecht, kurze Sätze.

## Struktur

```
src/games/games.json          Liste aller Spiele – steuert Übersicht, Routen, Highscores, Admin und die Werkzeuge
src/games/catalog.ts          Typen und abgeleitete Felder (path, image, html) zu games.json
src/games/scores.ts           saveScore / loadMyScores – Ergebnisse speichern (Tabelle game_scores)
src/games/states.ts           loadState / saveState – Spielstand pro Spieler (Tabelle game_states)
src/games/plays.ts            useGamePlay – meldet Spielstart + Spielzeit (Tabelle game_plays, für die Statistik)
src/pages/AdminStats.tsx      Admin-Dashboard #/admin/statistik, Zahlen aus der DB-Funktion admin_stats
src/games/HtmlGame.tsx        zeigt HTML-Spiele im iframe, nimmt deren Ergebnisse an
src/games/<key>/index.tsx     React-Spiel (export default), wird automatisch als Route #/spiele/<key> geladen
public/games/<key>/           pro Spiel: readme.md, thumbnail.jpg (900×600), bei HTML-Spielen index.html
public/games/shared/          zoom-schutz.js, game-test.js (Verbindung HTML-Spiel ↔ App)
public/games/shared/vendor/   gemeinsame Bibliotheken für HTML-Spiele (Three.js r128, flag-icons 7.6.0, mit Lizenz)
supabase/migrations/          Datenbank; jedes Spiel braucht eine Zeile in der Tabelle games
                              Kategorien der Übersicht (Schulfächer): Tabellen categories, game_categories (pflegt der Admin)
tools/                        neues-spiel.js, check.js, smoke.js, spieltest.js, geaendert.js, schnell.js, leistung.js,
                              thumbnail.js, lib.js
tools/spieltests/<key>.js     Durchspiel-Test pro Spiel
tools/flugtest.js             gemeinsamer Durchspiel-Test der Flugspiele (europaflug, deutschlandflug, weltflug)
tools/vorlage/                Startpunkt für neue Spiele (HTML- und React-Quiz, readme, Migration, Tests)
.github/workflows/pruefen.yml „Spiele prüfen“ bei jedem Push: schnelle Checks, geänderte Spiele durchspielen,
                              auf main veröffentlichen
.github/workflows/pruefen-voll.yml  „Spiele prüfen (ausführlich)“: main, nachts, per Hand – alle Größen, WebKit, Leistung
docs/GAME_STANDARD.md         Standard für Spiele, Test-Strategie mit Laufzeiten
```

## Zwei Arten von Spielen

| | HTML-Spiel (`"type": "html"`) | React-Spiel (`"type": "react"`) |
|---|---|---|
| Code | `public/games/<key>/index.html`, eine Datei, ohne Build | `src/games/<key>/index.tsx` (+ weitere Dateien im Ordner) |
| Wann | hochgeladene Spiele, Canvas/3D, Spiele aus anderen Repos | Spiele, die Teile der App nutzen |
| Highscore melden | `GameTest.reportScore({ points, maxPoints?, seconds?, variant? })` | `saveScore("<key>", { points, maxPoints?, seconds?, variant? })` |
| Spielstand pro Spieler | `"saveKey"` in games.json + `GameTest.saveState(store)` beim Speichern | `loadState` / `saveState` aus `states.ts` |
| Zurück zur Übersicht | `<a href="../../#/" target="_top">🏠 Alle Spiele</a>` | `<Link to="/">🏠 Alle Spiele</Link>` |

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
- HTML-Spiel: in games.json `"saveKey": "<localStorage-Schlüssel>"` eintragen und überall, wo das Spiel in diesen
  Schlüssel schreibt, zusätzlich `GameTest.saveState(store)` aufrufen. Die App lädt den Stand vor dem Start aus
  Supabase und legt ihn unter `saveKey` ab – das Spiel liest ihn wie bisher synchron aus `localStorage`.
  Andere Kinder am selben Gerät bekommen ihn nicht (`game-test-owner:<key>`). `tools/check.js` prüft beides.
- Im Durchspiel-Test: `page.states` (gespeicherte Stände), Startwerte mit `t.newPage(…, { states: { '<key>': {…} } })`.
- Einstellungen wie Ton an/aus dürfen im Spielstand stehen, Highscores nicht (die gehören nach `game_scores`).

## Aussehen auf Handy und Tablet

Die Spiele werden vor allem auf Handy und Tablet gespielt – dort muss ein Spiel so gut aussehen wie am Computer.
Vorbild: `public/games/sachunterricht-getreideernte` (Bauer Franz).

- **Spielszene bildschirmfüllend**, hoch **und** quer gehalten. Kein festes Hochformat-Raster mit Rand drumherum:
  Raster, Kamera bzw. Ausschnitt an das Seitenverhältnis anpassen.
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
| `node tools/neues-spiel.js <key> "<Titel>" [--react] [--ohne-highscore] [--alter "…"] [--gruppe "…"] [--emoji "…"] [--kategorie "…"]` | Spiel aus der Vorlage anlegen: Dateien, games.json, Migration, Durchspiel-Test. Überschreibt nichts. |
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

1. **Anlegen**: `node tools/neues-spiel.js <key> "<Titel>" …` – key kurz, nur `a-z 0-9 - _`.
   Hochgeladenes HTML-Spiel vorher als `public/games/<key>/index.html` ablegen, es wird nicht überschrieben.
2. **Spiel**: Hochgeladene Spiele inhaltlich nicht verändern (Fragen, Antworten, Ablauf), außer der Nutzer
   erlaubt es. Offensichtliche Fehler beheben und im Pull Request erwähnen. Diese Anpassungen sind erlaubt
   und werden im Pull Request genannt:
   - HTML: Zoom-Schutz + `game-test.js` im `<head>`, viewport mit `maximum-scale=1,user-scalable=no`,
     Links „🏠 Alle Spiele“ (Start, während des Spiels, Ende) auf `../../#/` mit `target="_top"`,
     am Ende `GameTest.reportScore(...)`, Dateien von CDNs lokal ablegen.
   - Ergebnis für die Bestenliste ermitteln (z. B. Fehlversuche und Zeit zählen) und am Ende anzeigen.
3. **Regeln für jedes Spiel**: Spielfläche (`<canvas>`) per CSS auf Bildschirmgröße festlegen – sonst zeigen
   iPad/iPhone (devicePixelRatio 2–3) nur einen vergrößerten Ausschnitt (prüft `smoke.js`); keine fremden
   Server (Skripte, Schriften, Bilder lokal), nur relative Pfade, bedienbar mit Maus/Tastatur **und** Touch (große Knöpfe, kein Hover-Zwang), Fortschritt sichtbar,
   bei falscher Antwort freundliches Feedback und neuer Versuch, Gewinn-Bildschirm mit „Nochmal spielen“,
   keine Werbung, keine Tracker, keine Eingabe persönlicher Daten. Eigener `localStorage`-Schlüssel, nie
   `localStorage.clear()` (löscht den Login).
4. **games.json**: `description` (1 Satz), `age`, `emoji`, `color`, `highscore` ausfüllen.
5. **readme.md** in `public/games/<key>/`: Inhalt, Steuerung, Highscore, Besonderheiten.
6. **Vorschaubild**: `node tools/thumbnail.js <key> …` – typische Spielszene ohne Bedienelemente. Ansehen.
7. **Durchspiel-Test** `tools/spieltests/<key>.js` anpassen (die Vorlage passt zum Vorlagen-Quiz).
   Er muss Gewinn-Bildschirm und gespeichertes Ergebnis prüfen (`page.scores`).
8. **Testen**: `npm test` ohne Fehler; Screenshots in `test-ergebnisse/` (Computer, Tablet, Handy hoch und quer)
   ansehen – auch die laufende Spielszene aus dem Durchspiel-Test, nicht nur den Start-Bildschirm – und mit
   „Aussehen auf Handy und Tablet“ vergleichen; auch die Übersicht (`uebersicht-*.png`) mit der neuen Kachel.
9. **Datenbank**: Migration aus Schritt 1 prüfen (Highscore-Art, Freigabe für Gruppen, Kategorie wie
   Mathe/Deutsch/Sachkunde/Erdkunde/Religion/Freizeit – sonst steht das Spiel unter „Weitere Spiele“) und mit dem
   Supabase-MCP `apply_migration` einspielen (Projekt „Game-test“). Sie legt nur neue Zeilen an und kann vor
   dem Deploy laufen. Danach `get_advisors` (security) ansehen.
10. **Abschluss**: committen, pushen, Pull Request nach `main` (ein Spiel pro Pull Request) mit: was neu ist,
    was am Spiel geändert wurde, ob die Migration schon eingespielt ist. „Spiele prüfen“ muss grün sein.

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
