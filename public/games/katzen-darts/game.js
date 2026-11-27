/* Katzen-Darts – Spiellogik (Regeln: docs/GAME_STANDARD.md).

   Eine Dartscheibe an der Holzwand einer Après-Ski-Hütte, drumherum laufen Katzen über Regal, Fensterbank
   und Theke. 5 Runden × 3 Würfe. Zielen: Halten lädt die Kraft (Ring ums Fadenkreuz, grüner Bereich = genau),
   Loslassen wirft. Der Pfeil fliegt kurz – auf laufende Katzen muss man vorhalten.
   Ungefähr jeder 4.–5. Wurf ist Bier (Maßkrug mit Spritz-Radius oder Bierflasche im Bogen); jedes Bier hebt
   die Promille, und je höher die Promille, desto stärker wackelt das Fadenkreuz.

   Alles, was jedes Spiel braucht (Leiste, Pause, Ton, Drehen-Hinweis, Speicher), kommt aus dem Kit.
   Alle Bewegungen mit dt, Positionen der Katzen als Anteil der Breite (hoch und quer gleich). */
import { startKit, createLoop, fitCanvas } from '../shared/kit/kit.js';

const RUNDEN = 5;
const WUERFE = 3;

/* Wurf-Arten: flug = Flugzeit in Sekunden */
const ARTEN = {
  pfeil: { name: 'Pfeil', icon: '🎯', flug: 0.42 },
  krug: { name: 'Maßkrug', icon: '🍺', flug: 0.8 },
  flasche: { name: 'Bierflasche', icon: '🍾', flug: 0.62 },
};

/* Katzen: tempo in Katzen-Einheiten (u) pro Sekunde */
const KATZEN = {
  tiger: { name: 'Tiger-Kater', punkte: 30, tempo: 2.6, fell: '#f39a3d', fell2: '#c4621a', streifen: '#8a3d0a' },
  pummel: { name: 'Pummel', punkte: 10, tempo: 1.0, groesse: 1.3, fell: '#b4b4bd', fell2: '#80808c' },
  ski: { name: 'Ski-Katze', punkte: 40, tempo: 6.2, doppel: true, fell: '#f6f2ea', fell2: '#c9bfb0' },
  gold: { name: 'Glückskatze', punkte: 100, tempo: 8.5, fell: '#ffe066', fell2: '#e0a400' },
  schwarz: { name: 'Schwarze Katze', punkte: -25, tempo: 1.4, pech: true, fell: '#2b2930', fell2: '#141317' },
  perser: { name: 'Omas Perserkatze', punkte: 0, tempo: 0, pose: 'liegt', groesse: 1.12, fell: '#fbf6ee', fell2: '#e2d5c2' },
  wirt: { name: 'Hüttenwirts-Katze', punkte: -50, tempo: 0, pose: 'sitzt', fell: '#9a7656', fell2: '#674a32', streifen: '#4a3221' },
};
const REGAL_MIX = [['tiger', 45], ['pummel', 30], ['schwarz', 25]];
const THEKE_MIX = [['ski', 40], ['tiger', 20], ['pummel', 20], ['schwarz', 20]];

/* Dartscheibe: Zahlen im Uhrzeigersinn ab oben, Ringe als Anteil des Radius (etwas großzügiger als echt) */
const ZAHLEN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RING = { bull: 0.05, outer: 0.11, t0: 0.55, t1: 0.62, d0: 0.92, d1: 1 };
const SWEET = [0.6, 0.8]; // Kraft-Bereich, in dem der Wurf genau dort landet, wo das Fadenkreuz ist

const $ = (id) => document.getElementById(id);
const canvas = $('szene');
const ctx = canvas.getContext('2d');
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (mix) => { let r = Math.random() * mix.reduce((s, [, w]) => s + w, 0); for (const [k, w] of mix) { r -= w; if (r <= 0) return k; } return mix[0][0]; };
const fmt = (n) => n.toFixed(1).replace('.', ',');

/* ---------- Kit ---------- */
const kit = startKit({
  key: 'katzen-darts',
  orientation: 'any',
  pause: () => { S.laden = false; loop.pause(); },
  resume: () => loop.resume(),
});
const { input, sound, storage } = kit;

/* ---------- Zustand ---------- */
const S = {
  phase: 'menu',        // menu | play | ende
  wurfPhase: 'zielen',  // zielen | flug | warten
  runde: 1, wurf: 0,    // wurf = Würfe insgesamt (0…15)
  folge: [],            // Art jedes Wurfs
  scheibe: 0, katzenPlus: 0, abzuege: 0, bier: 0, promille: 0,
  multi: false, pech: 0,
  laden: false, kraft: 0, kraftDir: 1, ladenQuelle: null,
  ziel: { x: 0.5, y: 0.45 }, // Zielpunkt (Anteil der Fläche), Fadenkreuz = Ziel + Wackeln
  wackel: { x: 0, y: 0 },
  katzen: [], flieger: [], pfeile: [], teilchen: [], flecken: [], texte: [], rufe: [],
  spawn: { regal: 0.6, theke: 1.2, gold: rnd(9, 15) },
  respawn: { perser: 0, wirt: 0 },
  warte: 0, banner: null,
  zeit: 0, spielzeit: 0,
  letzte: null,         // letztes Wurfergebnis (für den Test)
};
let view = { width: 1, height: 1, dpr: 1 };
let L = null;           // Aufteilung der Szene
let bgCanvas = null, boardCanvas = null;

/* ---------- Aufteilung: hoch und quer ---------- */
function layout() {
  const W = view.width, H = view.height, m = Math.min(W, H), M = Math.max(W, H);
  const u = Math.min(m * 0.045, M * 0.026);
  const l = { W, H, u, quer: W > H * 1.05 };
  if (l.quer) {
    l.Rt = Math.min(H * 0.31, W * 0.25);
    l.cx = W * 0.5; l.cy = H * 0.47;
    const bl = l.cx - l.Rt, br = l.cx + l.Rt;
    l.regal = { y: H * 0.42, x0: W * 0.03, x1: bl - W * 0.035 };
    l.fenster = { x: br + W * 0.05, y: H * 0.15, w: W * 0.95 - (br + W * 0.05), h: H * 0.36 };
    l.theke = { y: H * 0.87 };
    l.zapf = W * 0.78;
    l.geweih = { x: (l.regal.x0 + l.regal.x1) / 2, y: H * 0.25, s: u * 1.1 };
  } else {
    l.Rt = Math.min(W * 0.44, H * 0.24);
    l.cx = W * 0.5; l.cy = H * 0.42;
    l.regal = { y: l.cy - l.Rt - H * 0.03, x0: W * 0.04, x1: W * 0.96 };
    const top = l.cy + l.Rt + H * 0.035;
    l.fenster = { x: W * 0.07, y: top, w: W * 0.5, h: Math.max(u * 3, H * 0.785 - top) };
    l.theke = { y: H * 0.9 };
    l.zapf = W * 0.8;
    l.geweih = { x: W * 0.79, y: top + l.fenster.h * 0.45, s: u * 1.05 };
  }
  l.fenster.sims = l.fenster.y + l.fenster.h + u * 0.35;
  l.R = l.Rt / 1.22;
  return l;
}

/* Bahnen der Katzen: y = Füße, x-Bereich als Anteil der Breite */
function bahn(name) {
  if (name === 'regal') return { y: L.regal.y, a: (L.regal.x0 + L.u * 2) / L.W, b: (L.regal.x1 - L.u * 2) / L.W };
  if (name === 'fenster') return { y: L.fenster.sims, a: (L.fenster.x + L.fenster.w * 0.5) / L.W, b: (L.fenster.x + L.fenster.w * 0.5) / L.W };
  return { y: L.theke.y, a: -0.12, b: 1.12 };
}

/* ---------- Dartscheibe: Wertung ---------- */
function wertung(x, y) {
  const dx = x - L.cx, dy = y - L.cy;
  const r = Math.hypot(dx, dy) / L.R;
  if (r > RING.d1) return { punkte: 0, text: 'Daneben', feld: 'wand' };
  if (r <= RING.bull) return { punkte: 50, text: 'BULLSEYE!', feld: 'bull' };
  if (r <= RING.outer) return { punkte: 25, text: 'Bull', feld: 'outer' };
  const winkel = (Math.atan2(dx, -dy) * 180 / Math.PI + 360 + 9) % 360;
  const zahl = ZAHLEN[Math.floor(winkel / 18) % 20];
  if (r >= RING.t0 && r <= RING.t1) return { punkte: zahl * 3, text: `Triple ${zahl}`, feld: 'triple', zahl };
  if (r >= RING.d0) return { punkte: zahl * 2, text: `Double ${zahl}`, feld: 'double', zahl };
  return { punkte: zahl, text: `${zahl}`, feld: 'single', zahl };
}
/* Mittelpunkt eines Feldes (für Test und Thumbnail) */
function feldPunkt(feld, zahl = 20) {
  const i = ZAHLEN.indexOf(zahl);
  const a = (i * 18) * Math.PI / 180;
  const r = { bull: 0, outer: 0.08, triple: 0.585, double: 0.96, single: 0.78, wand: 1.4 }[feld] * L.R;
  return { x: L.cx + Math.sin(a) * r, y: L.cy - Math.cos(a) * r };
}

/* ---------- Katzen ---------- */
function katzePos(c) {
  const b = bahn(c.bahn);
  return { x: c.fx * L.W, y: b.y };
}
function hitbox(c) {
  const { x, y } = katzePos(c);
  const g = (KATZEN[c.typ].groesse || 1) * L.u;
  const pose = KATZEN[c.typ].pose;
  if (pose === 'sitzt') return { x, y: y - 1.8 * g, rx: 1.35 * g, ry: 1.95 * g };
  if (pose === 'liegt') return { x: x + 0.2 * g, y: y - 0.9 * g, rx: 2.4 * g, ry: 1.05 * g };
  return { x: x + c.dir * 0.2 * g, y: y - 1.45 * g, rx: 2.3 * g, ry: 1.3 * g };
}
function neueKatze(typ, bahnName) {
  const b = bahn(bahnName);
  const k = KATZEN[typ];
  const c = { typ, bahn: bahnName, dir: Math.random() < 0.5 ? 1 : -1, alpha: 0, state: 'lauf', t: 0, stopp: 0, phase: rnd(0, 6), ft: 0, leben: rnd(9, 15) };
  if (bahnName === 'theke') c.fx = c.dir > 0 ? -0.1 : 1.1;
  else if (bahnName === 'fenster') { c.fx = b.a; c.dir = 1; }
  else c.fx = c.dir > 0 ? b.a : b.b;
  if (typ === 'wirt') { c.bahn = 'theke'; c.fx = (L.zapf - L.u * 2.6) / L.W; c.dir = 1; c.fest = true; }
  if (typ === 'perser') c.fest = true;
  if (k.tempo === 0) c.alpha = 0;
  S.katzen.push(c);
  return c;
}
const aktiv = (name) => S.katzen.filter((c) => c.bahn === name && !c.fest && c.state !== 'flucht').length;

