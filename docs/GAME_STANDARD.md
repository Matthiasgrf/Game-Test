# Standard für die Spiele in Game-Test

Verbindliche Regeln für alle Browser-Spiele in diesem Repo. `CLAUDE.md` fasst sie für KI-Sitzungen zusammen,
`tools/check.js` und die Browser-Tests prüfen, was sich automatisch prüfen lässt.

## Test-Strategie

Ziel: Bei jedem Push in unter 2 Minuten wissen, ob etwas kaputt ist – und trotzdem regelmäßig alles gründlich
prüfen, auch auf iPhone und iPad.

### Die Stufen

| Stufe | Wann | Was | Dauer |
|---|---|---|---|
| **Schnelle Checks**<br>Workflow „Spiele prüfen“, Job „Schnelle Checks“ | jeder Push, jeder Branch | TypeScript · `check.js` (games.json, Dateien, Vorschaubild, Migrationen, Syntax aller Skripte) · `geaendert.js` · alle Seiten und Spiele einmal auf dem Handy laden (Chromium, ohne JavaScript-Fehler) | unter 2 min |
| **Durchspielen**<br>Jobs „Durchspielen ‹Spiel›“ | jeder Push außer auf main – nur die betroffenen Spiele | `spieltest.js` je Spiel in einem eigenen Job, alle parallel | 1–2 min je Spiel |
| **Veröffentlichen**<br>Jobs „Veröffentlichen …“ | Push auf main, sobald die schnellen Checks grün sind | App bauen, GitHub Pages | ~2 min nach dem Merge live |
| **Ausführlich**<br>Workflow „Spiele prüfen (ausführlich)“ | nach jedem Merge auf main, nachts (1:23 UTC), per Hand („Run workflow“) | jedes Spiel als eigener Job: laden auf Computer, Tablet, Handy hoch und quer und durchspielen, 3D echt gezeichnet · Übersicht und Highscores · iPhone und iPad mit WebKit (Safari-Engine) · Leistungsbericht · Screenshots als Artefakte | ~6 min |

Bei reiner Doku (`*.md`, `docs/`) oder Datenbank-Migrationen laufen nur TypeScript und `check.js`, ohne Browser.
Ein neuer Push bricht den laufenden Lauf desselben Branches ab. Jeder Job hat ein Zeitlimit.

### Was ist betroffen? (`tools/geaendert.js`)

Verglichen wird auf einem Branch mit dem Abzweig von `main` (so geht keine Änderung verloren, wenn ein Lauf
abgebrochen wurde), auf `main` mit dem vorigen Stand.

| Geänderte Datei | Durchgespielt wird |
|---|---|
| `*.md`, `docs/`, `.gitignore`, `.env.example` | nichts (keine Browser-Tests) |
| `supabase/` | nichts (`check.js` prüft games.json ↔ Migrationen) |
| `public/games/<key>/`, `src/games/<key>/`, `tools/spieltests/<key>.js` | dieses Spiel |
| ein Werkzeug, das Durchspiel-Tests einbinden (z. B. `tools/flugtest.js`) | die Spiele mit diesem Test |
| `src/games/games.json` | Spiele mit geändertem Eintrag |
| alles andere: App (`src/`), `public/games/shared/`, Vorlage, Werkzeuge, Workflows, `package.json` | alle Spiele |

`node tools/geaendert.js` zeigt lokal, was getestet würde (inklusive nicht eingecheckter Dateien).

### Lokal testen

| Befehl | Wann |
|---|---|
| `npm run test:schnell` | vor jedem Push: wie die schnellen Checks, dazu die betroffenen Spiele durchspielen |
| `npm test` | vor dem Pull Request: alles, alle Größen, alle Spiele |
| `node tools/smoke.js <key> …`, `node tools/spieltest.js <key> …` | beim Arbeiten an einem Spiel |
| `node tools/smoke.js --browser webkit` | iPhone/iPad mit der Safari-Engine (braucht `npx playwright install webkit`) |
| `npm run leistung` | Leistungsbericht: Ladegröße, Zeichnen im Menü, 3D-Detailstufe |

Die Browser-Werkzeuge öffnen mehrere Seiten gleichzeitig (`--parallel`, Standard: Kerne − 1).

### Warum die Tests schnell sind – und was dabei gilt

- **3D ohne Zeichnen**: Ohne Grafikkarte (CI, Container) rechnet die CPU jedes 3D-Bild. Ski-Flitzer schafft so
  nur 5–6 Bilder/s, und weil die Spielzeit an den Bildern hängt, dauert ein Durchspiel-Test Minuten.
  `smoke.js` und `spieltest.js` überspringen deshalb nur die WebGL-Zeichenbefehle (`ohne3dZeichnen` in
  `tools/lib.js`): Spiellogik, Szene, Shader und Kamera laufen unverändert. Für jeden Screenshot (`t.shot`)
  wird echt gezeichnet. Der ausführliche Test zeichnet immer echt (`--zeichnen`).
- **Wartezeiten im Spiel überspringen**: Schließt ein Spiel ein Fenster erst nach ein paar Sekunden, springt der
  Test mit der Playwright-Uhr darüber: `await page.clock.install()` vor `page.goto`, dann
  `await page.clock.fastForward(2600)` (Beispiel: `tools/spieltests/elisabeth.js`).
- **Keine festen Pausen** (`waitForTimeout`) für Spielabläufe: auf einen Zustand warten
  (`waitForFunction`, `waitForSelector`) oder den Test-Zugang des Spiels nutzen (`window.SPIEL`, Zeitraffer).
- Ein Durchspiel-Test soll lokal unter einer Minute bleiben.

### Laufzeiten vorher / nachher

Gemessen auf GitHub (Läufe 49 und 51 vorher, 52 und „ausführlich“ 1 nachher; Runner `ubuntu-latest`).

| | vorher | nachher |
|---|---|---|
| ein Push auf einen Branch mit Pull Request | 2 Läufe (push + pull_request) je 16–19 min | 1 Lauf |
| „Spiele prüfen“, alle Spiele betroffen | 16:08 min (Lauf 49), 18:53 min (Lauf 51) | **1:47 min** (Lauf 52) |
| davon schnelle Checks | – | 0:33 min |
| Laden aller Seiten (Smoke) | 3:10 min (4 Größen, nacheinander) | 0:18 min (Handy, parallel) |
| Durchspielen | 12:14 min nacheinander | parallel, längster Job 1:05 min |
| Ski-Flitzer durchspielen | 4:17 min | 0:41 min (ausführlich mit echtem 3D: 4:28 min) |
| Elisabeth durchspielen | 1:54 min | 0:09 min |
| Bauer Franz durchspielen | 1:50 min | 0:08 min |
| reine Doku-Änderung | 17:12 min (Lauf 41) | unter 30 s, ohne Browser |
| Merge auf main bis online | ~0:30 min, ohne Tests | ~1:30 min, nach den schnellen Checks |
| ausführlicher Test (neu) | – | 5:21 min: 13 Spiele in 4 Größen mit echtem 3D, WebKit iPhone/iPad, Leistung |
| Zeitlimit | 20 min für alles (fast erreicht) | 6 min schnell, 10 min je Spiel, 15 min ausführlich je Job |
