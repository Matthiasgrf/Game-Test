#!/usr/bin/env node
/* Prüft die Regeln für Spiele, ohne Browser und ohne Datenbank.
   Aufruf:  node tools/check.js        (oder: npm run check)
   Fehler (✗) müssen behoben werden, Hinweise (!) sollte man sich ansehen.

   Geprüft wird u. a.: games.json, Ordner und Dateien jedes Spiels, Vorschaubild 900×600,
   readme.md, Regeln für HTML- und React-Spiele (Link zur Übersicht, Zoom-Schutz, keine fremden
   Server, Highscore melden) und ob die Migrationen jedes Spiel in der Tabelle games anlegen –
   mit derselben Highscore-Art wie in games.json. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { ROOT, GAMES_JSON, SRC_GAMES, PUBLIC_GAMES, dbModes, loadGames } from './lib.js';

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const rel = (p) => path.relative(ROOT, p);

const KEY_RE = /^[a-z0-9_-]{1,40}$/; // wie in der Datenbank (games.key)
const MODES = ['high', 'low', 'none'];

/* Breite und Höhe aus einer JPEG-Datei lesen (SOF-Abschnitt). */
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker >= 0xd0 && marker <= 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSOF) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

/* localStorage-Schlüssel finden: direkt als Text oder über eine Variable wie  var SAVE='name_v1'. */
function storageKeys(code) {
  const keys = new Set();
  let unknown = false;
  const re = /localStorage\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(?:(['"`])([^'"`]+)\1|([A-Za-z_$][\w$]*))/g;
  for (const m of code.matchAll(re)) {
    if (m[2]) { keys.add(m[2]); continue; }
    const def = new RegExp(`(?:var|let|const)\\s+${m[3].replace(/\$/g, '\\$')}\\s*=\\s*(['"\`])([^'"\`]+)\\1`).exec(code);
    if (def) keys.add(def[2]); else unknown = true;
  }
  if (/localStorage\s*\.\s*clear\s*\(/.test(code)) keys.add('*clear*');
  return { keys: [...keys], unknown };
}

function checkEntry(g, where) {
  for (const f of ['key', 'type', 'title', 'description', 'age', 'emoji', 'color']) {
    if (typeof g[f] !== 'string' || !g[f].trim()) err(where, `Feld "${f}" fehlt.`);
  }
  if (typeof g.key === 'string' && !KEY_RE.test(g.key)) err(where, 'key darf nur Kleinbuchstaben (ohne Umlaute), Ziffern, - und _ enthalten (max. 40).');
  if (g.type && !['react', 'html'].includes(g.type)) err(where, 'type muss "react" oder "html" sein.');
  if (/TODO/.test(`${g.title} ${g.description}`)) err(where, 'enthält noch „TODO“.');
  if (g.description && g.description.length > 140) warn(where, `Beschreibung ist lang (${g.description.length} Zeichen) – ein kurzer Satz passt besser auf die Kachel.`);
  if ('saveKey' in g) {
    if (g.type !== 'html') err(where, 'saveKey gibt es nur bei HTML-Spielen (React-Spiele speichern direkt).');
    if (typeof g.saveKey !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(g.saveKey) || g.saveKey.startsWith('sb-')) err(where, 'saveKey muss ein localStorage-Schlüssel aus A-Z a-z 0-9 - _ sein (nicht sb-…).');
  }
  for (const f of ['path', 'image', 'html', 'thumbnail']) if (f in g) err(where, `Feld "${f}" wird aus dem key abgeleitet und nicht eingetragen.`);

  if (!('highscore' in g)) { err(where, 'Feld "highscore" fehlt (Einstellungen oder null für „ohne Highscore“).'); return; }
  const h = g.highscore;
  if (h === null) return;
  if (typeof h !== 'object') { err(where, 'highscore muss ein Objekt oder null sein.'); return; }
  if (!['high', 'low'].includes(h.better)) err(where, 'highscore.better muss "high" oder "low" sein.');
  if (typeof h.pointsLabel !== 'string' || !h.pointsLabel.trim()) err(where, 'highscore.pointsLabel fehlt (Spaltenüberschrift).');
  if (typeof h.rule !== 'string' || !h.rule.trim()) err(where, 'highscore.rule fehlt (Erklärung über der Bestenliste).');
  if (h.variants !== undefined) {
    if (!Array.isArray(h.variants) || !h.variants.length) err(where, 'highscore.variants muss eine nicht leere Liste sein.');
    else h.variants.forEach((v) => {
      if (!v || !KEY_RE.test(v.id || '') || typeof v.label !== 'string') err(where, `Variante ${JSON.stringify(v)}: id (a-z 0-9 - _) und label nötig.`);
    });
  }
}

/* Syntax prüfen (Lint ohne zusätzliche Werkzeuge): klassische Skripte mit vm.Script, ES-Module mit node --check.
   Findet Tippfehler schon in den schnellen Checks, bevor ein Browser startet. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'check-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
function checkSyntax(where, code, { module = false, file = null } = {}) {
  try {
    if (!module) { new vm.Script(code, { filename: where }); return; }
    let target = file;
    if (!target) { target = path.join(TMP, `${Math.random().toString(36).slice(2)}.mjs`); fs.writeFileSync(target, code); }
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
  } catch (e) {
    const text = String(e.stderr || e.message).split('\n').find((l) => /Error/.test(l)) || String(e.message).split('\n')[0];
    err(where, `Syntaxfehler: ${text.trim()}`);
  }
}

/* Eigene Skripte eines Spiels: inline in index.html und .js-Dateien im Ordner (ohne fertige Bibliotheken *.min.js) */
function checkScripts(dir, html, where) {
  let n = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs) || !m[2].trim()) continue;
    const type = (/\btype\s*=\s*["']([^"']+)["']/i.exec(attrs) || [])[1] || '';
    if (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type)) continue;
    checkSyntax(`${where} (Skript ${++n})`, m[2], { module: type === 'module' });
  }
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    if (!/\.m?js$/.test(f) || /\.min\.js$/.test(f) || f.split(path.sep).includes('vendor')) continue;
    checkSyntax(rel(path.join(dir, f)), null, { module: true, file: path.join(dir, f) });
  }
}

