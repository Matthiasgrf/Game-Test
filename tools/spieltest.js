#!/usr/bin/env node
/* Spielt Spiele automatisch durch – mehr als tools/smoke.js, das nur den Start-Bildschirm öffnet.
   Für jedes Spiel kann es eine Datei tools/spieltests/<key>.js geben. Sie exportiert eine Funktion,
   die das Spiel im Browser bedient und mit t.check(...) meldet, was stimmt und was nicht.

   Aufruf:  node tools/spieltest.js                       alle Spiele mit Testdatei (mehrere gleichzeitig)
            node tools/spieltest.js elisabeth weltflug    nur diese Spiele (auch mit Komma: elisabeth,weltflug)
   Optionen:
            --parallel <n>   so viele Spiele gleichzeitig (Standard: Kerne − 1, höchstens 4)
            --zeichnen       3D-Szenen wirklich zeichnen (langsam ohne Grafikkarte, z. B. im CI).
                             Ohne die Option überspringt der Test nur die WebGL-Zeichenbefehle, Spiellogik
                             und Szene laufen normal; t.shot zeichnet für jeden Screenshot echt (siehe lib.js).

   Helfer für die Testdatei (Parameter t):
     t.game                      Eintrag aus games.json
     t.url                       Adresse des Spiels in der App, z. B. http://127.0.0.1:1234/#/spiele/elisabeth
     t.newPage(optionen, login)  neue Browser-Seite, eingeloggt (Login nachgestellt, siehe mockSupabase in lib.js).
                                 optionen wie bei Playwright (viewport, isMobile, hasTouch),
                                 login z. B. { highscores: [...] }. JavaScript-Fehler zählen automatisch als Fehler.
                                 Rückgabe: page; page.scores = Liste der gespeicherten Ergebnisse,
                                 page.states = Liste der gespeicherten Spielstände (game_states).
                                 Wartezeiten im Spiel (setTimeout) lassen sich mit page.clock überspringen
                                 (Playwright-Uhr, siehe tools/spieltests/elisabeth.js).
     t.frame(page)               Inhalt des iframes eines HTML-Spiels
     t.check(text, ok, detail)   eine Prüfung melden
     t.shot(page, name)          Screenshot nach test-ergebnisse/<key>-<name>.png
     t.DESK, t.TABLET, t.PHONE   übliche Größen für Computer, Tablet (iPad quer) und Handy (iPhone),
     t.PHONE_QUER                Handy quer gehalten. Tablet und Handy mit hoher Pixeldichte wie die echten Geräte.
                                 Von Spielen mit Spielfläche die laufende Szene auf Handy hoch und quer mit t.shot
                                 festhalten und ansehen (smoke.js sieht nur den Start-Bildschirm). */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  OUT, PARALLEL, ROOT, buildTestApp, gameFrame, launchBrowser, loadGames, mockSupabase, ohne3dZeichnen,
  parseArgs, pool, startServer, zeichnenAn,
} from './lib.js';

const DIR = path.join(ROOT, 'tools/spieltests');
const { keys: wanted, opts } = parseArgs(process.argv.slice(2), ['zeichnen']);
const parallel = Number(opts.parallel) || PARALLEL;
const games = loadGames();
const available = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const keys = wanted.length ? wanted.filter((k) => available.includes(k)) : available;
wanted.filter((k) => !available.includes(k))
  .forEach((k) => console.log(`! Für "${k}" gibt es keinen Durchspiel-Test (tools/spieltests/${k}.js).`));
if (!keys.length) {
  if (!wanted.length) console.log('! Keine Durchspiel-Tests vorhanden.');
  process.exit(0);
}

buildTestApp();
fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await launchBrowser();
const started = Date.now();
console.log(`${keys.length} Spiel(e), ${Math.min(parallel, keys.length)} gleichzeitig${opts.zeichnen ? ', 3D wird gezeichnet' : ''}.`);

/* Ein Spiel durchspielen. Die Ausgabe wird gesammelt und am Stück gedruckt, damit sich parallele
   Spiele nicht mischen. */
async function run(key) {
  const lines = [];
  const contexts = [], errors = [];
  let failed = 0;
  const t0 = Date.now();
  const check = (text, ok, detail) => {
    lines.push(`  ${ok ? '✓' : '✗'} ${text}${detail !== undefined && detail !== '' ? `  (${detail})` : ''}`);
    if (!ok) failed++;
  };
  const t = {
    game: games.find((g) => g.key === key),
    url: `${url}#/spiele/${key}`,
    DESK: { viewport: { width: 1280, height: 800 } },
    TABLET: { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    PHONE: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    PHONE_QUER: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    check,
    async newPage(options, login) {
      const context = await browser.newContext(options || {});
      contexts.push(context);
      if (!opts.zeichnen) await ohne3dZeichnen(context);
      const { scores, states } = await mockSupabase(context, login);
      const page = await context.newPage();
      page.scores = scores;
      page.states = states;
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`Konsole: ${m.text()}`); });
      return page;
    },
    frame: gameFrame,
    async shot(page, name) {
      if (!opts.zeichnen) await zeichnenAn(page, true);
      await page.screenshot({ path: path.join(OUT, `${key}-${name}.png`) });
      if (!opts.zeichnen) await zeichnenAn(page, false);
    },
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
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`${failed ? '✗' : '✓'} ${key}  (${seconds} s)\n${lines.join('\n')}`);
  return { key, failed, seconds };
}

const results = await pool(keys, parallel, run);
await browser.close();
server.close();

const failed = results.reduce((n, r) => n + r.failed, 0);
const total = Math.round((Date.now() - started) / 1000);
console.log(`Dauer: ${total} s – ${results.map((r) => `${r.key} ${r.seconds} s`).join(', ')}`);
console.log(failed ? `✗ ${failed} Prüfungen fehlgeschlagen.` : '✓ Alles in Ordnung. Screenshots: test-ergebnisse/');
process.exit(failed ? 1 : 0);
