#!/usr/bin/env node
/* Prüft die Vorlage so, wie sie benutzt wird: In einer Kopie des Repos legt tools/neues-spiel.js ein Spiel an,
   die TODO-Platzhalter werden ersetzt, dann laufen Vorschaubild, check.js, smoke.js und der Durchspiel-Test.
   Ergebnis: Ein neues Spiel erfüllt ab der ersten Minute alle Regeln aus docs/GAME_STANDARD.md.
   Das Repo selbst wird nicht verändert; Screenshots landen in test-ergebnisse/vorlage-probe-*.png.

   Aufruf:  node tools/vorlage-test.js */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OUT, ROOT } from './lib.js';

const KEY = 'vorlage-probe';
const SKIP = new Set(['node_modules', '.git', 'test-ergebnisse', '.test-build', 'dist']);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vorlage-'));
fs.cpSync(ROOT, tmp, { recursive: true, filter: (src) => !(SKIP.has(path.basename(src)) && path.dirname(src) === ROOT) });
fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'));
const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: tmp, stdio: 'inherit' });
};

let ok = false;
try {
  run('node', ['tools/neues-spiel.js', KEY, 'Vorlage-Probe', '--kategorie', 'Mathe', '--gruppe', 'Klasse-3c']);
  /* So, wie es ein echtes Spiel tun würde: Platzhalter-Texte ersetzen */
  for (const f of [`public/games/${KEY}/index.html`, `public/games/${KEY}/game.js`, `public/games/${KEY}/readme.md`, 'src/games/games.json']) {
    const file = path.join(tmp, f);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/TODO:?/g, 'Probe:'));
  }
  run('node', ['tools/thumbnail.js', KEY, '--klick', '[data-action=start]', '--verstecken', '.gt-hud, .gt-bar, .gt-controls', '--warten', '800']);
  run('node', ['tools/check.js']);
  run('node', ['tools/smoke.js', KEY]);
  run('node', ['tools/spieltest.js', KEY]);
  ok = true;
} catch {
  /* Ausgabe steht schon oben */
} finally {
  /* Screenshots zum Ansehen übernehmen, Kopie löschen */
  const shots = path.join(tmp, 'test-ergebnisse');
  if (fs.existsSync(shots)) {
    fs.mkdirSync(OUT, { recursive: true });
    for (const f of fs.readdirSync(shots).filter((n) => n.startsWith(KEY))) fs.copyFileSync(path.join(shots, f), path.join(OUT, f));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(ok ? '\n✓ Vorlage in Ordnung: ein neues Spiel besteht alle Prüfungen.' : '\n✗ Vorlage fehlerhaft (siehe oben).');
process.exit(ok ? 0 : 1);
