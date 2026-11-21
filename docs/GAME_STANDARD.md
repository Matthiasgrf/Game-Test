# Standard für die Spiele in Game-Test

Verbindliche Regeln für alle Browser-Spiele in diesem Repo. `CLAUDE.md` fasst sie für KI-Sitzungen zusammen,
`tools/check.js` und die Browser-Tests prüfen, was sich automatisch prüfen lässt (✓ = wird geprüft).
Ein neues Spiel entsteht mit `node tools/neues-spiel.js` aus der Vorlage und erfüllt damit alle Regeln von Anfang an;
vorher das Briefing [`docs/GAME_BRIEF.md`](GAME_BRIEF.md) ausfüllen.

**Qualitätsmaßstab** für Grafik und Bedienung: „Flug über die Welt“ und „Flug über Europa“.

## 1. Plattform und Aufbau

Eine App für alle Spiele: Login, Übersicht (Kacheln), Highscores und Admin sind eine React-App
(`src/`, GitHub Pages). Die Spiele selbst sind **HTML-Spiele ohne Build** (HTML, CSS, JavaScript als ES-Module)
und laufen in der App bildschirmfüllend in einem iframe. Allein geöffnet (`public/games/<key>/index.html`)
funktionieren sie auch – dann speichern sie nur im Gerät.

```
src/games/games.json            Liste aller Spiele (Manifest) – Übersicht, Routen, Highscores, Werkzeuge
public/manifest.webmanifest     Home-Bildschirm-App (PWA), Icons in public/icons/
public/games/<key>/
  index.html                    Gerüst: Szene, Anzeigen, Fenster (Start, Ende, …)
  game.js                       Spiellogik (ES-Modul)
  assets/                       Bilder (WebP/JPEG/SVG), Töne (MP3)
  thumbnail.jpg                 Vorschaubild 900×600 (node tools/thumbnail.js)
  readme.md                     Inhalt, Steuerung, Highscore, Besonderheiten
public/games/shared/
  kit/                          gemeinsame Bausteine (Abschnitt 5) und Design (theme.css)
  game-test.js, zoom-schutz.js  Verbindung zur App, Zoom-Schutz (in jedem Spiel im <head>)
  vendor/                       Bibliotheken aus der festen Liste (Abschnitt 8)
tools/vorlage/                  Vorlage für neue Spiele (lauffähiges Mini-Spiel)
tools/spieltests/<key>.js       Durchspiel-Test je Spiel
```

**Felder in `games.json`** (✓): `key` (a-z 0-9 - _, wie in der Datenbank), `type` (`"html"`; `"react"` nur Altbestand),
`title`, `description` (ein Satz), `age` (z. B. „3. Klasse“), `emoji`, `color`, `highscore` (Einstellungen oder `null`),
optional `saveKey`, und neu:

| Feld | Werte | Bedeutung |
|---|---|---|
| `zielgruppe` | `kinder` · `erwachsene` | Bereich in der Übersicht: „🧒 Kinder · Lernen“ oder „🎉 Erwachsene · Spaß“ |
| `orientation` | `landscape` · `portrait` · `any` | beste Ausrichtung fürs Gameplay; bei falscher Ausrichtung zeigt das Spiel „Bitte Gerät drehen“ |
| `status` | `live` · `beta` · `entwurf` | Beta bekommt ein Abzeichen, Entwürfe sehen nur Admins |

Wer welches Spiel sieht, regeln außerdem die Gruppen (Tab Admin); Fächer-Kategorien stehen in der Datenbank.

## 2. Darstellung und Größe

- **Spielfläche = sichtbarer Bildschirm.** Die Szene liegt in `<div class="gt-stage">` und füllt den sichtbaren Bereich
  (`--gt-vh` aus `visualViewport`, folgt den ein- und ausfahrenden Leisten von iOS). Im Spiel wird **nie die Seite
  gescrollt** (✓ `<html class="gt">`: `overflow: hidden`, `overscroll-behavior: none`).
