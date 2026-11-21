/* Gemeinsame Helfer für die Werkzeuge in tools/.
   - loadGames()      liest src/games/games.json (gleiche Datei wie die App)
   - dbModes()        Highscore-Art jedes Spiels laut supabase/migrations/ (Tabelle games)
   - buildTestApp()   baut die App mit Test-Zugangsdaten nach .test-build/
   - startServer()    kleiner Webserver für .test-build/ (wie GitHub Pages)
   - mockSupabase()   ersetzt Supabase im Browser: eingeloggt ohne echtes Konto,
                      gespeicherte Ergebnisse landen in einer Liste statt in der Datenbank */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAMES_JSON = path.join(ROOT, 'src/games/games.json');
export const SRC_GAMES = path.join(ROOT, 'src/games');
export const PUBLIC_GAMES = path.join(ROOT, 'public/games');
export const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
export const BUILD = path.join(ROOT, '.test-build');
export const OUT = path.join(ROOT, 'test-ergebnisse');

export const loadGames = () => JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8'));

/* Highscore-Art jedes Spiels laut Migrationen (in Reihenfolge der Dateinamen),
   dazu serverScored (games.server_scored). */
export function dbModes() {
  const modes = {};
  if (!fs.existsSync(MIGRATIONS)) return modes;
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');
    for (const stmt of sql.split(';')) {
      const s = stmt.replace(/\s+/g, ' ').trim();
      if (/^insert into public\.games\b/i.test(s)) {
        for (const m of s.matchAll(/\(\s*'([^']+)'\s*,\s*'(\w+)'\s*\)/g)) modes[m[1]] = { mode: m[2], file };
      }
      let m = /^update public\.games set highscore = '(\w+)' where key = '([^']+)'/i.exec(s);
      if (m) modes[m[2]] = { mode: m[1], file };
      m = /^update public\.games set server_scored = (true|false) where key = '([^']+)'/i.exec(s);
      if (m && modes[m[2]]) modes[m[2]].serverScored = m[1].toLowerCase() === 'true';
      m = /^delete from public\.games where key = '([^']+)'/i.exec(s);
      if (m) delete modes[m[1]];
    }
  }
  return modes;
}


/* Supabase-Adresse für Tests – existiert nicht, alle Anfragen beantwortet mockSupabase(). */
const TEST_URL = 'https://test.supabase.co';
const STORAGE_KEY = 'sb-test-auth-token';