function checkHtmlGame(g, dir) {
  const file = path.join(dir, 'index.html');
  const where = rel(file);
  if (!fs.existsSync(file)) { err(rel(dir), 'index.html fehlt (type "html").'); return; }
  const html = fs.readFileSync(file, 'utf8');

  if (!/<html[^>]*\blang=["']de/i.test(html)) warn(where, '<html lang="de"> fehlt.');
  if (!/<title>\s*\S/i.test(html)) warn(where, '<title> fehlt oder ist leer.');
  const viewport = (/<meta[^>]+name=["']viewport["'][^>]*>/i.exec(html) || [''])[0];
  if (!viewport) err(where, 'viewport-Meta-Tag fehlt (wichtig für Handy und Tablet).');
  else if (!/user-scalable\s*=\s*no/i.test(viewport)) err(where, 'viewport-Meta-Tag braucht "maximum-scale=1,user-scalable=no" (Zoom-Schutz).');
  if (!/<script[^>]+src=["']\.\.\/shared\/zoom-schutz\.js["']/i.test(html)) err(where, 'Zoom-Schutz fehlt: <script src="../shared/zoom-schutz.js"></script> im <head>.');
  if (!/<script[^>]+src=["']\.\.\/shared\/game-test\.js["']/i.test(html)) err(where, 'Verbindung zur App fehlt: <script src="../shared/game-test.js"></script> im <head>.');

  /* Link zur Übersicht: zur App (../../#/) und im ganzen Fenster (target="_top"), nicht im iframe. */
  const homeLinks = [...html.matchAll(/<a\b[^>]*href=["']\.\.\/\.\.\/(#\/)?["'][^>]*>/gi)];
  if (!homeLinks.length) err(where, 'Link zurück zur Übersicht fehlt: <a href="../../#/" target="_top">🏠 Alle Spiele</a>.');
  homeLinks.forEach(([tag, hash]) => {
    if (!hash) err(where, `Link ${tag} → href="../../#/" verwenden (zur App-Übersicht).`);
    if (!/target=["']_top["']/i.test(tag)) err(where, `Link ${tag} braucht target="_top", sonst öffnet sich die App im Spiel.`);
  });
  if (!/Alle Spiele/.test(html)) err(where, 'Text „🏠 Alle Spiele“ für den Link zur Übersicht fehlt.');

  if (g.highscore && !/GameTest\.reportScore\s*\(/.test(html)) err(where, 'Spiel hat Highscore, ruft aber GameTest.reportScore(...) nicht auf.');
  if (!g.highscore && /GameTest\.reportScore\s*\(/.test(html)) warn(where, 'ruft GameTest.reportScore auf, obwohl highscore: null – die App ignoriert das.');

  /* Nichts von fremden Servern laden: Datenschutz, und das Spiel läuft auch bei CDN-Ausfall. */
  const external = new Set();
  for (const m of html.matchAll(/<(?:script|link|img|iframe|audio|video|source|embed|object)\b[^>]*?\b(?:src|href|data)\s*=\s*["'](?:https?:)?\/\/([^"'/]+)/gi)) external.add(m[1]);
  for (const m of html.matchAll(/(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\/([^"')/]+)/gi)) external.add(m[1]);
  external.forEach((host) => err(where, `lädt etwas von ${host} – Dateien lokal unter public/games/ ablegen und relativ einbinden.`));

  /* Pfade: kein führendes "/", fest eingetragene Dateien müssen existieren. */
  for (const m of html.matchAll(/<(?:script|link|img|audio|video|source|a)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) {
    const ref = m[1];
    if (/^\/(?!\/)/.test(ref)) { err(where, `absoluter Pfad "${ref}" – nur relative Pfade verwenden.`); continue; }
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref) || /[+{}$<>]/.test(ref) || /^\.\.\/\.\.\/(#.*)?$/.test(ref)) continue;
    const target = path.resolve(dir, decodeURIComponent(ref.split(/[?#]/)[0]));
    if (!target.startsWith(PUBLIC_GAMES)) err(where, `Pfad "${ref}" zeigt aus public/games/ heraus.`);
    else if (!fs.existsSync(target)) err(where, `Datei "${ref}" gibt es nicht.`);
  }
  checkScripts(dir, html, where);
  return html;
}

function checkReactGame(g) {
  const file = path.join(SRC_GAMES, g.key, 'index.tsx');
  const where = rel(file);
  if (!fs.existsSync(file)) { err(`src/games/${g.key}/`, 'index.tsx fehlt (type "react").'); return; }
  const code = fs.readdirSync(path.dirname(file)).filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => fs.readFileSync(path.join(path.dirname(file), f), 'utf8')).join('\n');
  const main = fs.readFileSync(file, 'utf8');
  if (!/export\s+default\s+/.test(main)) err(where, 'braucht "export default" mit der Spiel-Komponente.');
  if (!/to=["']\/["']/.test(code) || !/Alle Spiele/.test(code)) err(where, 'Link zurück zur Übersicht fehlt: <Link to="/">🏠 Alle Spiele</Link>.');
  const saves = /saveScore\s*\(/.test(code);
  const serverScored = !!g.highscore?.serverScored;
  if (serverScored && saves) err(where, 'ruft saveScore auf, obwohl serverScored: true – die Datenbank speichert das Ergebnis selbst und lehnt saveScore ab.');
  if (g.highscore && !serverScored && !saves) err(where, 'Spiel hat Highscore, ruft aber saveScore(...) nicht auf.');
  if (!g.highscore && saves) err(where, 'ruft saveScore auf, obwohl highscore: null – die Datenbank lehnt das ab.');
  for (const m of code.matchAll(/(?:saveScore|loadMyScores)\s*\(\s*["']([^"']+)["']/g)) {
    if (m[1] !== g.key) err(where, `benutzt den Schlüssel "${m[1]}" statt "${g.key}".`);
  }
  if (!serverScored && /from\s+["'][./]*lib\/supabase["']/.test(code)) warn(where, 'greift direkt auf Supabase zu – für Ergebnisse saveScore/loadMyScores aus src/games/scores.ts nutzen.');
  if (/https?:\/\/(?!localhost)/.test(code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''))) warn(where, 'enthält eine Internet-Adresse – keine fremden Server benutzen.');
  return code;
}

function main() {
  let games = [];
  try { games = loadGames(); } catch (e) { err(rel(GAMES_JSON), `lässt sich nicht lesen: ${e.message}`); }
  if (!Array.isArray(games)) { err(rel(GAMES_JSON), 'muss eine Liste sein.'); games = []; }

  const db = dbModes();
  const seen = new Set();
  const keyOwner = {};

  games.forEach((g, i) => {
    const where = `games.json Eintrag ${i + 1}${g && g.key ? ` (${g.key})` : ''}`;
    if (!g || typeof g !== 'object') { err(where, 'ist kein Objekt.'); return; }
    checkEntry(g, where);
    if (typeof g.key !== 'string' || !KEY_RE.test(g.key)) return;
    if (seen.has(g.key)) err(where, 'key kommt doppelt vor.');
    seen.add(g.key);

    /* Datenbank: Spiel muss per Migration in games stehen, mit passender Highscore-Art. */
    const want = g.highscore ? g.highscore.better : 'none';
    if (!db[g.key]) err(where, `fehlt in der Tabelle games – Migration anlegen: insert into public.games (key, highscore) values ('${g.key}', '${want}');`);
    else if (db[g.key].mode !== want) err(where, `Highscore-Art in games.json ist "${want}", in der Datenbank "${db[g.key].mode}" (${db[g.key].file}).`);
    else if (!!g.highscore?.serverScored !== !!db[g.key].serverScored) err(where, g.highscore?.serverScored
      ? `serverScored: true, aber in der Datenbank fehlt: update public.games set server_scored = true where key = '${g.key}';`
      : `Datenbank speichert Ergebnisse selbst (server_scored), games.json hat aber kein "serverScored": true.`);

    /* Ordner public/games/<key>/: readme.md und thumbnail.jpg für jedes Spiel */
    const dir = path.join(PUBLIC_GAMES, g.key);
    const base = `public/games/${g.key}/`;
    if (!fs.existsSync(dir)) { err(base, 'Ordner fehlt (readme.md, thumbnail.jpg, bei HTML-Spielen index.html).'); return; }
    const files = fs.readdirSync(dir);

    const thumb = path.join(dir, 'thumbnail.jpg');
    if (!files.includes('thumbnail.jpg')) err(base, 'thumbnail.jpg fehlt (900×600, JPEG) – node tools/thumbnail.js ' + g.key);
    else {
      const buf = fs.readFileSync(thumb);
      const size = jpegSize(buf);
      if (!size) err(base + 'thumbnail.jpg', 'ist keine JPEG-Datei.');
      else if (size.width !== 900 || size.height !== 600) err(base + 'thumbnail.jpg', `ist ${size.width}×${size.height} statt 900×600.`);
      if (buf.length > 250 * 1024) warn(base + 'thumbnail.jpg', `ist ${Math.round(buf.length / 1024)} KB groß – unter 250 KB lädt die Übersicht schneller.`);
    }

    const readme = files.find((f) => f.toLowerCase() === 'readme.md');
    if (!readme) err(base, 'readme.md fehlt (Inhalt, Steuerung, Highscore, Besonderheiten).');
    else {
      const text = fs.readFileSync(path.join(dir, readme), 'utf8');
      if (text.trim().length < 40) err(base + readme, 'ist leer oder zu kurz.');
      if (/TODO/.test(text)) err(base + readme, 'enthält noch „TODO“.');
    }

    let code = '';
    if (g.type === 'html') {
      code = checkHtmlGame(g, dir) || '';
      if (fs.existsSync(path.join(SRC_GAMES, g.key))) err(`src/games/${g.key}/`, 'HTML-Spiele liegen nur unter public/games/ – Ordner entfernen oder type "react".');
    } else if (g.type === 'react') {
      code = checkReactGame(g) || '';
      if (files.includes('index.html')) err(base + 'index.html', 'React-Spiele haben keine index.html – type "html" oder Datei entfernen.');
    }

    if (/TODO/.test(code)) err(g.key, 'Spielcode enthält noch „TODO“ (Texte oder Fragen aus der Vorlage).');

    const s = storageKeys(code);
    if (typeof g.saveKey === 'string') {
      if (!s.keys.includes(g.saveKey)) err(g.key, `saveKey "${g.saveKey}" wird im Spiel nicht als localStorage-Schlüssel benutzt.`);
      if (!/GameTest\.saveState\s*\(/.test(code)) err(g.key, 'Spiel hat saveKey, ruft aber GameTest.saveState(...) nicht auf.');
    } else if (/GameTest\.saveState\s*\(/.test(code)) warn(g.key, 'ruft GameTest.saveState auf, hat aber keinen saveKey in games.json – die App ignoriert das.');
    if (s.unknown) warn(g.key, 'localStorage-Schlüssel nicht erkennbar – bitte prüfen, dass er nur zu diesem Spiel gehört.');
    s.keys.forEach((k) => {
      if (k === '*clear*') { err(g.key, 'localStorage.clear() löscht auch die Daten der App und der anderen Spiele.'); return; }
      if (k.startsWith('sb-')) err(g.key, `localStorage-Schlüssel "${k}" gehört Supabase (Login).`);
      if (keyOwner[k] && keyOwner[k] !== g.key) err(g.key, `localStorage-Schlüssel "${k}" wird auch von ${keyOwner[k]} benutzt.`);
      keyOwner[k] = g.key;
    });
  });

  /* Gemeinsame Skripte (ohne Bibliotheken in vendor/) */
  const shared = path.join(PUBLIC_GAMES, 'shared');
  if (fs.existsSync(shared)) checkScripts(shared, '', 'public/games/shared');

  /* Ordner ohne Eintrag */
  for (const d of fs.readdirSync(PUBLIC_GAMES, { withFileTypes: true })) {
    if (!d.isDirectory()) { warn(`public/games/${d.name}`, 'Datei liegt direkt in public/games/ und wird nicht benutzt.'); continue; }
    if (d.name !== 'shared' && !seen.has(d.name)) err(`public/games/${d.name}/`, 'hat keinen Eintrag in src/games/games.json.');
  }
  for (const d of fs.readdirSync(SRC_GAMES, { withFileTypes: true })) {
    if (d.isDirectory() && !seen.has(d.name)) err(`src/games/${d.name}/`, 'hat keinen Eintrag in src/games/games.json.');
  }
  Object.keys(db).filter((k) => !seen.has(k)).forEach((k) => warn(`Tabelle games (${db[k].file})`, `Spiel "${k}" steht in der Datenbank, aber nicht in games.json.`));

  /* Durchspiel-Tests nur für vorhandene Spiele */
  const testDir = path.join(ROOT, 'tools/spieltests');
  if (fs.existsSync(testDir)) {
    fs.readdirSync(testDir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3))
      .filter((k) => !seen.has(k)).forEach((k) => err(`tools/spieltests/${k}.js`, 'gehört zu keinem Spiel in games.json.'));
  }

  warnings.forEach((w) => console.log(`  ! ${w}`));
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log(`${errors.length ? '✗' : '✓'} ${games.length} Spiele geprüft: ${errors.length} Fehler, ${warnings.length} Hinweise.`);
  process.exit(errors.length ? 1 : 0);
}

main();
