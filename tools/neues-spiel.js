#!/usr/bin/env node
/* Legt ein neues Spiel an – alles, was ein Spiel in Game-Test braucht, aus tools/vorlage/:
     HTML-Spiel:   public/games/<key>/index.html          (Standard)
     React-Spiel:  src/games/<key>/index.tsx               (--react)
     immer:        public/games/<key>/readme.md
                   tools/spieltests/<key>.js               Durchspiel-Test, passt zur Vorlage
                   Eintrag in src/games/games.json
                   supabase/migrations/<zeit>_spiel_<key>.sql   Zeile in der Tabelle games (+ Freigabe)
   Vorhandene Dateien (z. B. ein hochgeladenes Spiel als index.html) werden nicht überschrieben.

   Aufruf:  node tools/neues-spiel.js <key> "<Titel>" [Optionen]
     --react               React-Spiel statt HTML-Spiel
     --ohne-highscore      Spiel ohne Bestenliste (highscore: null, in der Datenbank 'none')
     --alter "<text>"      z. B. "3. Klasse" (Standard) oder "ab 5 Jahren"
     --gruppe "<Name>"     Spiel für diese Gruppe freigeben, z. B. "Klasse-3c" (mehrfach möglich)
     --emoji "<emoji>"     Emoji für Tabs und Admin (Standard 🎲)

   Beispiel: node tools/neues-spiel.js einmaleins "Einmaleins-Rakete" --gruppe Klasse-3c */
import fs from 'node:fs';
import path from 'node:path';
import { GAMES_JSON, MIGRATIONS, PUBLIC_GAMES, ROOT, SRC_GAMES, dbModes, loadGames } from './lib.js';

const args = process.argv.slice(2);
const key = args.shift();
const title = args.shift();
let react = false, highscore = true, age = '3. Klasse', emoji = '🎲';
const groups = [];
while (args.length) {
  const a = args.shift();
  if (a === '--react') react = true;
  else if (a === '--ohne-highscore') highscore = false;
  else if (a === '--alter') age = args.shift();
  else if (a === '--gruppe') groups.push(args.shift());
  else if (a === '--emoji') emoji = args.shift();
  else { console.log(`✗ Unbekannte Option: ${a}`); process.exit(1); }
}
if (!key || !title || title.startsWith('--')) {
  console.log('Aufruf: node tools/neues-spiel.js <key> "<Titel>" [--react] [--ohne-highscore] [--alter "<text>"] [--gruppe "<Name>"] [--emoji "<emoji>"]');
  process.exit(1);
}
if (!/^[a-z0-9_-]{1,40}$/.test(key)) {
  console.log('✗ Der key darf nur Kleinbuchstaben (ohne Umlaute), Ziffern, - und _ enthalten (max. 40 Zeichen).');
  process.exit(1);
}

const VORLAGE = path.join(ROOT, 'tools/vorlage');
const rel = (p) => path.relative(ROOT, p);
const sql = (s) => s.replace(/'/g, "''");
const fill = (text) => {
  text = text
    .split('SPIEL_KEY').join(key)
    .split('SPIEL_TITEL').join(title)
    .split('SPIEL_ALTER').join(age)
    .split('SPIEL_HIGHSCORE').join(highscore
      ? 'Punkte = Fehlversuche (weniger ist besser), bei Gleichstand die kürzere Zeit.'
      : 'keiner (Spiel ohne Bestenliste).');
  /* Highscore-Teile der Vorlage: behalten (nur Markierungen entfernen) oder ganz löschen */
  return highscore
    ? text.replace(/^[^\n]*HIGHSCORE-(?:START|ENDE)[^\n]*\n/gm, '')
    : text.replace(/^[^\n]*HIGHSCORE-START[\s\S]*?HIGHSCORE-ENDE[^\n]*\n/gm, '');
};
function create(target, template) {
  if (fs.existsSync(target)) { console.log(`  bleibt:  ${rel(target)}`); return; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fill(fs.readFileSync(path.join(VORLAGE, template), 'utf8')));
  console.log(`  neu:     ${rel(target)}`);
}

/* Dateien des Spiels */
if (react) create(path.join(SRC_GAMES, key, 'index.tsx'), 'react/index.tsx');
else create(path.join(PUBLIC_GAMES, key, 'index.html'), 'html/index.html');
create(path.join(PUBLIC_GAMES, key, 'readme.md'), 'readme.md');
create(path.join(ROOT, 'tools/spieltests', `${key}.js`), react ? 'spieltest-react.js' : 'spieltest-html.js');

/* Eintrag in games.json */
const games = loadGames();
if (games.some((g) => g.key === key)) console.log('  bleibt:  Eintrag in src/games/games.json');
else {
  const colors = ['#ffd43b, #ff922b', '#74c0fc, #5c7cfa', '#b2f2bb, #63e6be', '#fcc2d7, #da77f2', '#ffc078, #ff8787', '#99e9f2, #74c0fc'];
  const hash = [...key].reduce((h, c) => h + c.charCodeAt(0), 0);
  games.push({
    key,
    type: react ? 'react' : 'html',
    title,
    description: 'TODO: ein Satz, worum es im Spiel geht.',
    age,
    emoji,
    color: `linear-gradient(135deg, ${colors[hash % colors.length]})`,
    highscore: highscore
      ? { better: 'low', pointsLabel: 'Fehlversuche', showTime: true, rule: 'Bestes Ergebnis je Spieler: wenigste Fehlversuche, bei Gleichstand die schnellste Zeit.' }
      : null,
  });
  fs.writeFileSync(GAMES_JSON, `${JSON.stringify(games, null, 2)}\n`);
  console.log('  neu:     Eintrag in src/games/games.json (Beschreibung noch ausfüllen)');
}

/* Migration für die Tabelle games */
if (dbModes()[key]) console.log(`  bleibt:  Spiel steht schon in der Tabelle games (${dbModes()[key].file})`);
else {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const file = path.join(MIGRATIONS, `${stamp}_spiel_${key.replace(/-/g, '_')}.sql`);
  const release = groups.length
    ? `\n-- Freigabe für Gruppen (weitere später im Tab Admin)\ninsert into public.game_groups (game_key, group_id)\nselect '${key}', g.id from public.groups g\nwhere g.name in (${groups.map((n) => `'${sql(n)}'`).join(', ')})\non conflict do nothing;\n`
    : '\n-- Freigabe für Gruppen: im Tab Admin, oder hier mit --gruppe "<Name>" beim Anlegen.\n';
  fs.writeFileSync(file, fs.readFileSync(path.join(VORLAGE, 'migration.sql'), 'utf8')
    .split('SPIEL_KEY').join(key)
    .split('SPIEL_TITEL').join(title.replace(/\n/g, ' '))
    .split('SPIEL_MODUS').join(highscore ? 'low' : 'none')
    .split('SPIEL_FREIGABE').join(release));
  console.log(`  neu:     ${rel(file)}`);
}

console.log(`
Nächste Schritte (Checkliste in CLAUDE.md):
  1. Spiel, readme.md und Beschreibung in games.json fertig machen (alle „TODO“ ersetzen)
     ${highscore ? 'Highscore: Fehlversuche (weniger ist besser) – sonst games.json und Migration anpassen' : 'ohne Highscore'}
  2. Vorschaubild:   node tools/thumbnail.js ${key}
  3. Prüfen:         npm run check  ·  node tools/smoke.js ${key}  ·  node tools/spieltest.js ${key}
  4. Migration in Supabase einspielen (Supabase-MCP apply_migration)`);