export function buildTestApp() {
  execFileSync('npx', ['vite', 'build', '--outDir', BUILD, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: TEST_URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

/* Liefert .test-build/ aus, verhält sich wie GitHub Pages (index.html in Ordnern, 404). */
export function startServer(dir = BUILD) {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { rel = '/'; }
    let file = path.join(dir, rel);
    if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!rel.endsWith('/')) { res.writeHead(301, { Location: rel + '/' }); res.end(); return; }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

/* Kategorien für die Übersicht im Test; die Spiele werden reihum verteilt. */
export const TEST_CATEGORIES = [
  { id: 1, name: 'Deutsch', emoji: '📚', sort_order: 10 },
  { id: 2, name: 'Mathe', emoji: '🔢', sort_order: 20 },
  { id: 3, name: 'Sachkunde', emoji: '🌱', sort_order: 30 },
];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/* Supabase im Browser nachstellen. Aufruf vor page.goto(), pro Browser-Kontext.
   Optionen:
     role        'user' (Standard) oder 'admin'
     username    Name des Testkinds (Standard 'testkind')
     games       Spiele, die für die Gruppe des Kinds freigegeben sind (Standard: alle)
     highscores  Zeilen für die View game_highscores
     states      gespeicherte Spielstände je Spiel, z. B. { 'mathe-robi': { bank: 500 } } (Tabelle game_states)
   Rückgabe: { scores, states }
     scores  jedes gespeicherte Ergebnis (Inhalt des Inserts in game_scores; bei Zahlenraten
             trägt es – wie in der echten DB – zahlenraten_raten ein)
     states  jeder gespeicherte Spielstand (Inhalt des Upserts in game_states, mit game_key und data) */
export async function mockSupabase(context, options = {}) {
  const { role = 'user', username = 'testkind', highscores = [] } = options;
  const games = options.games || loadGames().map((g) => g.key);
  const uid = '00000000-0000-4000-8000-000000000001';
  const exp = 4102444800; // Jahr 2100
  const session = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', exp })}.test`,
    refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: exp,
    user: { id: uid, aud: 'authenticated', role: 'authenticated', email: `${username}@game-test.local`, app_metadata: {}, user_metadata: {} },
  };
  const scores = [];
  const states = [];
  const saved = { ...(options.states || {}) };
  let zr = { id: 0, secret: 0, attempts: 0, open: false };
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* z. B. about:blank */ }
  }, [STORAGE_KEY, JSON.stringify(session)]);
  await context.route((u) => u.hostname === 'test.supabase.co', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() === 'POST' && table === 'game_scores') {
      const body = req.postDataJSON();
      scores.push(...(Array.isArray(body) ? body : [body]));
      return route.fulfill({ status: 201, body: '' });
    }
    // Zahlenraten läuft in der Datenbank (zahlenraten_start / zahlenraten_raten) – hier nachgestellt
    if (req.method() === 'POST' && table === 'zahlenraten_start') {
      if (!zr.open) zr = { id: zr.id + 1, secret: 1 + Math.floor(Math.random() * 100), attempts: 0, open: true };
      return json({ runde: zr.id, versuche: zr.attempts });
    }
    if (req.method() === 'POST' && table === 'zahlenraten_raten') {
      const { p_runde, p_tipp } = req.postDataJSON();
      if (!zr.open || p_runde !== zr.id) return json({ message: 'Diese Runde ist schon vorbei.' }, 400);
      zr.attempts++;
      const ergebnis = p_tipp < zr.secret ? 'zu_klein' : p_tipp > zr.secret ? 'zu_gross' : 'richtig';
      if (ergebnis === 'richtig') {
        zr.open = false;
        scores.push({ game_key: 'zahlenraten', variant: '', points: zr.attempts, max_points: null, seconds: null });
      }
      return json({ ergebnis, versuche: zr.attempts });
    }
    if (req.method() === 'POST' && table === 'game_states') {
      const body = req.postDataJSON();
      for (const row of Array.isArray(body) ? body : [body]) { states.push(row); saved[row.game_key] = row.data; }
      return route.fulfill({ status: 201, body: '' });
    }
    if (req.method() !== 'GET') return json({});
    switch (table) {
      case 'profiles':
        return json({ id: uid, username, role, created_at: '2026-01-01T00:00:00Z' });
      case 'groups':
        return json([{ id: 1, name: 'Testgruppe', created_at: '2026-01-01T00:00:00Z' }]);
      case 'user_groups':
        return json([{ user_id: uid, group_id: 1 }]);
      case 'game_groups':
        return json(games.map((k) => ({ game_key: k, group_id: 1 })));
      case 'categories':
        return json(TEST_CATEGORIES);
      case 'game_categories':
        return json(games.map((k, i) => ({ game_key: k, category_id: TEST_CATEGORIES[i % TEST_CATEGORIES.length].id })));
      case 'game_highscores':
        return json(highscores);
      case 'game_states': {
        const key = (url.searchParams.get('game_key') || '').replace(/^eq\./, '');
        const rows = key in saved ? [{ data: saved[key] }] : [];
        if (/vnd\.pgrst\.object/.test(req.headers().accept || '')) return rows.length ? json(rows[0]) : json({}, 406);
        return json(rows);
      }
      default:
        return json([]);
    }
  });
  return { scores, states };
}

/* Inhalt des iframes eines HTML-Spiels, sobald game-test.js geladen ist. */
export async function gameFrame(page) {
  const frame = await (await page.waitForSelector('iframe.html-game')).contentFrame();
  await frame.waitForFunction(() => !!window.GameTest);
  return frame;
}