function updateKatzen(dt) {
  /* neue Katzen */
  S.spawn.regal -= dt; S.spawn.theke -= dt; S.spawn.gold -= dt;
  if (S.spawn.regal <= 0) { if (aktiv('regal') < 1) neueKatze(pick(REGAL_MIX), 'regal'); S.spawn.regal = rnd(1.2, 2.8); }
  if (S.spawn.theke <= 0) { if (aktiv('theke') < 2) neueKatze(pick(THEKE_MIX), 'theke'); S.spawn.theke = rnd(1.5, 3.5); }
  if (S.spawn.gold <= 0) { neueKatze('gold', 'theke'); S.spawn.gold = rnd(14, 22); }
  for (const typ of ['perser', 'wirt']) {
    if (S.katzen.some((c) => c.typ === typ && c.state !== 'flucht')) continue;
    S.respawn[typ] -= dt;
    if (S.respawn[typ] <= 0) neueKatze(typ, typ === 'perser' ? 'fenster' : 'theke');
  }

  for (const c of S.katzen) {
    const k = KATZEN[c.typ];
    const b = bahn(c.bahn);
    c.t += dt;
    if (c.state === 'flucht') {
      c.ft += dt;
      c.fx += c.dir * L.u * 9 * dt / L.W;
      if (c.ft > 0.7) c.alpha = Math.max(0, c.alpha - dt * 2.5);
      if (c.ft > 1.4) c.weg = true;
      continue;
    }
    if (c.state === 'weg') { c.alpha -= dt * 3; if (c.alpha <= 0) c.weg = true; continue; }
    c.alpha = Math.min(1, c.alpha + dt * 3);
    if (c.fest) continue;
    if (c.stopp > 0) { c.stopp -= dt; continue; }
    c.fx += c.dir * k.tempo * L.u * dt / L.W;
    if (c.typ !== 'ski' && c.typ !== 'gold' && Math.random() < dt * 0.18) c.stopp = rnd(0.4, 1.1);
    if (c.bahn === 'theke') {
      if ((c.dir > 0 && c.fx > 1.12) || (c.dir < 0 && c.fx < -0.12)) c.weg = true;
    } else {
      if (c.fx < b.a) { c.fx = b.a; if (c.t > c.leben) c.state = 'weg'; else c.dir = 1; }
      if (c.fx > b.b) { c.fx = b.b; if (c.t > c.leben) c.state = 'weg'; else c.dir = -1; }
    }
  }
  S.katzen = S.katzen.filter((c) => !c.weg);
}

function erschrecken(c) {
  c.state = 'flucht';
  c.ft = 0;
  c.stopp = 0;
  if (c.fest) {
    c.fest = false;
    c.dir = c.fx < 0.5 ? -1 : 1;
    S.respawn[c.typ] = 3.5;
  } else if (c.bahn !== 'theke') c.dir = c.fx < 0.5 ? -1 : 1;
  const h = hitbox(c);
  for (let i = 0; i < 14; i++) S.teilchen.push({ x: h.x, y: h.y, vx: rnd(-1, 1) * L.u * 6, vy: rnd(-1.4, 0.3) * L.u * 6, g: L.u * 12, life: rnd(0.5, 0.9), t: 0, r: rnd(0.12, 0.25) * L.u, col: KATZEN[c.typ].fell });
}

/* ---------- Wurf ---------- */
function wackelStaerke() {
  return L.u * (0.32 + S.promille * 0.85 + (S.pech > 0 ? 0.7 : 0));
}
function updateWackel() {
  const a = wackelStaerke();
  const t = S.zeit * (1 + S.promille * 0.25);
  S.wackel.x = a * (Math.sin(t * 1.3) * 0.65 + Math.sin(t * 2.9 + 1.7) * 0.35);
  S.wackel.y = a * (Math.cos(t * 1.1 + 0.4) * 0.6 + Math.sin(t * 3.3) * 0.4);
}
function fadenkreuz() {
  return { x: S.ziel.x * L.W + S.wackel.x, y: S.ziel.y * L.H + S.wackel.y };
}

function ladenStart(quelle) {
  if (S.phase !== 'play' || S.wurfPhase !== 'zielen' || kit.paused || S.laden) return;
  S.laden = true; S.kraft = 0; S.kraftDir = 1; S.ladenQuelle = quelle;
}
function ladenEnde() {
  if (!S.laden) return;
  S.laden = false;
  const k = S.kraft;
  const f = fadenkreuz();
  let dy = 0;
  if (k < SWEET[0]) dy = (SWEET[0] - k) * 1.6 * L.R;
  else if (k > SWEET[1]) dy = -(k - SWEET[1]) * 1.6 * L.R;
  werfen(f.x + rnd(-1, 1) * L.u * 0.12, f.y + dy + rnd(-1, 1) * L.u * 0.12, k);
}

/* tx, ty = Landepunkt in CSS-Pixeln */
function werfen(tx, ty, kraft = 0.7, genau = false) {
  if (S.phase !== 'play' || S.wurfPhase !== 'zielen') return false;
  const art = S.folge[S.wurf];
  if (art === 'flasche' && !genau) { tx += rnd(-1, 1) * L.u * 1.1; ty += rnd(-0.6, 0.9) * L.u; }
  if (art !== 'pfeil') { S.bier++; S.promille = Math.round((S.promille + 0.3) * 10) / 10; }
  S.flieger.push({ art, sx: L.W * (0.5 + rnd(-0.08, 0.08)), sy: L.H + L.u * 2, tx, ty, t: 0, dauer: ARTEN[art].flug, dreh: rnd(-1, 1), kraft });
  S.wurfPhase = 'flug';
  sound.melody([[520, 0.04], [430, 0.04], [340, 0.06]], 'sine', 0.07);
  zeigeHud();
  return true;
}

function landen(p) {
  const art = p.art;
  const x = p.tx, y = p.ty;
  const doppelt = S.multi;
  S.multi = false;
  if (S.pech > 0) S.pech--;
  let plus = 0, minus = 0, scheibe = 0;
  const getroffen = [];
  const lebend = S.katzen.filter((c) => c.state !== 'flucht' && c.state !== 'weg' && c.alpha > 0.3);
  const abstand = (c) => { const h = hitbox(c); return Math.hypot((x - h.x) / h.rx, (y - h.y) / h.ry); };

  if (art === 'krug') {
    const rad = L.u * 2.8;
    for (const c of lebend) {
      const h = hitbox(c);
      if (Math.hypot(x - h.x, y - h.y) < rad + Math.min(h.rx, h.ry)) getroffen.push(c);
    }
    const w = wertung(x, y);
    scheibe = Math.round(w.punkte / 2);
    if (w.punkte) text(x, y - L.u * 2.2, `${w.text.replace('!', '')} ½ = ${scheibe}`, '#fff3bf');
    platsch(x, y, rad);
  } else {
    const nah = lebend.map((c) => [c, abstand(c)]).filter(([, d]) => d <= 1.08).sort((a, b) => a[1] - b[1]);
    if (nah.length) getroffen.push(nah[0][0]);
    else {
      const w = wertung(x, y);
      if (art === 'flasche' && w.feld === 'bull') { scheibe = 100; text(x, y - L.u * 2, '🍻 PROST-BONUS! +100', '#ffe066', 1.5); sound.melody([[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.08], [1319, 0.25]]); }
      else {
        scheibe = w.punkte;
        if (w.punkte) text(x, y - L.u * 2, `${w.text}${w.feld === 'single' ? '' : ` = ${w.punkte}`}`, w.feld === 'bull' ? '#ffe066' : '#fff');
      }
      if (!w.punkte) { text(x, y - L.u * 1.6, 'Plonk! Daneben', '#ffd8a8'); plonk(); }
      else if (art === 'pfeil') tock();
      if (art === 'pfeil' && w.punkte) S.pfeile.push({ x, y, dreh: rnd(-0.15, 0.15), farbe: ['#e03131', '#1971c2', '#2f9e44'][S.wurf % 3] });
      if (art === 'pfeil' && !w.punkte) S.teilchen.push({ pfeil: true, x, y, vx: rnd(-1, 1) * L.u, vy: -L.u * 2, g: L.u * 30, life: 1.2, t: 0, dreh: 0 });
    }
    if (art === 'flasche') scherben(x, y);
  }

  for (const c of getroffen) {
    const k = KATZEN[c.typ];
    erschrecken(c);
    const h = hitbox(c);
    if (k.punkte > 0) plus += k.punkte; else minus += k.punkte;
    const label = k.punkte > 0 ? `+${k.punkte}` : k.punkte < 0 ? `${k.punkte}` : '0';
    text(h.x, h.y - h.ry - L.u * 0.6, `Plopp! ${label}`, k.punkte > 0 ? '#b2f2bb' : k.punkte < 0 ? '#ffa8a8' : '#fff', 1.15);
    miau(c.typ);
    if (k.doppel) { S.multi = true; text(h.x, h.y - h.ry - L.u * 2, '⛷️ ×2 auf den nächsten Wurf!', '#a5d8ff'); }
    if (k.pech) { S.pech = 3; ruf('🐈‍⬛ Pech! Jetzt wackelt\'s mehr …', '#d0bfff'); }
    if (c.typ === 'gold') { ruf('✨ Glückskatze! +100 ✨', '#ffe066'); sound.melody([[784, 0.06], [988, 0.06], [1175, 0.06], [1568, 0.2]]); }
    if (c.typ === 'perser') ruf('👵 Oma: „Finger weg von meinem Mausi, du Lump!“', '#fff', 2.6);
    if (c.typ === 'wirt') { ruf('🍺 Wirt: „HAUSVERBOT!“', '#ff6b6b', 2.4, true); sound.melody([[130, 0.18], [98, 0.32]], 'sawtooth', 0.12); }
  }

  if (doppelt) {
    if (scheibe + plus > 0) text(x, y - L.u * 3.4, `×2 → +${(scheibe + plus) * 2}`, '#a5d8ff', 1.2);
    scheibe *= 2; plus *= 2;
  }
  S.scheibe += scheibe; S.katzenPlus += plus; S.abzuege += minus;
  S.letzte = { art, x, y, scheibe, plus, minus, katzen: getroffen.map((c) => c.typ), doppelt };
  S.wurf++;
  S.wurfPhase = 'warten';
  S.warte = 0.75;
  zeigeHud();
}