- **Seitenverhältnis:** Die *Szene* (Himmel, Landschaft, Hintergrund) füllt immer den ganzen Bildschirm, hoch und quer.
  Was ein festes Seitenverhältnis braucht (Spielbrett, Labyrinth, Raster), behält es und liegt mittig *in* der Szene
  (`board(aspect)` aus dem Kit) – Letterboxing mit Szene statt schwarzer Balken, nie verzerrt, nie abgeschnitten.
  Ist eine Ausrichtung deutlich besser, steht sie in `orientation`; auf Handy und Tablet erscheint dann
  „Bitte dreh dein Gerät“ (Kit), am Computer passt sich das Spiel dem Fenster an.
- **Spielfläche groß genug:** auf Tablet und Handy mindestens 60 % des Bildschirms (✓ smoke.js), Figuren auf dem Handy
  mindestens ca. 32 px, Texte laufen nie über den Rand.
- **Scrollen nur in Textfenstern** (Anleitung, Ergebnis, Infos): `.gt-card` scrollt innen
  (`overscroll-behavior: contain`), die Seite dahinter bleibt stehen.
- **iPhone/iPad:** `touch-action: none` auf der Spielfläche, kein Doppeltipp-Zoom (`zoom-schutz.js`, ✓), viewport mit
  `maximum-scale=1,user-scalable=no,viewport-fit=cover` (✓), Knöpfe und Anzeigen mit Abstand zu Notch und Home-Balken
  (`--gt-top`, `--gt-right`, `--gt-bottom`, `--gt-left` aus `env(safe-area-inset-*)`).
- **Retina:** Canvas-Pixel = CSS-Größe × Pixeldichte, gedeckelt auf 2 (`fitCanvas(canvas)`; Three.js:
  `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`) (✓). Sonst ist das Bild auf iPad/iPhone unscharf.
- **Home-Bildschirm-App:** Die App hat ein Manifest und die Apple-Tags (✓); über „Zum Home-Bildschirm“ läuft sie ohne
  Browserleisten. Achtung iPhone/iPad: Die Home-Bildschirm-App hat einen eigenen Speicher – einmal neu anmelden.
- **Vollbild-Knopf** nur, wo der Browser es kann (Kit prüft das; iPhone-Safari und die Home-Bildschirm-App: kein Knopf).

## 3. Bedienung

- **Tastatur und Touch** für alles, nie nur Hover (✓ Hover-Effekte nur in `@media (hover: hover) and (pointer: fine)`).
  Gleiche Tasten in allen Spielen: ← → ↑ ↓ bzw. A D W S, Leertaste/Enter = Aktion, P/Esc = Pause, M = Ton.
- **Touch-Steuerung** über der Szene, halbtransparent, unten links (Richtung) und unten rechts (Aktion), mindestens
  64 px (Kit-Knöpfe `.gt-ctl`); alle anderen Knöpfe mindestens 48 px. Wischen oder Tippen aufs Ziel als Alternative.
- **Gleiche Bildschirme:** Start → Spiel → Pause → Ende/Ergebnis → zurück zur Übersicht. Start und Ende sind Fenster
  (`.gt-screen` + `.gt-card`) mit „▶ Los geht's!“ bzw. „🔄 Nochmal spielen“ und „🏠 Alle Spiele“ (✓).
- **Gleiche Knöpfe:** die Leiste oben rechts aus dem Kit – ⏸ Pause (nur im Spiel), 🔊/🔇 Ton, Vollbild (wo möglich),
  🏠 Alle Spiele (`../../#/`, `target="_top"`, ✓). Eigene Anzeigen kommen nach oben links (`.gt-hud`).
- **Automatische Pause**, wenn der Tab oder die App in den Hintergrund geht oder das Gerät falsch gedreht ist (Kit).
- **Feedback:** bei falscher Antwort freundlich und neuer Versuch, Fortschritt immer sichtbar, Gewinn-Bildschirm.

## 4. Spielablauf im Code

```js
import { startKit, createLoop, fitCanvas } from '../shared/kit/kit.js';
const kit = startKit({ key: 'mein-spiel', orientation: 'any', pause: () => loop.pause(), resume: () => loop.resume() });
const loop = createLoop({ update(dt) { /* Bewegung × dt */ }, render() { /* zeichnen */ } });
kit.viewport.onResize(() => { view = fitCanvas(canvas); loop.renderOnce(); });
kit.show('start');                 // Fenster mit data-screen="start"
// Los: kit.show(null); kit.setState('play') · Ende: kit.storage.saveScore({ points, seconds }); kit.setState('end'); kit.show('ende')
loop.start();
```

