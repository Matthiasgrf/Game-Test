#!/usr/bin/env node
/* Was muss getestet werden? Vergleicht den Stand mit einer Basis (git) und ordnet die geänderten Dateien zu.
   Damit prüft „Spiele prüfen“ nur, was sich geändert hat (siehe docs/GAME_STANDARD.md, Test-Strategie).

   Aufruf:  node tools/geaendert.js              Basis: Abzweig von origin/main, dazu nicht eingecheckte Dateien
            node tools/geaendert.js <commit>     Basis selbst wählen
            node tools/geaendert.js <von> <bis>  zwei Stände vergleichen, z. B. was ein alter Commit getestet hätte
            node tools/geaendert.js --keys       nur die Spiele zum Durchspielen, mit Komma (für spieltest.js)
            node tools/geaendert.js --github     im Workflow: Basis aus dem Ereignis, Ergebnis nach $GITHUB_OUTPUT

   Regeln (erste passende gilt):
     nur Doku: *.md, docs/, .gitignore, .env.example     → keine Browser-Tests
     supabase/ (Migrationen, Funktionen)                  → keine Browser-Tests (check.js prüft games ↔ Migrationen)
     public/games/<key>/, src/games/<key>/,
     tools/spieltests/<key>.js                            → dieses Spiel
     Werkzeug, das Durchspiel-Tests einbinden (flugtest)  → die Spiele, deren Test es einbindet
     src/games/games.json                                 → Spiele mit geändertem Eintrag (+ Übersicht)
     alles andere: App (src/), shared/, Vorlage, Werkzeuge, Workflows, package.json … → alle Spiele
   Ergebnis (JSON): { basis, dateien, alle, browser, durchspielen: [keys], gruende: [...] } */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadGames } from './lib.js';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };
const ZERO = /^0+$/;

const args = process.argv.slice(2);
const github = args.includes('--github');
const keysOnly = args.includes('--keys');
const [explicitBase, explicitHead] = args.filter((a) => !a.startsWith('--'));

const testKeys = fs.readdirSync(path.join(ROOT, 'tools/spieltests')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));

/* Basis bestimmen. null = keine sinnvolle Basis → alles testen. */
function findBase() {
  if (explicitBase) return { ref: explicitBase, head: explicitHead, text: explicitHead ? `${explicitBase}..${explicitHead}` : explicitBase, worktree: !github && !explicitHead };
  if (github) {
    const event = process.env.GITHUB_EVENT_NAME;
    if (event !== 'push') return { ref: null, text: `Ereignis „${event}“ → alles` };
    const payload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (process.env.GITHUB_REF_NAME === 'main') {
      /* main: gegen den vorigen Stand von main (der volle Test läuft dort ohnehin) */
      if (!payload.before || ZERO.test(payload.before) || !tryGit('cat-file', '-e', `${payload.before}^{commit}`)) return { ref: null, text: 'main ohne vorigen Stand → alles' };
      return { ref: payload.before, text: `voriger Stand von main ${payload.before.slice(0, 7)}` };
    }
  }
  /* Branch: alles seit dem Abzweig von main – so geht keine Änderung verloren, wenn ein Lauf abgebrochen wurde */
  const base = tryGit('merge-base', 'origin/main', 'HEAD');
  if (!base) return { ref: null, text: 'origin/main nicht gefunden → alles' };
  return { ref: base, text: `Abzweig von origin/main ${base.slice(0, 7)}`, worktree: !github };
}

function changedFiles(base) {
  /* Mit worktree auch nicht eingecheckte und neue Dateien (lokal), im Workflow nur Commits bis HEAD. */
  const diff = base.worktree ? git('diff', '--name-only', base.ref) : git('diff', '--name-only', base.ref, base.head || 'HEAD');
  const files = diff ? diff.split('\n') : [];
  if (base.worktree) {
    const untracked = git('ls-files', '--others', '--exclude-standard');
    if (untracked) files.push(...untracked.split('\n'));
  }
  return [...new Set(files)].filter(Boolean);
}