function nachWurf() {
  if (S.wurf >= RUNDEN * WUERFE) { S.banner = { text: 'Letzter Wurf! 🍻', t: 0, dauer: 1.3 }; S.wurfPhase = 'ende'; S.warte = 1.3; return; }
  if (S.wurf % WUERFE === 0) {
    S.runde++;
    S.pfeile = [];
    S.banner = { text: `Runde ${S.runde} von ${RUNDEN}`, t: 0, dauer: 1.2 };
  }
  S.wurfPhase = 'zielen';
  zeigeHud();
}

/* ---------- Effekte ---------- */
function text(x, y, t, farbe = '#fff', gross = 1) { S.texte.push({ x, y, text: t, farbe, gross, t: 0, life: 1.4 }); }
function ruf(t, farbe, dauer = 2, wackeln = false) { S.rufe = [{ text: t, farbe, t: 0, life: dauer, wackeln }]; }
function platsch(x, y, rad) {
  for (let i = 0; i < 34; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(0.4, 1) * rad * 3.2;
    S.teilchen.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rad, g: rad * 6, life: rnd(0.5, 1), t: 0, r: rnd(0.12, 0.3) * L.u, col: i % 3 ? '#f7c948' : '#fffdf5' });
  }
  for (let i = 0; i < 7; i++) S.flecken.push({ x: x + rnd(-1, 1) * rad * 0.7, y: y + rnd(-1, 1) * rad * 0.7, r: rnd(0.3, 0.8) * L.u, t: 0, life: 5 });
  sound.melody([[200, 0.05], [140, 0.12]], 'sine', 0.2);
  klirren(4);
}
function scherben(x, y) {
  for (let i = 0; i < 18; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(0.5, 1) * L.u * 7;
    S.teilchen.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - L.u * 3, g: L.u * 20, life: rnd(0.5, 0.9), t: 0, r: rnd(0.1, 0.22) * L.u, col: i % 2 ? '#2f9e44' : '#f7c948', eckig: true });
  }
  S.flecken.push({ x, y, r: L.u * 0.9, t: 0, life: 4 });
  klirren(8);
}
function tock() { sound.beep(210, 0.06, 'square', 0.1); sound.beep(1500, 0.03, 'triangle', 0.05, 0.01); }
function plonk() { sound.melody([[190, 0.05], [118, 0.14]], 'sine', 0.26); }
function klirren(n) { for (let i = 0; i < n; i++) sound.beep(rnd(2400, 5200), rnd(0.04, 0.09), 'triangle', 0.06, i * 0.03); }
function miau(typ) {
  sound.beep(900, 0.05, 'sine', 0.18);
  if (typ === 'pummel') sound.melody([[0, 0.06], [330, 0.1], [420, 0.12], [300, 0.22]], 'sawtooth', 0.05);
  else sound.melody([[0, 0.06], [640, 0.07], [860, 0.09], [720, 0.1], [520, 0.16]], 'sawtooth', 0.05);
  for (let i = 0; i < 6; i++) sound.beep(rnd(2600, 4800), 0.03, 'sawtooth', 0.025, 0.5 + i * 0.03); // Fauchen
}

/* ---------- Schleife ---------- */
const loop = createLoop({ update, render });

function update(dt) {
  S.zeit += dt;
  if (!L) return;
  updateKatzen(dt);
  for (const p of S.teilchen) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.pfeil) p.dreh += dt * 6; }
  S.teilchen = S.teilchen.filter((p) => p.t < p.life);
  for (const f of S.flecken) f.t += dt;
  S.flecken = S.flecken.filter((f) => f.t < f.life);
  for (const t of S.texte) { t.t += dt; t.y -= L.u * 1.2 * dt; }
  S.texte = S.texte.filter((t) => t.t < t.life);
  for (const r of S.rufe) r.t += dt;
  S.rufe = S.rufe.filter((r) => r.t < r.life);
  if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.dauer) S.banner = null; }
  if (S.phase !== 'play') return;

  S.spielzeit += dt;
  updateWackel();

  /* Zielen mit Tasten */
  const v = L.u * 7 * dt;
  const kx = (input.down('rechts') ? 1 : 0) - (input.down('links') ? 1 : 0);
  const ky = (input.down('runter') ? 1 : 0) - (input.down('hoch') ? 1 : 0);
  if (kx || ky) { S.ziel.x = clamp(S.ziel.x + kx * v / L.W, 0.02, 0.98); S.ziel.y = clamp(S.ziel.y + ky * v / L.H, 0.05, 0.97); }
  if (!input.down('aktion')) S.tasteGesperrt = false;   // Taste vom Start-Knopf erst loslassen
  if (input.down('aktion') && !S.tasteGesperrt && S.wurfPhase === 'zielen' && !S.laden) ladenStart('taste');
  if (S.laden && S.ladenQuelle === 'taste' && !input.down('aktion')) ladenEnde();

  /* Kraft pendelt 0 → 1 → 0, solange gehalten wird */
  if (S.laden) {
    S.kraft += S.kraftDir * dt * 1.05;
    if (S.kraft >= 1) { S.kraft = 1; S.kraftDir = -1; }
    if (S.kraft <= 0) { S.kraft = 0; S.kraftDir = 1; }
  }

  for (const p of S.flieger) { p.t += dt; if (p.t >= p.dauer) { p.fertig = true; landen(p); } }
  S.flieger = S.flieger.filter((p) => !p.fertig);

  if (S.wurfPhase === 'warten' || S.wurfPhase === 'ende') {
    S.warte -= dt;
    if (S.warte <= 0) { if (S.wurfPhase === 'ende') beenden(); else nachWurf(); }
  }
}

