#!/usr/bin/env node
/* Öffnet die App im Browser (Computer, Tablet und Handy – Tablet und Handy mit hoher Pixeldichte
   wie bei iPad und iPhone) mit nachgestelltem Login und meldet:
   JavaScript-Fehler, fehlende Dateien, Zugriffe auf fremde Server, Kacheln und Bilder der
   Übersicht, Seite breiter als der Bildschirm, fehlender Link „🏠 Alle Spiele“ im Spiel,
   Spielfläche (<canvas>) größer als der Bildschirm, Spielfläche auf Tablet/Handy (hoch und quer) zu klein.
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
  { name: 'tablet', viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'handy', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'handy-quer', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];
/* Spiele mit Spielfläche (<canvas>) sollen auf Tablet und Handy den Bildschirm nutzen: Die größte Spielfläche
   muss mindestens so viel der Bildschirmfläche bedecken (0.6 = 60 %). Kleinere Canvas (Vorschau, Deko) zählen nicht. */
const MIN_PLAY_AREA = 0.6;
/* Ältere Spiele, die das noch nicht schaffen: nur Warnung statt Fehler. Nach dem Umbau hier austragen. */
const PLAY_AREA_WARN_ONLY = ['rohr-flitzer', 'liftschlange'];

const only = process.argv[2];
const all = loadGames();
const games = only ? all.filter((g) => g.key === only) : all;
if (!games.length) { console.log(`✗ Kein Spiel "${only}" in src/games/games.json.`); process.exit(1); }

buildTestApp();
fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch();
let failed = 0;
const warnings = [];

async function visit(hash, size, shot, check) {
  const problems = [];
  const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: size.deviceScaleFactor || 1, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch });
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
  /* Kategorien: Filter-Knöpfe und Abschnitte (mockSupabase verteilt die Spiele auf TEST_CATEGORIES). */
  const sections = await page.locator('.category-section .category-title').count();
  if (sections < 2) problems.push(`${sections} Kategorie-Abschnitte sichtbar, erwartet mehrere.`);
  const filter = page.locator('.category-filter button');
  if (await filter.count() !== sections + 1) problems.push('Filter-Knöpfe passen nicht zu den Kategorien (+ „Alle“).');
  else {
    await filter.nth(1).click();
    const shown = await page.locator('.category-section').count();
    if (shown !== 1) problems.push(`Nach Klick auf eine Kategorie ${shown} Abschnitte sichtbar, erwartet 1.`);
    await filter.nth(0).click();
  }
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

/* Eine Spielfläche darf nicht größer als der Bildschirm angezeigt werden. Typischer Fehler: canvas ohne
   CSS-Breite/-Höhe – bei hoher Pixeldichte (iPad, iPhone) sieht man dann nur einen vergrößerten Ausschnitt. */
async function checkCanvas(target, problems) {
  const big = await target.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    return r.width > window.innerWidth + 1 || r.height > window.innerHeight + 1
      ? `${c.id ? `#${c.id}` : 'canvas'} ${Math.round(r.width)}×${Math.round(r.height)} bei Bildschirm ${window.innerWidth}×${window.innerHeight}` : '';
  }).filter(Boolean));
  big.forEach((b) => problems.push(`Spielfläche größer als der Bildschirm (${b}) – canvas braucht CSS-Breite/-Höhe, devicePixelRatio beachten.`));
}

/* Spielfläche zu klein: typischer Fehler ist ein festes Hochformat-Raster mit Rand, Anzeigen darüber und
   Steuerkreuz darunter – auf dem Handy bleibt dann nur ein kleines Feld (vor allem quer). */
async function checkPlayArea(target, g, size, problems) {
  if (!size.isMobile) return;
  const share = await target.evaluate(() => {
    /* Nur sichtbare Spielflächen (versteckte Canvas, z. B. für ein Bonus-Spiel, haben die Größe 0). */
    const areas = [...document.querySelectorAll('canvas')].map((c) => {
      const r = c.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      return w * h;
    }).filter((a) => a > 0);
    return areas.length ? Math.max(...areas) / (innerWidth * innerHeight) : null;
  });
  if (share !== null && share < MIN_PLAY_AREA) {
    (PLAY_AREA_WARN_ONLY.includes(g.key) ? warnings : problems).push(`Spielfläche bedeckt nur ${Math.round(share * 100)} % des Bildschirms (mindestens ${MIN_PLAY_AREA * 100} %) – Spielszene bildschirmfüllend zeichnen, Anzeigen und Steuerung darüberlegen (siehe CLAUDE.md „Aussehen auf Handy und Tablet“).`);
  }
}

const checkGame = (g, size) => async (page, problems) => {
  if (g.type === 'html') {
    const frame = await gameFrame(page);
    await checkCanvas(frame, problems);
    await checkPlayArea(frame, g, size, problems);
    const links = frame.locator('a[href="../../#/"]');
    let visible = false;
    for (let i = 0; i < await links.count(); i++) if (await links.nth(i).isVisible()) visible = true;
    if (!visible) problems.push('Auf dem Start-Bildschirm ist kein Link „🏠 Alle Spiele“ sichtbar.');
  } else {
    const link = page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' });
    if (!(await link.count()) || !(await link.first().isVisible())) problems.push('Kein sichtbarer Link „🏠 Alle Spiele“ zur Übersicht.');
    await checkCanvas(page, problems);
    await checkPlayArea(page, g, size, problems);
    await noOverflow(page, problems);
  }
};

const report = (label, problems) => {
  console.log(`${problems.length ? '✗' : '✓'} ${label}`);
  problems.forEach((p) => console.log(`    ${p}`));
  warnings.splice(0).forEach((w) => console.log(`    ⚠ ${w}`));
  if (problems.length) failed++;
};

for (const size of SIZES) {
  if (!only) {
    report(`Übersicht (${size.name})`, await visit('#/', size, 'uebersicht', checkOverview));
    report(`Highscores (${size.name})`, await visit('#/highscores', size, 'highscores', checkHighscores));
  }
  for (const g of games) report(`${g.key} (${size.name})`, await visit(`#/spiele/${g.key}`, size, g.key, checkGame(g, size)));
}

await browser.close();
server.close();
console.log(failed ? `✗ ${failed} Seiten mit Problemen.` : '✓ Alles in Ordnung. Screenshots: test-ergebnisse/');
process.exit(failed ? 1 : 0);
