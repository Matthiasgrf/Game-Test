#!/usr/bin/env node
/* Leistungsbericht je Spiel (für den ausführlichen Test, siehe docs/GAME_STANDARD.md).
   Öffnet jedes Spiel auf dem Start-Bildschirm, ohne es zu bedienen, und misst:
     Laden        Summe aller geladenen Dateien (ungepackt) – Ziel unter 3 MB (3D-Spiele mit Begründung mehr)
     Start        Zeit bis zum load-Ereignis
     Menü zeichnet  Anteil der Bilder, in denen auf dem Start-Bildschirm etwas gezeichnet wird.
                  Ziel: wenig – ein Spiel, das im Menü wartet, soll das Gerät nicht heiß machen.
     3D           Dreiecke und Zeichenaufrufe pro Bild (Three.js), Maß für die Detailstufe
   Im CI rechnet die CPU die Grafik (keine Grafikkarte) – Bilder/s sind dort kein Maß für ein iPhone.
   Der Bericht warnt nur (⚠), er lässt den Check nicht fehlschlagen; Fehler (✗) gibt es nur, wenn ein
   Spiel nicht lädt oder JavaScript-Fehler wirft.

   Aufruf:  node tools/leistung.js [spiel …]     Bericht als Tabelle (im Workflow auch in der Zusammenfassung) */
import fs from 'node:fs';
import { buildTestApp, launchBrowser, loadGames, mockSupabase, parseArgs, startServer } from './lib.js';

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_IDLE_SHARE = 0.5;

const { keys } = parseArgs(process.argv.slice(2));
const all = loadGames();
const games = keys.length ? all.filter((g) => keys.includes(g.key)) : all;

buildTestApp();
const { server, url } = await startServer();
const browser = await launchBrowser();
const rows = [];
let failed = 0;

/* Zählt gezeichnete Bilder (2D und WebGL) und liest bei Three.js Dreiecke/Zeichenaufrufe pro Bild. */
function messen() {
  const m = { frames: 0, drawn: 0, renders: 0, triangles: 0, calls: 0 };
  window.__leistung = m;
  let drew = false;
  const mark = (proto, names) => {
    if (!proto) return;
    for (const n of names) {
      const orig = proto[n];
      if (typeof orig !== 'function') continue;
      proto[n] = function (...a) { drew = true; return orig.apply(this, a); };
    }
  };
  mark(window.WebGLRenderingContext && WebGLRenderingContext.prototype, ['drawArrays', 'drawElements']);
  mark(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype, ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']);
  mark(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype, ['fillRect', 'drawImage', 'fill', 'stroke', 'fillText']);
  const tick = () => { m.frames++; if (drew) m.drawn++; drew = false; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  /* Three.js: Renderer-Instanzen abfangen, um renderer.info nach jedem Bild zu lesen */
  let three;
  Object.defineProperty(window, 'THREE', {
    configurable: true,
    get() { return three; },
    set(v) {
      three = v;
      let Wrapped;
      Object.defineProperty(v, 'WebGLRenderer', {
        configurable: true, enumerable: true,
        get() { return Wrapped; },
        set(Orig) {
          Wrapped = function (...args) {
            const r = new Orig(...args);
            const render = r.render;
            r.render = function (...ra) {
              const out = render.apply(this, ra);
              m.renders++; m.triangles += r.info.render.triangles; m.calls += r.info.render.calls;
              return out;
            };
            return r;
          };
          Wrapped.prototype = Orig.prototype;
        },
      });
    },
  });
}

for (const g of games) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(messen);
  await mockSupabase(context);
  const page = await context.newPage();
  const errors = [];
  let bytes = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfinished', async (req) => {
    try { bytes += (await req.sizes()).responseBodySize; } catch { /* egal */ }
  });
  /* HTML-Spiele allein öffnen (zählt nur ihre eigenen Dateien), React-Spiele in der App */
  const target = g.type === 'html' ? `${url}games/${g.key}/index.html` : `${url}#/spiele/${g.key}`;
  const t0 = Date.now();
  let row;
  try {
    await page.goto(target, { waitUntil: 'load', timeout: 60000 });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(2000);
    const a = await page.evaluate(() => ({ ...window.__leistung }));
    await page.waitForTimeout(4000);
    const b = await page.evaluate(() => ({ ...window.__leistung }));
    const secs = 4;
    const renders = b.renders - a.renders;
    row = {
      key: g.key,
      bytes,
      loadMs,
      idle: (b.drawn - a.drawn) / Math.max(1, b.frames - a.frames),
      fps: (b.frames - a.frames) / secs,
      triangles: renders ? Math.round((b.triangles - a.triangles) / renders) : null,
      calls: renders ? Math.round((b.calls - a.calls) / renders) : null,
      errors,
    };
  } catch (e) {
    row = { key: g.key, error: e.message.split('\n')[0], errors };
  }
  rows.push(row);
  await context.close();
}
await browser.close();
server.close();

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const lines = [
  '### Leistung je Spiel (Start-Bildschirm, ohne Eingabe)',
  '',
  '| Spiel | Laden | Start | Menü zeichnet | Bilder/s im CI | 3D: Dreiecke / Aufrufe pro Bild | Hinweise |',
  '|---|---:|---:|---:|---:|---:|---|',
];
for (const r of rows) {
  const notes = [];
  if (r.error) notes.push(`✗ lädt nicht: ${r.error}`);
  if (r.errors.length) notes.push(`✗ JavaScript-Fehler: ${[...new Set(r.errors)].join(' | ')}`);
  if (r.bytes > MAX_BYTES) notes.push(`⚠ über 3 MB`);
  if (r.idle > MAX_IDLE_SHARE) notes.push(`⚠ zeichnet im Menü dauernd`);
  if (notes.some((n) => n.startsWith('✗'))) failed++;
  lines.push(r.error
    ? `| ${r.key} | – | – | – | – | – | ${notes.join('; ')} |`
    : `| ${r.key} | ${mb(r.bytes)} | ${(r.loadMs / 1000).toFixed(1)} s | ${Math.round(r.idle * 100)} % | ${r.fps.toFixed(0)} | ${r.triangles !== null ? `${r.triangles.toLocaleString('de-DE')} / ${r.calls}` : '–'} | ${notes.join('; ')} |`);
}
lines.push('', `Ziele: Laden unter 3 MB, im Menü nicht dauernd zeichnen (höchstens ${MAX_IDLE_SHARE * 100} % der Bilder). Bilder/s im CI ohne Grafikkarte – nur zum Vergleich.`);
const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
process.exit(failed ? 1 : 0);
