#!/usr/bin/env node
/* Spielt Spiele automatisch durch – mehr als tools/smoke.js, das nur den Start-Bildschirm öffnet.
   Für jedes Spiel kann es eine Datei tools/spieltests/<key>.js geben. Sie exportiert eine Funktion,
   die das Spiel im Browser bedient und mit t.check(...) meldet, was stimmt und was nicht.

   Aufruf:  node tools/spieltest.js              alle Spiele mit Testdatei
            node tools/spieltest.js elisabeth    nur ein Spiel

   Helfer für die Testdatei (Parameter t):
     t.game                      Eintrag aus games.json
     t.url                       Adresse des Spiels in der App, z. B. http://127.0.0.1:1234/#/spiele/elisabeth
     t.newPage(optionen, login)  neue Browser-Seite, eingeloggt (Login nachgestellt, siehe mockSupabase in lib.js).
                                 optionen wie bei Playwright (viewport, isMobile, hasTouch),
                                 login z. B. { highscores: [...] }. JavaScript-Fehler zählen automatisch als Fehler.
                                 Rückgabe: page; page.scores = Liste der gespeicherten Ergebnisse,
                                 page.states = Liste der gespeicherten Spielstände (game_states)
     t.frame(page)               Inhalt des iframes eines HTML-Spiels
     t.check(text, ok, detail)   eine Prüfung melden
     t.shot(page, name)          Screenshot nach test-ergebnisse/<key>-<name>.png
     t.DESK, t.TABLET, t.PHONE   übliche Größen für Computer, Tablet (iPad quer) und Handy (iPhone),
                                 Tablet und Handy mit hoher Pixeldichte wie die echten Geräte */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { OUT, ROOT, buildTestApp, gameFrame, loadGames, mockSupabase, startServer } from './lib.js';

const DIR = path.join(ROOT, 'tools/spieltests');
const only = process.argv[2];
const games = loadGames();
const keys = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).filter((k) => !only || k === only);
if (!keys.length) {
  console.log(only ? `! Für "${only}" gibt es keinen Durchspiel-Test (tools/spieltests/${only}.js).` : '! Keine Durchspiel-Tests vorhanden.');
  process.exit(0);
}

buildTestApp();
fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch();
let failed = 0;

for (const key of keys) {
  console.log(key);
  const contexts = [], errors = [];
  const check = (text, ok, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${text}${detail !== undefined && detail !== '' ? `  (${detail})` : ''}`);
    if (!ok) failed++;
  };
  const t = {
    game: games.find((g) => g.key === key),
    url: `${url}#/spiele/${key}`,
    DESK: { viewport: { width: 1280, height: 800 } },
    TABLET: { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    PHONE: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    check,
    async newPage(options, login) {
      const context = await browser.newContext(options || {});
      contexts.push(context);
      const { scores, states } = await mockSupabase(context, login);
      const page = await context.newPage();
      page.scores = scores;
      page.states = states;
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`Konsole: ${m.text()}`); });
      return page;
    },
    frame: gameFrame,
    shot: (page, name) => page.screenshot({ path: path.join(OUT, `${key}-${name}.png`) }),
  };
  try {
    if (!t.game) throw new Error(`Spiel "${key}" fehlt in src/games/games.json`);
    const test = (await import(pathToFileURL(path.join(DIR, `${key}.js`)).href)).default;
    await test(t);
  } catch (e) {
    check('Test läuft bis zum Ende', false, e.message.split('\n')[0]);
  }
  check('keine JavaScript-Fehler', errors.length === 0, [...new Set(errors)].join(' | '));
  for (const c of contexts) await c.close();
}

await browser.close();
server.close();
console.log(failed ? `✗ ${failed} Prüfungen fehlgeschlagen.` : '✓ Alles in Ordnung. Screenshots: test-ergebnisse/');
process.exit(failed ? 1 : 0);