/* ---------- Zeichnen ---------- */
function render() {
  if (!L) return;
  const { W, H, u } = L;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  schneefall();
  lichterkette();

  /* Bierflecken an der Wand (unter der Scheibe sieht man sie auch) */
  for (const f of S.flecken) {
    ctx.fillStyle = `rgba(70,40,10,${0.35 * (1 - f.t / f.life)})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }

  /* Scheibe */
  const bs = boardCanvas.width / view.dpr;
  ctx.drawImage(boardCanvas, L.cx - bs / 2, L.cy - bs / 2, bs, bs);
  for (const p of S.pfeile) steckpfeil(p.x, p.y, p.dreh, p.farbe, 1);

  /* Katzen: feste hinten, laufende vorne */
  const sortiert = [...S.katzen].sort((a, b) => (a.fest ? 0 : 1) - (b.fest ? 0 : 1));
  for (const c of sortiert) katze(c);

  /* Zapfhahn vor der Wirts-Katze */
  zapfhahn(L.zapf, L.theke.y, u);

  /* Teilchen */
  for (const p of S.teilchen) {
    const a = 1 - p.t / p.life;
    if (p.pfeil) { ctx.globalAlpha = a; steckpfeil(p.x, p.y, p.dreh, '#e03131', 1); ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = p.col;
    ctx.globalAlpha = a;
    ctx.beginPath();
    if (p.eckig) { ctx.moveTo(p.x, p.y - p.r); ctx.lineTo(p.x + p.r, p.y + p.r); ctx.lineTo(p.x - p.r * 0.7, p.y + p.r * 0.4); }
    else ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* Flieger */
  for (const p of S.flieger) flieger(p);

  /* Fadenkreuz */
  if (S.phase === 'play' && S.wurfPhase === 'zielen') zielkreuz();

  /* Texte */
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of S.texte) {
    const a = Math.min(1, (t.life - t.t) * 3);
    const s = Math.round(u * 0.95 * t.gross * (t.t < 0.12 ? 0.6 + t.t * 3.3 : 1));
    ctx.font = `900 ${s}px ${getComputedStyle(document.documentElement).getPropertyValue('--gt-font')}`;
    ctx.globalAlpha = a;
    ctx.lineWidth = s * 0.22; ctx.strokeStyle = 'rgba(40,18,4,.9)'; ctx.lineJoin = 'round';
    const x = clamp(t.x, ctx.measureText(t.text).width / 2 + 8, W - ctx.measureText(t.text).width / 2 - 8);
    ctx.strokeText(t.text, x, t.y);
    ctx.fillStyle = t.farbe; ctx.fillText(t.text, x, t.y);
    ctx.globalAlpha = 1;
  }
  for (const r of S.rufe) rufBlase(r);
  if (S.banner) bannerZeichnen(S.banner);
}

function schneefall() {
  const f = L.fenster;
  ctx.save();
  ctx.beginPath(); ctx.rect(f.x, f.y, f.w, f.h); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let i = 0; i < 26; i++) {
    const sx = (i * 0.618 + Math.sin(S.zeit * 0.6 + i) * 0.03) % 1;
    const sy = ((i * 0.37 + S.zeit * (0.08 + (i % 5) * 0.02)) % 1.1) - 0.05;
    ctx.beginPath(); ctx.arc(f.x + sx * f.w, f.y + sy * f.h, L.u * (0.06 + (i % 3) * 0.04), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const BIRNEN = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ffa94d'];
function lichterkette() {
  const { W, u } = L;
  const n = Math.max(12, Math.round(W / (u * 2.6)));
  const top = u * 0.6, sag = u * 1.4, swags = L.quer ? 4 : 3;
  ctx.strokeStyle = '#2b1a0e'; ctx.lineWidth = Math.max(1.5, u * 0.08);
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) { const x = (i / 80) * W; ctx[i ? 'lineTo' : 'moveTo'](x, top + Math.abs(Math.sin((i / 80) * Math.PI * swags)) * sag); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = t * W, y = top + Math.abs(Math.sin(t * Math.PI * swags)) * sag + u * 0.25;
    const an = 0.55 + 0.45 * Math.sin(S.zeit * (1.5 + (i % 4) * 0.4) + i * 1.7);
    const col = BIRNEN[i % BIRNEN.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, u * 1.2);
    g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    ctx.globalAlpha = an; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, u * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6 + 0.4 * an; ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, u * 0.2, u * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function zielkreuz() {
  const { u } = L;
  const { x, y } = fadenkreuz();
  const r = u * 0.9;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
  ctx.strokeStyle = S.laden ? '#ffec99' : '#fff';
  ctx.lineWidth = Math.max(2, u * 0.13);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x - r * 0.4, y); ctx.moveTo(x + r * 0.4, y); ctx.lineTo(x + r * 1.6, y);
  ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y - r * 0.4); ctx.moveTo(x, y + r * 0.4); ctx.lineTo(x, y + r * 1.6);
  ctx.stroke();
  ctx.fillStyle = '#ff3b3b';
  ctx.beginPath(); ctx.arc(x, y, Math.max(2, u * 0.12), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  /* Kraft-Ring: grauer Ring, grüner Bereich, gelb gefüllt bis zur Kraft */
  const R2 = u * 2.1, a0 = -Math.PI / 2;
  ctx.lineCap = 'round';
  ctx.lineWidth = u * 0.42;
  ctx.strokeStyle = 'rgba(30,15,5,.55)';
  ctx.beginPath(); ctx.arc(x, y, R2, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = u * 0.3;
  ctx.strokeStyle = 'rgba(80,220,120,.85)';
  ctx.beginPath(); ctx.arc(x, y, R2, a0 + SWEET[0] * Math.PI * 2, a0 + SWEET[1] * Math.PI * 2); ctx.stroke();
  if (S.laden && S.kraft > 0.005) {
    const gut = S.kraft >= SWEET[0] && S.kraft <= SWEET[1];
    ctx.strokeStyle = gut ? '#b2f2bb' : '#ffd43b';
    ctx.lineWidth = u * 0.2;
    ctx.beginPath(); ctx.arc(x, y, R2, a0, a0 + S.kraft * Math.PI * 2); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function flieger(p) {
  const { u } = L;
  const t = clamp(p.t / p.dauer, 0, 1);
  const e = 1 - (1 - t) * (1 - t);
  const bogen = p.art === 'flasche' ? L.H * 0.32 : p.art === 'krug' ? L.H * 0.14 : L.H * 0.06;
  const x = p.sx + (p.tx - p.sx) * e;
  const y = p.sy + (p.ty - p.sy) * e - Math.sin(t * Math.PI) * bogen;
  const s = 2.4 - 1.4 * e;
  ctx.save();
  ctx.translate(x, y);
  if (p.art === 'pfeil') {
    ctx.scale(s, s);
    flugpfeil(Math.atan2(p.ty - p.sy, p.tx - p.sx));
  } else if (p.art === 'krug') {
    ctx.rotate(p.dreh * t * 2.5);
    ctx.scale(s * 0.9, s * 0.9);
    masskrug(0, 0, u);
  } else {
    ctx.rotate(t * Math.PI * 5 * (p.dreh > 0 ? 1 : -1));
    ctx.scale(s, s);
    flasche(0, 0, u);
  }
  ctx.restore();
}

function flugpfeil(winkel) {
  const { u } = L;
  ctx.rotate(winkel + Math.PI / 2);
  ctx.fillStyle = '#ccd3da'; ctx.fillRect(-u * 0.05, -u * 1.1, u * 0.1, u * 0.5);
  const g = ctx.createLinearGradient(-u * 0.15, 0, u * 0.15, 0);
  g.addColorStop(0, '#495057'); g.addColorStop(0.5, '#ced4da'); g.addColorStop(1, '#343a40');
  ctx.fillStyle = g; ctx.fillRect(-u * 0.13, -u * 0.6, u * 0.26, u * 0.9);
  ctx.fillStyle = '#e03131';
  ctx.beginPath(); ctx.moveTo(0, u * 0.3); ctx.lineTo(-u * 0.45, u * 1.1); ctx.lineTo(0, u * 0.9); ctx.lineTo(u * 0.45, u * 1.1); ctx.closePath(); ctx.fill();
}

/* steckender Pfeil: Spitze bei (x, y), Schaft nach unten rechts aus der Wand */
function steckpfeil(x, y, dreh, farbe, s) {
  const { u } = L;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.6 + dreh);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(u * 0.25, u * 1.2, u * 0.18, u * 1.0, -0.2, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-u * 0.1, 0, u * 0.1, 0);
  g.addColorStop(0, '#495057'); g.addColorStop(0.5, '#e9ecef'); g.addColorStop(1, '#343a40');
  ctx.fillStyle = g; ctx.fillRect(-u * 0.09, 0, u * 0.18, u * 1.1);
  ctx.fillStyle = '#212529'; ctx.fillRect(-u * 0.05, u * 1.1, u * 0.1, u * 0.5);
  ctx.fillStyle = farbe;
  ctx.beginPath(); ctx.moveTo(0, u * 1.4); ctx.lineTo(-u * 0.42, u * 2.15); ctx.lineTo(0, u * 1.95); ctx.lineTo(u * 0.42, u * 2.15); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function masskrug(x, y, u) {
  ctx.save();
  ctx.translate(x, y);
  const w = u * 1.2, h = u * 1.6;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, 'rgba(240,170,30,.95)'); g.addColorStop(0.45, 'rgba(255,220,110,.95)'); g.addColorStop(1, 'rgba(200,120,10,.95)');
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = u * 0.1;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, u * 0.15); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2 + u * 0.15, 0, u * 0.38, -Math.PI / 2, Math.PI / 2); ctx.lineWidth = u * 0.18; ctx.stroke();
  ctx.fillStyle = '#fffdf5';
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * w * 0.32, -h / 2, u * 0.33, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = u * 0.07;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.25, -h * 0.3); ctx.lineTo(i * w * 0.25, h * 0.4); ctx.stroke(); }
  ctx.restore();
}

function flasche(x, y, u) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createLinearGradient(-u * 0.35, 0, u * 0.35, 0);
  g.addColorStop(0, '#1e6b2f'); g.addColorStop(0.45, '#57c46e'); g.addColorStop(1, '#14501f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-u * 0.35, u * 0.9); ctx.lineTo(-u * 0.35, -u * 0.1); ctx.quadraticCurveTo(-u * 0.35, -u * 0.45, -u * 0.13, -u * 0.6);
  ctx.lineTo(-u * 0.13, -u * 1.05); ctx.lineTo(u * 0.13, -u * 1.05); ctx.lineTo(u * 0.13, -u * 0.6);
  ctx.quadraticCurveTo(u * 0.35, -u * 0.45, u * 0.35, -u * 0.1); ctx.lineTo(u * 0.35, u * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff3bf'; ctx.fillRect(-u * 0.33, u * 0.05, u * 0.66, u * 0.45);
  ctx.fillStyle = '#c92a2a'; ctx.fillRect(-u * 0.33, u * 0.18, u * 0.66, u * 0.12);
  ctx.fillStyle = '#ffd43b'; ctx.fillRect(-u * 0.15, -u * 1.15, u * 0.3, u * 0.14);
  ctx.restore();
}

function zapfhahn(x, y, u) {
  ctx.save();
  const g = ctx.createLinearGradient(x - u * 0.4, 0, x + u * 0.4, 0);
  g.addColorStop(0, '#8d6e2c'); g.addColorStop(0.5, '#ffe8a3'); g.addColorStop(1, '#8d6e2c');
  ctx.fillStyle = g;
  ctx.fillRect(x - u * 0.3, y - u * 3.2, u * 0.6, u * 3.2);
  ctx.beginPath(); ctx.roundRect(x - u * 0.55, y - u * 3.5, u * 1.1, u * 0.5, u * 0.2); ctx.fill();
  ctx.fillRect(x - u * 1.3, y - u * 2.9, u * 1.1, u * 0.3);
  ctx.fillRect(x - u * 1.32, y - u * 2.9, u * 0.22, u * 0.7);
  ctx.fillStyle = '#212529';
  ctx.beginPath(); ctx.roundRect(x - u * 0.22, y - u * 5, u * 0.44, u * 1.6, u * 0.15); ctx.fill();
  ctx.fillStyle = '#c92a2a'; ctx.fillRect(x - u * 0.22, y - u * 4.6, u * 0.44, u * 0.4);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(x, y, u * 0.9, u * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ---------- Katzen zeichnen ---------- */
function katze(c) {
  const k = KATZEN[c.typ];
  const { x, y } = katzePos(c);
  const g = (k.groesse || 1) * L.u;
  const flucht = c.state === 'flucht';
  ctx.save();
  ctx.globalAlpha = clamp(c.alpha, 0, 1) * (c.typ === 'schwarz' ? 0.88 : 1);
  ctx.translate(x, y);
  /* Schatten */
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, g * (k.pose === 'sitzt' ? 1.3 : 2), g * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  if (flucht) ctx.translate(0, -Math.abs(Math.sin(c.ft * 14)) * g * 1.2);
  if (k.pose !== 'sitzt' && k.pose !== 'liegt') ctx.scale(c.dir, 1);
  else if (flucht) ctx.scale(c.dir, 1);
  if (c.typ === 'gold') {
    const gl = ctx.createRadialGradient(0, -g * 1.4, 0, 0, -g * 1.4, g * 3.5);
    gl.addColorStop(0, 'rgba(255,230,120,.7)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -g * 1.4, g * 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (flucht) katzeFlucht(c, k, g);
  else if (k.pose === 'sitzt') katzeSitzt(c, k, g);
  else if (k.pose === 'liegt') katzeLiegt(c, k, g);
  else katzeLauf(c, k, g);
  ctx.restore();
  if (c.typ === 'perser' && !flucht) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `800 ${Math.round(L.u * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    const z = (S.zeit * 0.5) % 1;
    ctx.globalAlpha = 1 - z;
    ctx.fillText('z', x + g * 1.6 + z * g, y - g * 1.9 - z * g * 1.5);
    ctx.globalAlpha = 1;
  }
}

function fellVerlauf(k, g, cy, r) {
  const f = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  f.addColorStop(0, k.fell); f.addColorStop(1, k.fell2);
  return f;
}

function kopf(k, g, hx, hy, { augen = 'offen', mund = false, brille = false, hut = false } = {}) {
  const r = g * 0.78;
  ctx.fillStyle = fellVerlauf(k, g, hy, r);
  /* Ohren */
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.85, hy - r * 0.3); ctx.lineTo(hx - r * 0.65, hy - r * 1.35); ctx.lineTo(hx - r * 0.05, hy - r * 0.8);
  ctx.moveTo(hx + r * 0.85, hy - r * 0.3); ctx.lineTo(hx + r * 0.65, hy - r * 1.35); ctx.lineTo(hx + r * 0.05, hy - r * 0.8);
  ctx.fill();
  ctx.fillStyle = '#f4a6b8';
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.7, hy - r * 0.55); ctx.lineTo(hx - r * 0.6, hy - r * 1.1); ctx.lineTo(hx - r * 0.25, hy - r * 0.8);
  ctx.moveTo(hx + r * 0.7, hy - r * 0.55); ctx.lineTo(hx + r * 0.6, hy - r * 1.1); ctx.lineTo(hx + r * 0.25, hy - r * 0.8);
  ctx.fill();
  ctx.fillStyle = fellVerlauf(k, g, hy, r);
  ctx.beginPath(); ctx.ellipse(hx, hy, r, r * 0.88, 0, 0, Math.PI * 2); ctx.fill();
  if (k.streifen) {
    ctx.strokeStyle = k.streifen; ctx.lineWidth = g * 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - r * 0.25, hy - r * 0.8); ctx.lineTo(hx - r * 0.15, hy - r * 0.45);
    ctx.moveTo(hx, hy - r * 0.85); ctx.lineTo(hx, hy - r * 0.5);
    ctx.moveTo(hx + r * 0.25, hy - r * 0.8); ctx.lineTo(hx + r * 0.15, hy - r * 0.45); ctx.stroke();
  }
  /* Schnauze */
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(hx - r * 0.2, hy + r * 0.32, r * 0.28, r * 0.22, 0, 0, Math.PI * 2); ctx.ellipse(hx + r * 0.2, hy + r * 0.32, r * 0.28, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8597a';
  ctx.beginPath(); ctx.moveTo(hx - r * 0.12, hy + r * 0.12); ctx.lineTo(hx + r * 0.12, hy + r * 0.12); ctx.lineTo(hx, hy + r * 0.26); ctx.fill();
  /* Augen */
  const ey = hy - r * 0.1, ex = r * 0.38;
  if (augen === 'zu') {
    ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = g * 0.09;
    ctx.beginPath(); ctx.arc(hx - ex, ey, r * 0.16, 0.2, Math.PI - 0.2); ctx.moveTo(hx + ex + r * 0.16, ey); ctx.arc(hx + ex, ey, r * 0.16, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    const er = augen === 'gross' ? r * 0.27 : r * 0.2;
    ctx.fillStyle = c_eye(k);
    ctx.beginPath(); ctx.arc(hx - ex, ey, er, 0, Math.PI * 2); ctx.arc(hx + ex, ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    const pw = augen === 'gross' ? er * 0.35 : er * 0.42;
    ctx.beginPath(); ctx.ellipse(hx - ex + r * 0.04, ey, pw, er * 0.85, 0, 0, Math.PI * 2); ctx.ellipse(hx + ex + r * 0.04, ey, pw, er * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - ex - er * 0.3, ey - er * 0.35, er * 0.25, 0, Math.PI * 2); ctx.arc(hx + ex - er * 0.3, ey - er * 0.35, er * 0.25, 0, Math.PI * 2); ctx.fill();
  }
  if (mund) {
    ctx.fillStyle = '#5c1a24';
    ctx.beginPath(); ctx.ellipse(hx, hy + r * 0.5, r * 0.2, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(hx - r * 0.15, hy + r * 0.38); ctx.lineTo(hx - r * 0.09, hy + r * 0.52); ctx.lineTo(hx - r * 0.03, hy + r * 0.38); ctx.moveTo(hx + r * 0.15, hy + r * 0.38); ctx.lineTo(hx + r * 0.09, hy + r * 0.52); ctx.lineTo(hx + r * 0.03, hy + r * 0.38); ctx.fill();
  }
  /* Schnurrhaare */
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(1, g * 0.04);
  ctx.beginPath();
  for (const s of [-1, 1]) for (const d of [-0.12, 0.05]) { ctx.moveTo(hx + s * r * 0.4, hy + r * 0.32); ctx.lineTo(hx + s * r * 1.25, hy + r * (0.32 + d * 1.6)); }
  ctx.stroke();
  if (brille) {
    ctx.fillStyle = '#212529';
    ctx.fillRect(hx - r * 1.02, ey - r * 0.12, r * 2.04, r * 0.22);
    const bg = ctx.createLinearGradient(hx - r * 0.8, ey - r * 0.3, hx + r * 0.8, ey + r * 0.3);
    bg.addColorStop(0, '#ff922b'); bg.addColorStop(0.5, '#ffe066'); bg.addColorStop(1, '#e64980');
    ctx.fillStyle = bg; ctx.strokeStyle = '#fff'; ctx.lineWidth = g * 0.07;
    ctx.beginPath(); ctx.roundRect(hx - r * 0.82, ey - r * 0.32, r * 1.64, r * 0.58, r * 0.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.ellipse(hx - r * 0.4, ey - r * 0.12, r * 0.22, r * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  if (hut) {
    ctx.fillStyle = '#2b8a3e';
    ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.78, r * 1.05, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hx - r * 0.6, hy - r * 0.8); ctx.quadraticCurveTo(hx - r * 0.5, hy - r * 1.6, hx, hy - r * 1.55); ctx.quadraticCurveTo(hx + r * 0.5, hy - r * 1.6, hx + r * 0.6, hy - r * 0.8); ctx.fill();
    ctx.fillStyle = '#c92a2a'; ctx.fillRect(hx - r * 0.6, hy - r * 1.0, r * 1.2, r * 0.16);
    ctx.strokeStyle = '#f8f9fa'; ctx.lineWidth = g * 0.08;
    ctx.beginPath(); ctx.moveTo(hx + r * 0.4, hy - r * 1.0); ctx.quadraticCurveTo(hx + r * 0.9, hy - r * 1.8, hx + r * 1.2, hy - r * 2.0); ctx.stroke();
  }
}
const c_eye = (k) => (k === KATZEN.schwarz ? '#ffe066' : k === KATZEN.gold ? '#74c0fc' : '#a9e34b');

function schwanz(g, x0, y0, phase, steil = 0) {
  ctx.lineCap = 'round';
  ctx.lineWidth = g * 0.34;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const w = Math.sin(phase) * g * 0.4;
  ctx.bezierCurveTo(x0 - g * 0.9, y0 - g * (0.2 + steil), x0 - g * (1.1 - steil * 0.6) + w, y0 - g * (1.2 + steil), x0 - g * (0.7 - steil * 0.5) + w, y0 - g * (1.8 + steil));
  ctx.stroke();
}

function katzeLauf(c, k, g) {
  const schritt = c.stopp > 0 ? 0 : S.zeit * (4 + k.tempo * 1.3) + c.phase;
  const dick = c.typ === 'pummel' ? 1.25 : 1;
  /* Beine */
  ctx.strokeStyle = k.fell2; ctx.lineCap = 'round'; ctx.lineWidth = g * 0.3;
  ctx.beginPath();
  for (const [bx, ph] of [[-0.9, 0], [-0.55, Math.PI], [0.65, Math.PI], [1.0, 0]]) {
    const s = Math.sin(schritt + ph) * g * 0.3;
    ctx.moveTo(bx * g, -g * 0.85); ctx.lineTo(bx * g + s, -g * 0.12);
  }
  ctx.stroke();
  /* Schwanz */
  ctx.strokeStyle = k.fell2;
  schwanz(g, -g * 1.35, -g * 1.35, S.zeit * 3 + c.phase);
  /* Körper */
  ctx.fillStyle = fellVerlauf(k, g, -g * 1.25, g * 0.9 * dick);
  ctx.beginPath(); ctx.ellipse(0, -g * 1.25, g * 1.55 * dick, g * 0.78 * dick, 0, 0, Math.PI * 2); ctx.fill();
  if (k.streifen) {
    ctx.strokeStyle = k.streifen; ctx.lineWidth = g * 0.14;
    ctx.beginPath();
    for (const sx of [-0.8, -0.3, 0.2]) { ctx.moveTo(sx * g, -g * 1.95); ctx.quadraticCurveTo((sx + 0.15) * g, -g * 1.5, sx * g, -g * 1.15); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.ellipse(-g * 0.2, -g * 1.6, g * 0.9, g * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  if (c.typ === 'ski') {
    ctx.fillStyle = '#e03131';
    const flatter = Math.sin(S.zeit * 18) * g * 0.15;
    ctx.beginPath(); ctx.moveTo(g * 0.9, -g * 1.75); ctx.lineTo(-g * 0.6, -g * 1.9 + flatter); ctx.lineTo(-g * 0.4, -g * 1.6 + flatter); ctx.lineTo(g * 1.0, -g * 1.4); ctx.fill();
  }
  kopf(k, g, g * 1.45, -g * 1.85 - Math.abs(Math.sin(schritt)) * g * 0.05, { brille: c.typ === 'ski' });
  if (c.typ === 'gold') funkeln(g);
}

function katzeSitzt(c, k, g) {
  ctx.strokeStyle = k.fell2;
  ctx.lineCap = 'round'; ctx.lineWidth = g * 0.34;
  ctx.beginPath(); ctx.moveTo(g * 0.7, -g * 0.3); ctx.quadraticCurveTo(g * 1.7, -g * 0.2, g * 1.4 + Math.sin(S.zeit * 2) * g * 0.2, -g * 1.1); ctx.stroke();
  ctx.fillStyle = fellVerlauf(k, g, -g * 1.2, g * 1.2);
  ctx.beginPath(); ctx.ellipse(0, -g * 1.15, g * 1.0, g * 1.15, 0, 0, Math.PI * 2); ctx.fill();
  if (k.streifen) {
    ctx.strokeStyle = k.streifen; ctx.lineWidth = g * 0.13;
    ctx.beginPath(); for (const sy of [-1.6, -1.15, -0.7]) { ctx.moveTo(-g * 0.9, sy * g); ctx.quadraticCurveTo(-g * 0.5, (sy + 0.1) * g, -g * 0.35, sy * g); } ctx.stroke();
  }
  /* Schürze des Wirts */
  ctx.fillStyle = '#f1f3f5';
  ctx.beginPath(); ctx.moveTo(-g * 0.55, -g * 1.5); ctx.lineTo(g * 0.55, -g * 1.5); ctx.lineTo(g * 0.7, -g * 0.15); ctx.lineTo(-g * 0.7, -g * 0.15); ctx.fill();
  ctx.fillStyle = '#1c7ed6'; ctx.fillRect(-g * 0.55, -g * 1.5, g * 1.1, g * 0.12);
  ctx.fillStyle = k.fell2;
  ctx.beginPath(); ctx.ellipse(-g * 0.4, -g * 0.12, g * 0.3, g * 0.16, 0, 0, Math.PI * 2); ctx.ellipse(g * 0.4, -g * 0.12, g * 0.3, g * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  kopf(k, g, 0, -g * 2.6, { hut: true });
}

function katzeLiegt(c, k, g) {
  const atmen = 1 + Math.sin(S.zeit * 1.8) * 0.04;
  ctx.strokeStyle = k.fell2;
  schwanz(g * 0.9, -g * 1.6, -g * 0.5, S.zeit * 0.8);
  /* flauschiger Körper aus vielen Kreisen */
  ctx.fillStyle = fellVerlauf(k, g, -g * 0.8, g);
  ctx.beginPath(); ctx.ellipse(0, -g * 0.72, g * 1.85, g * 0.72 * atmen, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    ctx.beginPath(); ctx.arc(Math.cos(a) * g * 1.7, -g * 0.72 + Math.sin(a) * g * 0.66 * atmen, g * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = k.fell2;
  ctx.beginPath(); ctx.ellipse(g * 1.2, -g * 0.12, g * 0.4, g * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  kopf(k, g, g * 1.45, -g * 0.95, { augen: 'zu' });
  /* Schleife von Oma */
  ctx.fillStyle = '#f06595';
  ctx.beginPath(); ctx.moveTo(g * 1.05, -g * 1.55); ctx.lineTo(g * 0.7, -g * 1.8); ctx.lineTo(g * 0.72, -g * 1.35); ctx.fill();
  ctx.beginPath(); ctx.moveTo(g * 1.05, -g * 1.55); ctx.lineTo(g * 1.4, -g * 1.85); ctx.lineTo(g * 1.38, -g * 1.35); ctx.fill();
}

function katzeFlucht(c, k, g) {
  /* gesträubtes Fell: Zacken rund um den gebuckelten Körper, Schwanz senkrecht, Augen groß */
  ctx.strokeStyle = k.fell2; ctx.lineWidth = g * 0.3; ctx.lineCap = 'round';
  ctx.beginPath();
  const lauf = c.ft * 30;
  for (const [bx, ph] of [[-0.9, 0], [-0.5, 2], [0.6, 1], [1.0, 3]]) { ctx.moveTo(bx * g, -g * 1.0); ctx.lineTo(bx * g + Math.sin(lauf + ph) * g * 0.5, -g * 0.1); }
  ctx.stroke();
  ctx.fillStyle = fellVerlauf(k, g, -g * 1.5, g);
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rr = i % 2 ? 1 : 1.28;
    ctx.lineTo(Math.cos(a) * g * 1.5 * rr, -g * 1.5 + Math.sin(a) * g * 0.95 * rr - (Math.sin(a) < 0 ? g * 0.25 : 0));
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = k.fell2;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const yy = -g * 1.6 - i * g * 0.22; ctx.lineTo(-g * 1.4 + (i % 2 ? g * 0.35 : -g * 0.35), yy); }
  for (let i = 10; i >= 0; i--) ctx.lineTo(-g * 1.4, -g * 1.6 - i * g * 0.22);
  ctx.fill();
  kopf(k, g, g * 1.45, -g * 2.0, { augen: 'gross', mund: true, brille: c.typ === 'ski', hut: c.typ === 'wirt' });
}

function funkeln(g) {
  ctx.fillStyle = '#fff9db';
  for (let i = 0; i < 4; i++) {
    const a = S.zeit * 3 + i * 1.6;
    const sx = Math.cos(a) * g * 2.2, sy = -g * 1.5 + Math.sin(a * 1.3) * g * 1.2;
    const s = g * (0.15 + 0.12 * Math.sin(S.zeit * 8 + i));
    ctx.beginPath(); ctx.moveTo(sx, sy - s * 2); ctx.lineTo(sx + s * 0.5, sy); ctx.lineTo(sx, sy + s * 2); ctx.lineTo(sx - s * 0.5, sy); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - s * 2, sy); ctx.lineTo(sx, sy + s * 0.5); ctx.lineTo(sx + s * 2, sy); ctx.lineTo(sx, sy - s * 0.5); ctx.fill();
  }
}

/* ---------- Sprechblase und Banner ---------- */
function rufBlase(r) {
  const { W, H, u } = L;
  const a = Math.min(1, r.t * 6, (r.life - r.t) * 3);
  const s = Math.round(clamp(u * 0.95, 15, 30));
  ctx.font = `900 ${s}px ${getComputedStyle(document.documentElement).getPropertyValue('--gt-font')}`;
  const maxW = W - 40;
  const worte = r.text.split(' ');
  const zeilen = [];
  let z = '';
  for (const w of worte) { const t = z ? `${z} ${w}` : w; if (ctx.measureText(t).width > maxW - s && z) { zeilen.push(z); z = w; } else z = t; }
  zeilen.push(z);
  const bw = Math.min(maxW, Math.max(...zeilen.map((t) => ctx.measureText(t).width)) + s * 1.4);
  const bh = zeilen.length * s * 1.25 + s * 0.8;
  let x = W / 2, y = H * (L.quer ? 0.26 : 0.17);
  if (r.wackeln) { x += Math.sin(r.t * 40) * u * 0.25; y += Math.cos(r.t * 33) * u * 0.15; }
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(30,14,4,.82)';
  ctx.strokeStyle = r.farbe; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, s * 0.6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = r.farbe; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  zeilen.forEach((t, i) => ctx.fillText(t, x, y - (zeilen.length - 1) * s * 0.62 + i * s * 1.25));
  ctx.globalAlpha = 1;
}

function bannerZeichnen(b) {
  const { W, H, u } = L;
  const a = Math.min(1, b.t * 5, (b.dauer - b.t) * 4);
  const s = Math.round(clamp(u * 1.6, 22, 52));
  ctx.font = `900 ${s}px ${getComputedStyle(document.documentElement).getPropertyValue('--gt-font')}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = a;
  const y = L.cy;
  ctx.fillStyle = 'rgba(30,14,4,.6)';
  ctx.fillRect(0, y - s * 0.9, W, s * 1.8);
  ctx.lineWidth = s * 0.18; ctx.strokeStyle = '#4a2410'; ctx.lineJoin = 'round';
  ctx.strokeText(b.text, W / 2, y);
  ctx.fillStyle = '#ffe066'; ctx.fillText(b.text, W / 2, y);
  ctx.globalAlpha = 1;
}

/* ---------- Hintergrund und Scheibe (nur bei Größenänderung) ---------- */
function malHintergrund() {
  const { W, H, u } = L;
  bgCanvas = bgCanvas || document.createElement('canvas');
  bgCanvas.width = Math.round(W * view.dpr); bgCanvas.height = Math.round(H * view.dpr);
  const c = bgCanvas.getContext('2d');
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  /* Holzbalken */
  const ph = u * 2.3;
  let seed = 7;
  const zr = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let y = 0, i = 0; y < H; y += ph, i++) {
    const g = c.createLinearGradient(0, y, 0, y + ph);
    const t = 0.9 + zr() * 0.2;
    g.addColorStop(0, shade('#a8683a', t * 1.08)); g.addColorStop(0.5, shade('#8c522a', t)); g.addColorStop(1, shade('#6b3b1b', t));
    c.fillStyle = g; c.fillRect(0, y, W, ph);
    c.strokeStyle = 'rgba(50,22,6,.25)'; c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const yy = y + ph * (0.2 + zr() * 0.6);
      c.beginPath(); c.moveTo(0, yy);
      for (let x = 0; x <= W; x += 40) c.lineTo(x, yy + Math.sin(x * 0.02 + k + i) * u * 0.1);
      c.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = zr() * W, ky = y + ph * (0.3 + zr() * 0.4);
      c.fillStyle = 'rgba(60,28,8,.35)'; c.beginPath(); c.ellipse(kx, ky, u * 0.35, u * 0.18, 0, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(30,12,2,.6)'; c.fillRect(0, y + ph - 2, W, 2);
  }
  /* warmes Licht von oben, dunkle Ränder */
  const licht = c.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75);
  licht.addColorStop(0, 'rgba(255,200,120,.25)'); licht.addColorStop(0.6, 'rgba(0,0,0,0)'); licht.addColorStop(1, 'rgba(20,8,0,.55)');
  c.fillStyle = licht; c.fillRect(0, 0, W, H);

  fensterMalen(c);
  regalMalen(c);
  geweihMalen(c, L.geweih.x, L.geweih.y, L.geweih.s);
  thekeMalen(c);
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round((n >> 16) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function fensterMalen(c) {
  const { u } = L;
  const f = L.fenster;
  const rahmen = u * 0.45;
  c.fillStyle = '#4a2610';
  c.fillRect(f.x - rahmen, f.y - rahmen, f.w + rahmen * 2, f.h + rahmen * 2);
  const himmel = c.createLinearGradient(0, f.y, 0, f.y + f.h);
  himmel.addColorStop(0, '#0b1f45'); himmel.addColorStop(1, '#3d5f9e');
  c.fillStyle = himmel; c.fillRect(f.x, f.y, f.w, f.h);
  c.fillStyle = '#fffbe6';
  c.beginPath(); c.arc(f.x + f.w * 0.78, f.y + f.h * 0.25, Math.min(f.w, f.h) * 0.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 12; i++) c.fillRect(f.x + ((i * 0.37) % 1) * f.w, f.y + ((i * 0.53) % 0.5) * f.h, 1.5, 1.5);
  /* verschneite Berge */
  c.save(); c.beginPath(); c.rect(f.x, f.y, f.w, f.h); c.clip();
  for (const [hoehe, farbe, ph] of [[0.55, '#9fb4d6', 0.3], [0.38, '#e9f0fa', 1.4]]) {
    c.fillStyle = farbe; c.beginPath(); c.moveTo(f.x, f.y + f.h);
    for (let i = 0; i <= 8; i++) { const x = f.x + (i / 8) * f.w; c.lineTo(x, f.y + f.h * (1 - hoehe * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.3 + ph))))); }
    c.lineTo(f.x + f.w, f.y + f.h); c.fill();
  }
  /* Tannen */
  c.fillStyle = '#1f4a3a';
  for (let i = 0; i < 6; i++) {
    const tx = f.x + (i + 0.3) * f.w / 6, ty = f.y + f.h, th = f.h * (0.18 + (i % 3) * 0.05);
    c.beginPath(); c.moveTo(tx, ty - th); c.lineTo(tx - th * 0.32, ty); c.lineTo(tx + th * 0.32, ty); c.fill();
  }
  /* Eisblumen an den Ecken */
  const eis = c.createRadialGradient(f.x, f.y + f.h, 0, f.x, f.y + f.h, Math.min(f.w, f.h) * 0.6);
  eis.addColorStop(0, 'rgba(255,255,255,.6)'); eis.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = eis; c.fillRect(f.x, f.y, f.w, f.h);
  c.restore();
  /* Sprossen */
  c.fillStyle = '#5c3216';
  c.fillRect(f.x + f.w / 2 - u * 0.15, f.y, u * 0.3, f.h);
  c.fillRect(f.x, f.y + f.h / 2 - u * 0.15, f.w, u * 0.3);
  /* Schnee auf dem Rahmen unten innen */
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(f.x, f.y + f.h);
  for (let i = 0; i <= 10; i++) c.lineTo(f.x + (i / 10) * f.w, f.y + f.h - u * (0.25 + 0.15 * Math.sin(i * 2.1)));
  c.lineTo(f.x + f.w, f.y + f.h); c.fill();
  /* Fensterbank */
  holzbrett(c, f.x - rahmen * 2, f.sims, f.w + rahmen * 4, u * 0.55);
  /* rot-weiß karierte Vorhänge */
  for (const s of [0, 1]) {
    const vx = s ? f.x + f.w - f.w * 0.12 : f.x - rahmen;
    c.fillStyle = '#c92a2a';
    c.beginPath(); c.moveTo(vx, f.y - rahmen * 1.6); c.lineTo(vx + f.w * 0.12 + rahmen, f.y - rahmen * 1.6);
    c.quadraticCurveTo(vx + (s ? f.w * 0.06 : f.w * 0.08), f.y + f.h * 0.5, vx + (s ? f.w * 0.12 + rahmen : 0), f.y + f.h * 0.85);
    c.lineTo(vx + (s ? f.w * 0.12 + rahmen : 0), f.y - rahmen * 1.6); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 5; i++) c.fillRect(vx + (s ? f.w * 0.05 : 0) + (i % 2) * u * 0.3, f.y + i * f.h * 0.16, u * 0.3, u * 0.3);
  }
  c.fillStyle = '#3b1f0c'; c.fillRect(f.x - rahmen * 2, f.y - rahmen * 1.8, f.w + rahmen * 4, u * 0.25);
}

function holzbrett(c, x, y, w, h) {
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(x + h * 0.3, y + h, w - h * 0.3, h * 0.6);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#d39a62'); g.addColorStop(0.3, '#a8693a'); g.addColorStop(1, '#6e3e1c');
  c.fillStyle = g;
  c.beginPath(); c.roundRect(x, y, w, h, h * 0.2); c.fill();
}

function regalMalen(c) {
  const { u } = L;
  const r = L.regal;
  /* Deko hinten auf dem Regal: Schnapsflaschen und Gläser an den Enden */
  const dekor = [[r.x0 + u * 0.6, '#2f9e44', 1.6], [r.x0 + u * 1.3, '#e8590c', 1.3], [r.x1 - u * 0.7, '#a61e4d', 1.5], [r.x1 - u * 1.4, '#f1f3f5', 0.8]];
  for (const [dx, farbe, h] of dekor) {
    const g = c.createLinearGradient(dx - u * 0.3, 0, dx + u * 0.3, 0);
    g.addColorStop(0, shade(farbe === '#f1f3f5' ? '#ced4da' : farbe, 0.7)); g.addColorStop(0.5, farbe); g.addColorStop(1, shade(farbe === '#f1f3f5' ? '#ced4da' : farbe, 0.6));
    c.fillStyle = g;
    c.globalAlpha = 0.85;
    c.beginPath(); c.roundRect(dx - u * 0.27, r.y - u * h, u * 0.54, u * h, u * 0.1); c.fill();
    if (h > 1) c.fillRect(dx - u * 0.1, r.y - u * (h + 0.4), u * 0.2, u * 0.45);
    c.globalAlpha = 1;
  }
  /* Konsolen */
  c.fillStyle = '#4a2610';
  for (const kx of [r.x0 + (r.x1 - r.x0) * 0.15, r.x0 + (r.x1 - r.x0) * 0.85]) {
    c.beginPath(); c.moveTo(kx - u * 0.15, r.y + u * 0.5); c.lineTo(kx + u * 0.15, r.y + u * 0.5); c.lineTo(kx + u * 0.15, r.y + u * 1.6); c.lineTo(kx - u * 0.15, r.y + u * 0.9); c.fill();
  }
  holzbrett(c, r.x0, r.y, r.x1 - r.x0, u * 0.55);
}

function geweihMalen(c, x, y, s) {
  /* Holzschild */
  const sg = c.createLinearGradient(x - s, y - s, x + s, y + s);
  sg.addColorStop(0, '#b8763f'); sg.addColorStop(1, '#5e3013');
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath(); c.ellipse(x + s * 0.15, y + s * 0.2, s * 1.05, s * 1.35, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = sg;
  c.beginPath(); c.ellipse(x, y, s * 1.0, s * 1.3, 0, 0, Math.PI * 2); c.fill();
  /* Geweih */
  c.lineCap = 'round';
  for (const d of [-1, 1]) {
    const g = c.createLinearGradient(x, y, x + d * s * 3, y - s * 3);
    g.addColorStop(0, '#6b4a2b'); g.addColorStop(1, '#f1e3c8');
    c.strokeStyle = g; c.lineWidth = s * 0.32;
    c.beginPath();
    c.moveTo(x + d * s * 0.3, y - s * 0.4);
    c.bezierCurveTo(x + d * s * 1.6, y - s * 0.6, x + d * s * 2.4, y - s * 1.6, x + d * s * 2.2, y - s * 3.0);
    c.stroke();
    c.lineWidth = s * 0.22;
    for (const [t0x, t0y, t1x, t1y] of [[1.2, -0.75, 1.1, -1.8], [1.9, -1.3, 2.9, -2.0], [2.25, -2.2, 1.7, -3.0]]) {
      c.beginPath(); c.moveTo(x + d * s * t0x, y + s * t0y); c.lineTo(x + d * s * t1x, y + s * t1y); c.stroke();
    }
  }
  c.fillStyle = '#e9d8b4';
  c.beginPath(); c.ellipse(x, y - s * 0.3, s * 0.35, s * 0.25, 0, 0, Math.PI * 2); c.fill();
}

function thekeMalen(c) {
  const { W, H, u } = L;
  const y = L.theke.y;
  /* Front mit senkrechten Brettern */
  const fg = c.createLinearGradient(0, y, 0, H);
  fg.addColorStop(0, '#6e3a18'); fg.addColorStop(1, '#3b1c08');
  c.fillStyle = fg; c.fillRect(0, y, W, H - y);
  c.strokeStyle = 'rgba(20,8,0,.45)'; c.lineWidth = 2;
  for (let x = u * 1.6; x < W; x += u * 3.2) { c.beginPath(); c.moveTo(x, y + u * 0.6); c.lineTo(x, H); c.stroke(); }
  c.fillStyle = 'rgba(255,200,120,.08)';
  for (let x = 0; x < W; x += u * 3.2) c.fillRect(x + u * 0.3, y + u * 0.6, u * 0.4, H - y);
  /* Thekenplatte */
  const tg = c.createLinearGradient(0, y - u * 0.15, 0, y + u * 0.6);
  tg.addColorStop(0, '#e0a96d'); tg.addColorStop(0.35, '#b06d36'); tg.addColorStop(1, '#5e2f10');
  c.fillStyle = tg; c.fillRect(0, y - u * 0.1, W, u * 0.7);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, y - u * 0.1, W, u * 0.12);
  /* Bierdeckel und Gläser */
  const gx = L.quer ? W * 0.12 : W * 0.15;
  c.fillStyle = '#f8f0e0';
  c.beginPath(); c.ellipse(gx, y, u * 0.7, u * 0.15, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath(); c.ellipse(gx + u * 2.2, y + u * 0.02, u * 0.6, u * 0.12, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.translate(gx + u * 2.2, y - u * 0.8); masskrugAuf(c, u * 0.75); c.restore();
}
function masskrugAuf(c, u) {
  const w = u * 1.2, h = u * 1.6;
  const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, 'rgba(240,170,30,.9)'); g.addColorStop(0.45, 'rgba(255,220,110,.95)'); g.addColorStop(1, 'rgba(200,120,10,.9)');
  c.fillStyle = g; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = u * 0.1;
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, u * 0.15); c.fill(); c.stroke();
  c.beginPath(); c.arc(w / 2 + u * 0.15, 0, u * 0.38, -Math.PI / 2, Math.PI / 2); c.lineWidth = u * 0.18; c.stroke();
  c.fillStyle = '#fffdf5';
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * w * 0.32, -h / 2, u * 0.33, 0, Math.PI * 2); c.fill(); }
}

function malScheibe() {
  const { Rt, R, u } = L;
  const pad = u * 0.8;
  const size = (Rt + pad) * 2;
  boardCanvas = boardCanvas || document.createElement('canvas');
  boardCanvas.width = boardCanvas.height = Math.round(size * view.dpr);
  const c = boardCanvas.getContext('2d');
  c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const m = size / 2;
  /* Schatten an der Wand */
  c.fillStyle = 'rgba(0,0,0,.45)';
  c.beginPath(); c.arc(m + u * 0.25, m + u * 0.4, Rt * 1.02, 0, Math.PI * 2); c.fill();
  /* schwarzer Rand mit Zahlen */
  const rg = c.createRadialGradient(m - Rt * 0.3, m - Rt * 0.3, Rt * 0.2, m, m, Rt);
  rg.addColorStop(0, '#3a3a3a'); rg.addColorStop(1, '#111');
  c.fillStyle = rg; c.beginPath(); c.arc(m, m, Rt, 0, Math.PI * 2); c.fill();
  const seg = Math.PI / 10;
  const ring = (r0, r1, i, farbe) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * seg, a1 = a0 + seg;
    c.fillStyle = farbe; c.beginPath(); c.arc(m, m, r1 * R, a0, a1); c.arc(m, m, r0 * R, a1, a0, true); c.closePath(); c.fill();
  };
  for (let i = 0; i < 20; i++) {
    const dunkel = i % 2 === 0;
    ring(RING.outer, RING.d1, i, dunkel ? '#1d1d1f' : '#f3e6c8');
    ring(RING.t0, RING.t1, i, dunkel ? '#d6312f' : '#1f8f45');
    ring(RING.d0, RING.d1, i, dunkel ? '#d6312f' : '#1f8f45');
  }
  c.fillStyle = '#1f8f45'; c.beginPath(); c.arc(m, m, RING.outer * R, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d6312f'; c.beginPath(); c.arc(m, m, RING.bull * R, 0, Math.PI * 2); c.fill();
  /* Drähte */
  c.strokeStyle = 'rgba(210,215,220,.8)'; c.lineWidth = Math.max(1, R * 0.007);
  for (const r of [RING.bull, RING.outer, RING.t0, RING.t1, RING.d0, RING.d1]) { c.beginPath(); c.arc(m, m, r * R, 0, Math.PI * 2); c.stroke(); }
  c.beginPath();
  for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 + (i - 0.5) * seg; c.moveTo(m + Math.cos(a) * RING.outer * R, m + Math.sin(a) * RING.outer * R); c.lineTo(m + Math.cos(a) * R, m + Math.sin(a) * R); }
  c.stroke();
  /* Zahlen */
  c.fillStyle = '#f8f9fa';
  c.font = `800 ${Math.round((Rt - R) * 0.62)}px ${getComputedStyle(document.documentElement).getPropertyValue('--gt-font')}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  ZAHLEN.forEach((z, i) => { const a = -Math.PI / 2 + i * seg; c.fillText(String(z), m + Math.cos(a) * (R + (Rt - R) * 0.5), m + Math.sin(a) * (R + (Rt - R) * 0.5)); });
  /* Glanz */
  const gl = c.createRadialGradient(m - Rt * 0.35, m - Rt * 0.45, 0, m - Rt * 0.35, m - Rt * 0.45, Rt * 1.1);
  gl.addColorStop(0, 'rgba(255,255,255,.18)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(m, m, Rt, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#6b6b6b'; c.lineWidth = u * 0.12; c.beginPath(); c.arc(m, m, Rt, 0, Math.PI * 2); c.stroke();
}

/* ---------- Ablauf ---------- */
function folgeWuerfeln() {
  /* ca. jeder 4.–5. Wurf ist Bier; der erste Wurf immer ein Pfeil, insgesamt 2–5 Bierwürfe */
  for (;;) {
    const f = Array.from({ length: RUNDEN * WUERFE }, (_, i) => (i > 0 && Math.random() < 0.23 ? (Math.random() < 0.5 ? 'krug' : 'flasche') : 'pfeil'));
    const n = f.filter((a) => a !== 'pfeil').length;
    if (n >= 2 && n <= 5) return f;
  }
}

function setPhase(phase) {
  S.phase = phase;
  kit.setState(phase === 'menu' ? 'menu' : phase === 'ende' ? 'end' : 'play');
  loop.setMaxFps(phase === 'play' ? 0 : 20);
  $('hud').hidden = $('wurfinfo').hidden = phase !== 'play';
}

function starten() {
  Object.assign(S, {
    runde: 1, wurf: 0, folge: folgeWuerfeln(), scheibe: 0, katzenPlus: 0, abzuege: 0, bier: 0, promille: 0,
    multi: false, pech: 0, laden: false, kraft: 0, wurfPhase: 'zielen', flieger: [], pfeile: [], texte: [], rufe: [],
    teilchen: [], flecken: [], spielzeit: 0, letzte: null, ziel: { x: L.cx / L.W, y: L.cy / L.H },
    banner: { text: `Runde 1 von ${RUNDEN}`, t: 0, dauer: 1.2 }, tasteGesperrt: true,
  });
  kit.show(null);
  setPhase('play');
  zeigeHud();
}

function titelFinden() {
  const kandidaten = [
    ['🐈👑', 'Katzen-König von Fiss', S.katzenPlus],
    ['🍺👑', 'Thekenkönig', S.bier * 55],
    ['🙀', 'Tierschutz-Albtraum', -S.abzuege * 2.5],
    ['🎯🏆', 'Phil Taylor vom Hüttenabend', S.scheibe],
  ];
  kandidaten.sort((a, b) => b[2] - a[2]);
  if (kandidaten[0][2] <= 40) return ['🥨', 'Hütten-Lehrling'];
  return kandidaten[0];
}

async function beenden() {
  const gesamt = S.scheibe + S.katzenPlus + S.abzuege;
  const sekunden = Math.round(S.spielzeit);
  const [emoji, titel] = titelFinden();
  $('ende-emoji').textContent = emoji;
  $('ende-titel').textContent = `„${titel}“`;
  $('abrechnung').innerHTML = `
    <tr><td>🎯 Punkte von der Scheibe</td><td>${S.scheibe}</td></tr>
    <tr><td>🐈 Punkte von Katzen</td><td>+${S.katzenPlus}</td></tr>
    <tr><td>🙀 Abzüge</td><td>${S.abzuege}</td></tr>
    <tr><td>🍻 Bierwürfe · Promille</td><td>${S.bier} · ${fmt(S.promille)} ‰</td></tr>
    <tr class="summe"><td>⭐ Gesamt</td><td id="gesamt">${gesamt}</td></tr>`;
  /* Bestenliste: Punkte (nie unter 0), bei Gleichstand zählt die Zeit */
  storage.saveScore({ points: Math.max(0, gesamt), seconds: sekunden });
  sound.gewonnen();
  setPhase('ende');
  kit.show('ende');
  $('rekord').textContent = '';
  try {
    const alle = await storage.getScores();
    const best = Math.max(Math.max(0, gesamt), ...alle.map((s) => s.points));
    $('rekord').textContent = gesamt >= best ? '🏆 Das ist dein Rekord! Wie stehst du in der Bestenliste der Fisser-Flitzer?' : `Dein Rekord: ${best} Punkte`;
  } catch { /* ohne Rekord-Anzeige */ }
}

function zeigeHud() {
  const inRunde = S.wurf - (S.runde - 1) * WUERFE;
  const punkte = '●'.repeat(clamp(inRunde, 0, 3)) + '○'.repeat(clamp(3 - inRunde, 0, 3));
  $('hud-runde').textContent = `${S.runde}/${RUNDEN} ${punkte}`;
  $('hud-punkte').textContent = `⭐ ${S.scheibe + S.katzenPlus + S.abzuege}`;
  $('hud-promille').textContent = `🍻 ${fmt(S.promille)}‰`;
  const art = S.folge[Math.min(S.wurf, S.folge.length - 1)] || 'pfeil';
  const extra = [S.multi ? '⛷️ ×2' : '', S.pech > 0 ? '🐈‍⬛ Pech' : ''].filter(Boolean).join(' · ');
  const schmal = matchMedia('(max-width: 520px)').matches;
  const info = art === 'krug' ? (schmal ? '🍺 Maßkrug!' : '🍺 Maßkrug! Spritzt alles nass') : art === 'flasche' ? (schmal ? '🍾 Bierflasche!' : '🍾 Bierflasche! Bullseye = Prost-Bonus') : '🎯 Pfeil';
  const teile = [info, extra, schmal ? `🍻 ${fmt(S.promille)}‰` : ''].filter(Boolean);
  $('wurfinfo').textContent = teile.join(' · ');
  $('wurfinfo').classList.toggle('bier', art !== 'pfeil');
}

/* ---------- Eingaben: Maus/Finger ---------- */
let zeiger = null;
function zielVonZeiger(e) {
  const r = canvas.getBoundingClientRect();
  const versatz = e.pointerType === 'mouse' ? 0 : Math.min(60, L.H * 0.12); // Finger verdeckt sonst das Fadenkreuz
  S.ziel.x = clamp((e.clientX - r.left) / r.width, 0.01, 0.99);
  S.ziel.y = clamp((e.clientY - r.top - versatz) / r.height, 0.03, 0.99);
}
canvas.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'play' || kit.paused) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  zeiger = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* z. B. nachgestellte Eingaben im Test */ }
  zielVonZeiger(e);
  ladenStart('zeiger');
});
canvas.addEventListener('pointermove', (e) => {
  if (S.phase !== 'play') return;
  if (zeiger === e.pointerId || e.pointerType === 'mouse') zielVonZeiger(e);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId !== zeiger) return;
  zeiger = null;
  if (S.laden && S.ladenQuelle === 'zeiger') ladenEnde();
});
canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== zeiger) return;
  zeiger = null;
  if (S.ladenQuelle === 'zeiger') S.laden = false;
});

input.on('aktion', () => { if (S.phase === 'menu') starten(); });
document.querySelector('[data-action="start"]').addEventListener('click', starten);
document.querySelector('[data-action="nochmal"]').addEventListener('click', starten);

/* Größe und Drehung: Canvas scharf halten, Hintergrund und Scheibe neu malen */
kit.viewport.onResize(() => {
  view = fitCanvas(canvas);
  L = layout();
  malHintergrund();
  malScheibe();
  loop.renderOnce();
});

/* Zugang für den Durchspiel-Test (tools/spieltests/katzen-darts.js) – ändert nichts am Spiel */
window.SPIEL = {
  loop,
  katzenArten: KATZEN,
  state: () => ({
    phase: S.phase, wurfPhase: S.wurfPhase, runde: S.runde, wurf: S.wurf, art: S.folge[S.wurf] || null,
    scheibe: S.scheibe, katzenPlus: S.katzenPlus, abzuege: S.abzuege, gesamt: S.scheibe + S.katzenPlus + S.abzuege,
    bier: S.bier, promille: S.promille, multi: S.multi, pech: S.pech, laden: S.laden, kraft: S.kraft, letzte: S.letzte,
    wackel: Math.hypot(S.wackel.x, S.wackel.y), wackelStaerke: L ? wackelStaerke() : 0,
  }),
  wertung: (x, y) => wertung(x, y),
  feld: (feld, zahl) => feldPunkt(feld, zahl),
  /* nächsten Wurf auf eine Art festlegen (pfeil | krug | flasche) */
  art(a) { S.folge[S.wurf] = a; zeigeHud(); },
  /* genau auf (x, y) werfen, ohne Wackeln und Kraft (Pixel der Szene) */
  wurf: (x, y) => werfen(x, y, 0.7, true),
  rufe: () => S.rufe.map((r) => r.text),
  /* Katze hinsetzen, die stillhält (für den Test), gibt ihren Mittelpunkt zurück */
  katze(typ) {
    S.katzen = S.katzen.filter((c) => c.fest && c.typ !== typ);
    S.spawn.regal = S.spawn.theke = 5; S.spawn.gold = 30;
    const fest = typ === 'perser' || typ === 'wirt';
    const c = neueKatze(typ, typ === 'perser' ? 'fenster' : typ === 'wirt' ? 'theke' : 'theke');
    if (!fest) { c.fx = 0.25; c.stopp = 99; }
    c.alpha = 1;
    const h = hitbox(c);
    return { x: h.x, y: h.y };
  },
  katzen: () => S.katzen.map((c) => ({ typ: c.typ, state: c.state, ...hitbox(c) })),
  layout: () => ({ ...L }),
};

setPhase('menu');
kit.show('start');
loop.start();