Ein vollständiges Beispiel ist die Vorlage `tools/vorlage/html/` (Sterne-Quiz).

## 5. Gemeinsame Bausteine (`public/games/shared/kit/`)

| Datei | Inhalt |
|---|---|
| `theme.css` | Design als CSS-Variablen, Grundregeln, Knöpfe, Fenster, Anzeigen, Steuerknöpfe, Hinweise |
| `kit.js` | `startKit()`: Leiste, Pause-Fenster, Tasten P/M, Auto-Pause, Drehen-Hinweis; exportiert alle Bausteine |
| `viewport.js` | `createViewport()`, `fitCanvas()`, `board()` – sichtbarer Bereich, Retina, Spielbrett |
| `loop.js` | `createLoop()` – Spielschleife mit dt, Pause ohne Zeichnen, `setMaxFps()`, Zeitraffer für Tests |
| `input.js` | `createInput()` – Aktionen für Tastatur, Touch-Knöpfe, Wischen |
| `sound.js` | `createSound()` – Web-Audio-Klänge, **eine** Ton-Einstellung für alle Spiele |
| `storage.js` | `createStorage()` – Speicher-Schicht (Abschnitt 7) |
| `orientation.js` | „Bitte Gerät drehen“ |
| `fullscreen.js` | Vollbild, nur wo verfügbar |
| `quality.js` | `createQuality()` – Detailstufe automatisch senken, wenn ein Gerät nicht flüssig läuft |

Spiele binden die Bausteine relativ ein (`../shared/kit/…`), ohne Build. Änderungen am Kit testen alle Spiele (CI).

## 6. Design

Das Aussehen kommt aus `theme.css` und ist aus den Flugspielen abgeleitet: Himmel-Verlauf, weiße Karten mit großem
Radius und weichem Schatten, orange Hauptknöpfe (weiter, los), blaue Nebenknöpfe (Alle Spiele), runde
halbtransparente Steuerknöpfe, Schrift „Trebuchet MS“ (auf allen Geräten vorhanden), kurze Übergänge.

- Eigenes Theme **nur über die Variablen** (`--gt-sky-1`, `--gt-primary-1`, `--gt-radius` …) in `:root`, keine eigenen
  Knopf- oder Fensterstile neben dem Kit.
- **Grafik mit Tiefe:** Licht, Schatten, Verläufe, kleine Animationen – keine flachen Platzhalter-Formen.
  Three.js liegt bereit und lohnt sich bei Bewegungs- und Erkundungsspielen.
- Gut lesbare Kontraste (dunkle Schrift `--gt-ink` auf hellen Flächen), Spiel ohne Ton vollständig bedienbar,
  `prefers-reduced-motion` wird beachtet (Kit).

## 7. Speicher (`storage.js`) – austauschbar

Alle Spiele speichern nur über die Speicher-Schicht:

| Aufruf | wofür |
|---|---|
| `kit.storage.saveScore({ points, maxPoints?, seconds?, variant? })` | Ergebnis für die Bestenliste (am Spielende) |
| `await kit.storage.getScores({ variant? })` | eigene Ergebnisse, z. B. für „Dein Rekord“ |
| `kit.storage.saveProgress(daten)` / `kit.storage.loadProgress()` | Spielstand (Fortschritt, gesammelte Dinge) |
| `kit.storage.setting(name, standard)` / `setSetting(name, wert)` | kleine Einstellungen auf diesem Gerät |

Heute gehen Ergebnisse und Spielstände in der App pro Spieler in die Datenbank (Supabase, über `game-test.js`),
allein geöffnet in `localStorage`. Später austauschbar, ohne die Spiele anzufassen. Regeln: Spielstand pro Spieler
nur mit `saveKey` in games.json (✓); Highscores nie im Spielstand; keine persönlichen Daten; nie `localStorage.clear()` (✓).

## 8. Qualität

