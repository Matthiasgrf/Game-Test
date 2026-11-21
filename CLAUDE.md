# Game-Test – Regeln für Claude

React-App (Vite + TypeScript) mit Login über Supabase, Spiele-Übersicht, Gruppen und Highscores.
Veröffentlicht über GitHub Pages aus `main` (Workflow „Deploy to GitHub Pages“).
Zielgruppe der Spiele: Kinder (Kindergarten bis Grundschule), genutzt auf Computer, Tablet und Handy.
Sprache aller Texte: Deutsch, kindgerecht, kurze Sätze.

## Struktur

```
src/games/games.json          Liste aller Spiele – steuert Übersicht, Routen, Highscores, Admin und die Werkzeuge
src/games/catalog.ts          Typen und abgeleitete Felder (path, image, html) zu games.json
src/games/scores.ts           saveScore / loadMyScores – Ergebnisse speichern (Tabelle game_scores)
src/games/HtmlGame.tsx        zeigt HTML-Spiele im iframe, nimmt deren Ergebnisse an
src/games/<key>/index.tsx     React-Spiel (export default), wird automatisch als Route #/spiele/<key> geladen
public/games/<key>/           pro Spiel: readme.md, thumbnail.jpg (900×600), bei HTML-Spielen index.html
public/games/shared/          zoom-schutz.js, game-test.js (Verbindung HTML-Spiel ↔ App)
supabase/migrations/          Datenbank; jedes Spiel braucht eine Zeile in der Tabelle games
tools/                        neues-spiel.js, check.js, smoke.js, spieltest.js, thumbnail.js, lib.js
tools/spieltests/<key>.js     Durchspiel-Test pro Spiel
tools/vorlage/                Startpunkt für neue Spiele (HTML- und React-Quiz, readme, Migration, Tests)
.github/workflows/pruefen.yml „Spiele prüfen“: tsc, check.js, smoke.js, spieltest.js bei jedem Push
```

## Zwei Arten von Spielen

| | HTML-Spiel (`"type": "html"`) | React-Spiel (`"type": "react"`) |
|---|---|---|
| Code | `public/games/<key>/index.html`, eine Datei, ohne Build | `src/games/<key>/index.tsx` (+ weitere Dateien im Ordner) |
| Wann | hochgeladene Spiele, Canvas/3D, Spiele aus anderen Repos | Spiele, die Teile der App nutzen |
| Highscore melden | `GameTest.reportScore({ points, maxPoints?, seconds?, variant? })` | `saveScore("<key>", { points, maxPoints?, seconds?, variant? })` |
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

## Werkzeuge

| Befehl | Zweck |
| --- | --- |
| `node tools/neues-spiel.js <key> "<Titel>" [--react] [--ohne-highscore] [--alter "…"] [--gruppe "…"] [--emoji "…"]` | Spiel aus der Vorlage anlegen: Dateien, games.json, Migration, Durchspiel-Test. Überschreibt nichts. |
| `node tools/thumbnail.js <key> [--klick "<css>"] [--tippen "<css>" "<text>"] [--verstecken "<css>"] [--warten <ms>]` | `thumbnail.jpg` 900×600 als Screenshot |
| `node tools/check.js` | Regeln prüfen ohne Browser – muss ohne Fehler durchlaufen |
| `node tools/smoke.js [key]` | Übersicht, Highscores und Spiele im Browser öffnen (Computer, Tablet, Handy – mit hoher Pixeldichte wie iPad/iPhone), Screenshots in `test-ergebnisse/` |
| `node tools/spieltest.js [key]` | Spiele mit Testdatei in `tools/spieltests/` automatisch durchspielen |
| `npm test` | alles zusammen (tsc, check, smoke, spieltest) |

Die Browser-Werkzeuge bauen die App mit Test-Zugangsdaten (`.test-build/`) und stellen Supabase nach
(`mockSupabase` in `tools/lib.js`): eingeloggt als „testkind“, alle Spiele freigegeben, gespeicherte
Ergebnisse landen in `page.scores`. Es wird nie die echte Datenbank benutzt.
Neue Regeln, die sich automatisch prüfen lassen, in `tools/check.js` ergänzen statt nur hier aufzuschreiben.

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
8. **Testen**: `npm test` ohne Fehler; Screenshots in `test-ergebnisse/` (Computer, Tablet und Handy) ansehen,
   auch die Übersicht (`uebersicht-*.png`) mit der neuen Kachel.
9. **Datenbank**: Migration aus Schritt 1 prüfen (Highscore-Art, Freigabe für Gruppen) und mit dem
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
