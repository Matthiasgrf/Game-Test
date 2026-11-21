#!/usr/bin/env node
/* Öffnet die App im Browser (Computer- und Handy-Größe) mit nachgestelltem Login und meldet:
   JavaScript-Fehler, fehlende Dateien, Zugriffe auf fremde Server, Kacheln und Bilder der
   Übersicht, Seite breiter als der Bildschirm, fehlender Link „🏠 Alle Spiele“ im Spiel.
   Screenshots landen in test-ergebnisse/ zum Ansehen.

   Aufruf:  node tools/smoke.js              Übersicht, Highscores und alle Spiele
            node tools/smoke.js elisabeth    nur ein Spiel

   Der Test spielt die Spiele nicht durch – dafür gibt es tools/spieltest.js. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { OUT, buildTestApp, gameFrame, loadGames, mockSupabase, startServer } from './lib.js';

const SIZES = [
  { name: 'computer', viewport: { width: 1280, height: 800 } },
  { name: 'handy', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const only = process.argv[2];
const all = loadGames();
const games = only ? all.filter((g) => g.key === only) : all;
if (!games.length) { console.log(`✗ Kein Spiel "${only}" in src/games/games.json.`); process.exit(1); }

buildTestApp();
fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch();
let failed = 0;

async function visit(hash, size, shot, check) {
  const problems = [];
  const context = await browser.newContext({ viewport: size.viewport, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch });
  /* Fremde Server werden gesperrt und gemeldet (Supabase stellt mockSupabase nach). */
  await context.route((u) => !u.href.startsWith(url) && u.hostname !== 'test.supabase.co' && /^https?:/.test(u.protocol), (route) => {
    problems.push(`Zugriff auf fremden Server: ${route.request().url()}`);
    return route.abort();
  });
  await mockSupabase(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`JavaScript-Fehler: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`Konsole: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url().replace(url, '')}`); });
  try {
    await page.goto(url + hash, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    if (check) await check(page, problems);
    await page.screenshot({ path: path.join(OUT, `${shot}-${size.name}.png`) });
  } catch (e) {
    problems.push(`Seite lässt sich nicht öffnen: ${e.message.split('\n')[0]}`);
  }
  await context.close();
  return [...new Set(problems)];
}

const noOverflow = async (page, problems) => {
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) {
    problems.push('Seite ist breiter als der Bildschirm (waagerechtes Scrollen).');
  }
};

async function checkOverview(page, problems) {
  const tiles = await page.locator('.game-tile').count();
  if (tiles !== all.length) problems.push(`${tiles} Kacheln sichtbar, erwartet ${all.length}.`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  broken.forEach((src) => problems.push(`Vorschaubild lädt nicht: ${src}`));
  await noOverflow(page, problems);
}

async function checkHighscores(page, problems) {
  const withScore = all.filter((g) => g.highscore).length;
  const tabs = await page.locator('main .tabs').first().locator('button').count();
  if (tabs !== withScore) problems.push(`${tabs} Spiele unter Highscores, erwartet ${withScore} (nur Spiele mit Highscore).`);
  await noOverflow(page, problems);
}

const checkGame = (g) => async (page, problems) => {
  if (g.type === 'html') {
    const frame = await gameFrame(page);
    const links = frame.locator('a[href="../../#/"]');
    let visible = false;
    for (let i = 0; i < await links.count(); i++) if (await links.nth(i).isVisible()) visible = true;
    if (!visible) problems.push('Auf dem Start-Bildschirm ist kein Link „🏠 Alle Spiele“ sichtbar.');
  } else {
    const link = page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' });
    if (!(await link.count()) || !(await link.first().isVisible())) problems.push('Kein sichtbarer Link „🏠 Alle Spiele“ zur Übersicht.');
    await noOverflow(page, problems);
  }
};

const report = (label, problems) => {
  console.log(`${problems.length ? '✗' : '✓'} ${label}`);
  problems.forEach((p) => console.log(`    ${p}`));
  if (problems.length) failed++;
};

for (const size of SIZES) {
  if (!only) {
    report(`Übersicht (${size.name})`, await visit('#/', size, 'uebersicht', checkOverview));
    report(`Highscores (${size.name})`, await visit('#/highscores', size, 'highscores', checkHighscores));
  }
  for (const g of games) report(`${g.key} (${size.name})`, await visit(`#/spiele/${g.key}`, size, g.key, checkGame(g)));
}

await browser.close();
server.close();
console.log(failed ? `✗ ${failed} Seiten mit Problemen.` : '✓ Alles in Ordnung. Screenshots: test-ergebnisse/');
process.exit(failed ? 1 : 0);