- **Keine Tracker, keine Werbung, keine fremden Server** (✓) – alles liegt im Repo und wird relativ eingebunden.
- **Bibliotheken nur aus der festen Liste** in `public/games/shared/vendor/`, mit fester Version und Lizenzdatei (✓ keine
  Kopien in Spielordnern): Three.js r128 (`three-r128.min.js`), flag-icons 7.6.0. Neue Bibliothek: erst fragen, dann
  mit Version und Lizenz in `vendor/` und in diese Liste.
- **Kinder-Spiele:** kein Zeitdruck als Pflicht (Zeit zählt höchstens bei Gleichstand), keine Gewalt, große Touch-Ziele,
  einfache Sprache, kurze Sätze; bei Fehlern ermutigen statt bestrafen.
- **Ladezeit:** Ziel unter 3 MB pro Spiel (✓ Hinweis), 3D-Spiele begründen mehr in readme.md. Bilder als WebP/JPEG/SVG,
  Töne als MP3 (✓ große PNG/WAV), Vorschaubild unter 250 KB (✓).
- **Barrierearm:** gut lesbare Kontraste, Bedienung ohne Ton, Tastatur mit sichtbarem Fokus, `aria-label` für Symbolknöpfe.

## 9. Performance

Ziel: flüssige 60 Bilder/s auf einem mittleren iPhone/iPad, ohne dass das Gerät warm wird.

- **Bewegung immer mit dt** (Sekunden seit dem letzten Bild), nie „pro Bild“ – sonst laufen 120-Hz-Geräte doppelt so schnell.
- **Nichts zeichnen, was niemand sieht:** in der Pause und im Hintergrund kein `requestAnimationFrame` (`loop.pause()`),
  im Menü und hinter Fenstern höchstens 15–20 Bilder/s (`loop.setMaxFps()`). `npm run leistung` zeigt, ob ein Spiel
  im Menü dauernd zeichnet.
- **Assets erst laden, wenn das Spiel startet**, nicht auf der Übersicht (die lädt nur Vorschaubilder, und die erst
  beim Scrollen).
- **3D:** Pixeldichte höchstens 2, Texturen klein und komprimiert, gleiche Objekte zusammenfassen
  (`InstancedMesh`, gemeinsame Materialien – wenige Zeichenaufrufe), `createQuality({ renderer })` senkt die
  Detailstufe automatisch auf schwachen Geräten.

## 10. Definition of Done

Ein Spiel (neu oder umgebaut) ist fertig, wenn:

- [ ] Briefing erfüllt, alle „TODO“ ersetzt, `readme.md` vollständig (✓)
- [ ] Eintrag in games.json mit allen Feldern, `status` passend (✓); Migration angelegt und eingespielt (✓ Datei)
- [ ] läuft auf iPhone und iPad in Safari und als Home-Bildschirm-App **ohne Scrollen**, hoch und quer
      (✓ WebKit-Test im ausführlichen Lauf; einmal auf einem echten Gerät ansehen)
- [ ] Desktop (Chrome/Safari/Edge) und Android (Chrome) geprüft (✓ smoke.js: Computer, Tablet, Handy hoch und quer)
- [ ] Pause, Ton, Vollbild und „🏠 Alle Spiele“ funktionieren, Auto-Pause im Hintergrund (Kit, ✓ Durchspiel-Test)
- [ ] Highscore wird gespeichert (✓ `page.scores` im Durchspiel-Test)
- [ ] Vorschaubild vorhanden und angesehen (✓ 900×600)
- [ ] Screenshots der **laufenden** Szene auf Handy hoch und quer angesehen und mit „Flug über die Welt“ verglichen
- [ ] `npm run test:schnell` grün, vor dem Pull Request `npm test`; auf GitHub „Schnelle Checks“ grün

## 11. Altbestand

Spiele von vor diesem Standard stehen in `tools/check.js` in der Liste `ALTBESTAND`: Für sie sind die neuen Regeln
nur Hinweise (`[Altbestand]`). Beim Umstellen eines Spiels (Kit einbinden, Pause/Ton/Vollbild/Drehen-Hinweis,
Retina, dt, kein Seiten-Scrollen; Spielregeln und Fragen bleiben gleich) wird es aus der Liste gestrichen – ab dann
gelten die Regeln als Fehler. Neue Spiele kommen nie auf die Liste.

## 12. Test-Strategie

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
