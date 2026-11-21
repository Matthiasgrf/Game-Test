#!/usr/bin/env node
/* Erstellt public/games/<key>/thumbnail.jpg (900×600, JPEG) als Screenshot des Spiels.
   HTML-Spiele werden direkt geöffnet, React-Spiele in der App (Login wird nachgestellt).

   Aufruf:  node tools/thumbnail.js <key> [Optionen]
     --klick "<css>"       vor dem Bild anklicken, z. B. den Start-Knopf (mehrfach möglich)
     --tippen "<css>" "<text>"  Text in ein Eingabefeld schreiben (mehrfach möglich)
     Klicks und Eingaben laufen in der angegebenen Reihenfolge.
     --verstecken "<css>"  Elemente ausblenden, z. B. Knöpfe und Anzeigen (mehrfach möglich)
     --warten <ms>         Wartezeit vor dem Bild (Standard 2000)

   Beispiel: node tools/thumbnail.js elisabeth --klick "#start-modal .action-btn" --verstecken "#hud, a, #controls-hint" */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PUBLIC_GAMES, buildTestApp, loadGames, mockSupabase, startServer } from './lib.js';

const args = process.argv.slice(2);
const key = args.shift();
const steps = [], hide = [];
let wait = 2000;
while (args.length) {
  const a = args.shift();
  if (a === '--klick') steps.push({ click: args.shift() });
  else if (a === '--tippen') steps.push({ fill: args.shift(), text: args.shift() });
  else if (a === '--verstecken') hide.push(args.shift());
  else if (a === '--warten') wait = Number(args.shift()) || wait;
  else { console.log(`Unbekannte Option: ${a}`); process.exit(1); }
}
const game = loadGames().find((g) => g.key === key);
if (!game) {
  console.log('Aufruf: node tools/thumbnail.js <key> [--klick "<css>"] [--tippen "<css>" "<text>"] [--verstecken "<css>"] [--warten <ms>]');
  console.log(key ? `✗ Kein Spiel "${key}" in src/games/games.json.` : '');
  process.exit(1);
}

buildTestApp();
const { server, url } = await startServer();
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 900, height: 600 } });
await mockSupabase(context);
const page = await context.newPage();
if (game.type === 'html') await page.goto(`${url}games/${key}/index.html`, { waitUntil: 'load' });
else {
  await page.goto(`${url}#/spiele/${key}`, { waitUntil: 'load' });
  /* Kopfzeile der App gehört nicht aufs Bild */
  await page.addStyleTag({ content: 'body > #root > header{display:none!important}' });
}
await page.waitForTimeout(1000);
for (const step of steps) {
  if (step.click) await page.click(step.click);
  else await page.fill(step.fill, step.text);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(wait);
if (hide.length) await page.addStyleTag({ content: `${hide.join(',')}{visibility:hidden!important}` });
fs.mkdirSync(path.join(PUBLIC_GAMES, key), { recursive: true });
const file = path.join(PUBLIC_GAMES, key, 'thumbnail.jpg');
await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
await browser.close();
server.close();
console.log(`✓ ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB) – bitte ansehen.`);