/* games.json: welche Einträge sind neu oder anders? null = nicht vergleichbar */
function changedEntries(base) {
  let before;
  try { before = JSON.parse(git('show', `${base.ref}:src/games/games.json`)); } catch { return null; }
  const now = loadGames();
  const old = new Map(before.map((g) => [g.key, JSON.stringify(g)]));
  return now.filter((g) => old.get(g.key) !== JSON.stringify(g)).map((g) => g.key);
}

/* Werkzeuge, die Durchspiel-Tests einbinden (z. B. tools/flugtest.js) → deren Spiele */
function testsImporting(file) {
  const name = path.basename(file);
  return testKeys.filter((k) => fs.readFileSync(path.join(ROOT, 'tools/spieltests', `${k}.js`), 'utf8').includes(`'../${name}'`));
}

function classify(files, base) {
  const games = new Set(loadGames().map((g) => g.key));
  const affected = new Set();
  const reasons = [];
  let all = false, browser = false;
  for (const f of files) {
    let m;
    if (/\.md$/i.test(f) || f.startsWith('docs/') || ['.gitignore', '.env.example'].includes(f)) {
      reasons.push(`${f}: Doku`);
    } else if (f.startsWith('supabase/')) {
      reasons.push(`${f}: Datenbank (check.js)`);
    } else if ((m = /^public\/games\/([^/]+)\//.exec(f)) && m[1] !== 'shared') {
      affected.add(m[1]); browser = true; reasons.push(`${f}: ${m[1]}`);
    } else if ((m = /^src\/games\/([^/]+)\//.exec(f))) {
      affected.add(m[1]); browser = true; reasons.push(`${f}: ${m[1]}`);
    } else if ((m = /^tools\/spieltests\/([^/]+)\.js$/.exec(f))) {
      affected.add(m[1]); browser = true; reasons.push(`${f}: ${m[1]}`);
    } else if (/^tools\/[^/]+\.js$/.test(f) && testsImporting(f).length) {
      const keys = testsImporting(f);
      keys.forEach((k) => affected.add(k)); browser = true; reasons.push(`${f}: ${keys.join(', ')}`);
    } else if (f === 'src/games/games.json') {
      const keys = changedEntries(base);
      browser = true;
      if (keys === null) { all = true; reasons.push(`${f}: nicht vergleichbar → alle`); } else {
        keys.forEach((k) => affected.add(k)); reasons.push(`${f}: Einträge ${keys.join(', ') || '(nur entfernt/umsortiert)'}`);
      }
    } else {
      all = true; browser = true; reasons.push(`${f}: betrifft alle Spiele`);
    }
  }
  const play = all ? testKeys : testKeys.filter((k) => affected.has(k));
  return { all, browser, play: play.filter((k) => games.has(k)), reasons };
}

const base = findBase();
const everything = (why) => ({ basis: base.text, dateien: null, alle: true, browser: true, durchspielen: testKeys, gruende: [why] });
let result;
if (!base.ref) {
  result = everything(base.text);
} else {
  let files = null;
  try { files = changedFiles(base); } catch { /* Basis unbekannt (z. B. nicht geholt) */ }
  if (!files) result = everything(`Basis ${base.ref} unbekannt → alles`);
  else {
    const c = classify(files, base);
    result = { basis: base.text, dateien: files.length, alle: c.all, browser: c.browser, durchspielen: c.play, gruende: c.reasons };
  }
}

if (keysOnly) {
  console.log(result.durchspielen.join(','));
} else if (github) {
  const out = [`alle=${result.alle}`, `browser=${result.browser}`, `durchspielen=${JSON.stringify(result.durchspielen)}`, `anzahl=${result.durchspielen.length}`];
  fs.appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
  const summary = [
    '### Was wird getestet?',
    `Basis: ${result.basis} · ${result.dateien ?? '–'} geänderte Dateien`,
    '',
    result.browser ? `- Browser-Tests: **ja**${result.alle ? ' (betrifft alle Spiele)' : ''}` : '- Browser-Tests: **nein** (nur Doku/Datenbank)',
    `- Durchspielen: ${result.durchspielen.length ? result.durchspielen.join(', ') : '–'}`,
    '',
    '<details><summary>Zuordnung der Dateien</summary>', '', ...result.gruende.slice(0, 200).map((r) => `- ${r}`), '', '</details>',
  ];
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(JSON.stringify(result, null, 2));
}
