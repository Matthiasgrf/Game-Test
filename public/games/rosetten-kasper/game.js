/* Der Rosetten-Kasper – Abfahrts-Runner mit Notfall. Regeln: docs/GAME_STANDARD.md, Inhalt: readme.md.

   Kasper fährt vom Schönjoch zur Talstation Fiss (2000 m). Er fährt von selbst, ← → lenkt,
   Leertaste kneift zusammen (Druck sinkt, Kasper bremst stark), ↑ gibt den Rückstoß-Boost.
   Das Klemm-O-Meter steigt ständig; bei 100 % ist das Spiel vorbei.

   Szene: Pseudo-3D mit Canvas 2D. Die Piste besteht aus Abschnitten (SEG Meter), die von hinten nach vorn
   gezeichnet werden; Bäume, Freunde und Pick-ups sind Sprites in Weltkoordinaten (z = Meter ab Start,
   x = Meter seitlich von der Pistenmitte). Die Strecke ist fest (gleicher Zufalls-Startwert),
   damit alle in der Bestenliste dieselbe Abfahrt haben. */
import { startKit, createLoop, fitCanvas } from '../shared/kit/kit.js';

const $ = (id) => document.getElementById(id);
const canvas = $('szene');
const ctx = canvas.getContext('2d');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/* ---------- Regeln (Zahlen) ---------- */
const LAENGE = 2000;              // Meter bis zur Talstation
const SEG = 2.5;                  // Länge eines Pisten-Abschnitts beim Zeichnen
const SICHT = 230;                // Sichtweite in Metern
const TEMPO = 21;                 // normale Geschwindigkeit (m/s)
const TEMPO_KNEIFEN = 6;
const TEMPO_BOOST = 34;
const DRUCK_START = 30;
const PUNKTE = { ankunft: 500, knoedel: 100, sprung: 50, panne: -250 };
const MALHEUR_MAX = 400;         // Malheur: gefahrene Meter ÷ 5, höchstens 400 (weniger als die Ankunft)
const ZEIT_REFERENZ = 140;        // Zeitbonus: (140 s − Fahrzeit) × 30
const ZEIT_FAKTOR = 30;
const BONUS_99 = [[99, 1500, 'Mit 99 % ins Ziel!'], [95, 600, 'Mit 95 % ins Ziel'], [90, 300, 'Mit 90 % ins Ziel']];
const TITEL = [[7000, '🏵️ Anwärter auf die Goldene Rosette'], [5000, '🥈 Silberne Rosette'], [3000, '🥉 Bronzene Rosette'], [0, '🧻 Notfall-Lehrling']];
/* Sammeldinge: Punkte und Druck (+ mehr, − weniger). Je wertvoller, desto seltener und heikler die Stelle. */
const SAMMEL = {
  brezel: { emoji: '🥨', name: 'Brezel', mehr: 'Brezeln', punkte: 50, druck: 2 },
  edelweiss: { emoji: '🌼', name: 'Edelweiß', mehr: 'Edelweiß', punkte: 75, druck: 0 },
  knoedel: { emoji: '🥟', name: 'Kaspressknödel', mehr: 'Knödel', punkte: 100, druck: 5 },
  schmarrn: { emoji: '🥞', name: 'Kaiserschmarrn', mehr: 'Kaiserschmarrn', punkte: 150, druck: 8 },
  germknoedel: { emoji: '🍚', name: 'Germknödel', mehr: 'Germknödel', punkte: 200, druck: 10 },
  klopapier: { emoji: '🧻', name: 'Goldene Klopapierrolle', mehr: 'Goldene Klopapierrollen', punkte: 300, druck: -10 },
};

/* ---------- Kit ---------- */
const kit = startKit({
  key: 'rosetten-kasper',
  orientation: 'any',
  pause: () => { S.pausiertSeit = performance.now(); loop.pause(); },
  resume: () => { S.realPause += performance.now() - S.pausiertSeit; loop.resume(); },
});
const { input, sound, storage } = kit;

/* ---------- Strecke ---------- */
function zufall(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const bump = (z, a, b, r) => smooth((z - a + r) / r) * smooth((b + r - z) / r);
const MITTE0 = 20 * Math.sin(0) + 9 * Math.sin(1.3);
/* Pistenmitte (seitlich, m), Höhe (m), halbe Pistenbreite (m) */
const mitte = (z) => 20 * Math.sin(z / 170) + 9 * Math.sin(z / 70 + 1.3) - MITTE0;
const hoehe = (z) => (3.2 * Math.sin(z / 95) + 1.6 * Math.sin(z / 41 + 2)) * smooth((LAENGE - z) / 90);
const breite = (z) => 13 - 7.5 * bump(z, 1195, 1262, 28) + 5 * smooth((z - (LAENGE - 140)) / 90);
const BUCKEL = [[640, 790], [1765, 1830]];
const imBuckel = (z) => BUCKEL.some(([a, b]) => z >= a && z <= b);

/* Hindernisse und Pick-ups. r = halbe Breite für Zusammenstöße (m). */
const ART = {
  knoedel: { r: 0.95, pickup: true },
  brezel: { r: 0.95, pickup: true },
  edelweiss: { r: 0.95, pickup: true },
  schmarrn: { r: 1, pickup: true },
  germknoedel: { r: 1, pickup: true },
  klopapier: { r: 1, pickup: true },
  schnaps: { r: 0.95, pickup: true },
  dixi: { r: 1.4 },
  dani: { r: 2.1, name: 'Dani', text: 'Dani liegt quer: „Hoppala, i lieg nur kurz!“' },
  alex: { r: 0.8, name: 'Alex', text: 'Alex: „Bitte lächeln!“ 📸 – Selfie-Crash!' },
  matze: { r: 0.85, name: 'Matze', text: 'Matze: „Gemma no oane?“ – Nein, Matze!' },
  raupe: { r: 2.7, text: 'Pistenraupe! Brumm – Kasper liegt im Schnee.' },
  kind: { r: 0.55, text: 'Skischule! „Pizza! Pizza!“ – alle liegen.' },
  schanze: { r: 3.6 },
};

let OBJ = [];      // alle Objekte der Strecke
let BAEUME = [];   // Deko am Pistenrand (nach z sortiert)
let KANONEN = [];

function baueStrecke() {
  const rnd = zufall(20261127);
  OBJ = [];
  const add = (art, z, x, extra = {}) => { const o = { art, z, z0: z, x, rel: z, weg: false, ...extra }; OBJ.push(o); return o; };
  /* Knödel: [z, x] – manche liegen absichtlich an heiklen Stellen */
  for (const [z, x] of [
    [90, 0], [110, 2], [130, 4], [250, -5], [270, -6], [290, -6], [362, 3.5], [470, -2], [490, 1],
    [680, 0], [720, 3], [760, -2], [852, 0], [868, 0], [1010, 6], [1100, -4], [1228, 3.2],
    [1300, 0], [1420, 4], [1590, -3], [1650, 2], [1742, 3], [1800, -1], [1850, 5], [1900, 0], [1950, -3],
  ]) add('knoedel', z, x);
  /* Brezeln in Reihen (50) */
  for (const [z0, x, n] of [[60, -3, 3], [200, 3, 3], [410, -6, 2], [580, 4, 3], [940, -2, 2], [1130, -2, 2], [1340, -5, 3], [1480, 2, 2], [1875, -6, 3]]) {
    for (let i = 0; i < n; i++) add('brezel', z0 + i * 12, x);
  }
  /* Edelweiß ganz am Pistenrand (75) */
  for (const [z, s] of [[180, -1], [650, 1], [1050, -1], [1520, 1], [1725, -1]]) add('edelweiss', z, s * (breite(z) - 1));
  /* Kaiserschmarrn knapp hinter oder vor Hindernissen (150) */
  for (const [z, x] of [[346, -3], [700, -4], [1238, -3.2], [1612, 1.5], [1960, 4]]) add('schmarrn', z, x);
  /* Germknödel nur im Sprung oder neben der Pistenraupe (200) */
  for (const [z, x] of [[876, 0], [1452, 4.5], [1714, 3]]) add('germknoedel', z, x);
  /* Goldene Klopapierrolle (300, senkt den Druck): im Kanonen-Nebel, neben dem Dixi, kurz vor dem Ziel */
  add('klopapier', 1000, breite(1000) - 4);
  add('klopapier', 1476, -(breite(1476) - 1.6));
  add('klopapier', 1985, 0);
  for (const [z, x] of [[560, -7], [1150, 6], [1680, -6]]) add('schnaps', z, x);
  add('dixi', 520, breite(520) - 1.4);
  add('dixi', 1460, -(breite(1460) - 1.4));
  add('dani', 340, -3);
  add('matze', 1228, 0);
  add('alex', 1620, 1.5);
  add('raupe', 1445, 5, { aktiv: false });
  add('schanze', 830, 0);
  add('schanze', 1705, 3);
  /* Skischule in Schlangenform: Skilehrer vorn, sechs Kinder dahinter */
  for (let i = 0; i < 7; i++) add('kind', 440 - i * 2.4, 0, { gruppe: 440, nr: i, aktiv: false });
  for (let i = 0; i < 6; i++) add('kind', 1080 - i * 2.4, 0, { gruppe: 1080, nr: i, aktiv: false, phase: 2 });
  /* Schneekanonen am Rand: s = Seite (+1 rechts, −1 links) */
  KANONEN = [{ z: 990, s: 1 }, { z: 1560, s: -1 }];
  /* Schilder, Start, Ziel, Talstation, Hütte */
  add('schild', 600, -(breite(600) + 1.2), { text: '⚠ Buckelpiste' });
  add('schild', 1160, breite(1160) + 1.2, { text: '⚠ Engstelle' });
  add('schild', 1760, -(breite(1760) + 1.2), { text: '⚠ Buckel' });
  add('schild', 1880, breite(1880) + 1.4, { text: 'Talstation · WC 120 m' });
  add('start', 9, 0);
  add('huette', 26, -(breite(26) + 8));
  add('ziel', LAENGE, 0);
  add('talstation', LAENGE + 34, 0);
  /* Pistenstangen alle 25 m */
  for (let z = 40; z < LAENGE; z += 25) { add('stange', z, -(breite(z) + 0.6), { farbe: 0 }); add('stange', z, breite(z) + 0.6, { farbe: 1 }); }
  /* Buckel als Deko */
  for (const [a, b] of BUCKEL) for (let z = a; z <= b; z += 5.5) for (let k = -2; k <= 2; k++) add('buckel', z + rnd() * 2, k * 4.4 + (rnd() - 0.5) * 2.5, { g: 0.8 + rnd() * 0.5 });
  OBJ.sort((a, b) => a.z - b.z);
  /* Bäume beidseits */
  BAEUME = [];
  for (let z = -10; z < LAENGE + 70; z += 3.2 + rnd() * 4) {
    for (const s of [-1, 1]) {
      if (rnd() < 0.25) continue;
      const nah = z > LAENGE - 20 && z < LAENGE + 60;
      BAEUME.push({ z: z + rnd() * 2, x: s * (breite(z) + 3.5 + (nah ? 14 : 0) + rnd() * rnd() * 16), h: 4 + rnd() * 5, t: rnd() });
    }
  }
  BAEUME.sort((a, b) => a.z - b.z);
}

/* ---------- Zustand ---------- */
const S = {
  phase: 'menu',            // menu | play | malheur | ziel | ende
  z: 0, x: 0, v: 0, vx: 0,
  luft: 0, vy: 0,           // Sprung: Höhe über dem Schnee
  druck: DRUCK_START,
  knoedel: 0, pannen: 0, spruenge: 0, stuerze: 0, gesammelt: {},
  sturz: 0, halt: 0, boost: 0, boostPause: 0, wackel: 0, kneift: false,
  kanone: false, buckel: false, wackler: 0,
  t: 0,                     // Fahrzeit (s, ohne Pause)
  start: 0, realPause: 0, pausiertSeit: 0,
  zeit: 0,                  // Animationen
  ende: 0,                  // Zeit seit Malheur/Ziel
  ruf: null,                // Sprechblase über Kasper
  grummel: 2,
  risiko: null,             // nur für den Test: erzwingt „nicht nur Luft“ (true/false)
  ergebnis: null,
  flecken: [],
};
let view = { width: 1, height: 1, dpr: 1 };
const cam = { hor: 0, feet: 0, K: 1, f: 1, back: 7, h: 4, x: 0, y: 0, z: 0, shake: 0 };

function neueRunde() {
  baueStrecke();
  Object.assign(S, {
    z: 0, x: 0, v: 8, vx: 0, luft: 0, vy: 0, druck: DRUCK_START, knoedel: 0, gesammelt: {}, pannen: 0, spruenge: 0, stuerze: 0,
    sturz: 0, halt: 0, boost: 0, boostPause: 0, wackel: 0, kneift: false, kanone: false, buckel: false,
    t: 0, start: performance.now(), realPause: 0, ende: 0, ruf: null, grummel: 2, ergebnis: null, flecken: [],
  });
  zeigeHud(true);
}

function kamera() {
  const { width: W, height: H } = view;
  const hoch = H > W * 1.05;
  cam.hor = H * (hoch ? 0.3 : 0.34);
  cam.feet = H * (hoch ? 0.8 : 0.85);
  const px = hoch ? clamp(W * 0.25, 60, 150) : clamp(H * 0.21, 58, 190);   // Kasper-Größe in Pixeln
  cam.K = px / 1.75;
  cam.back = hoch ? 9 : 7;
  cam.f = cam.K * cam.back;
  cam.h = (cam.feet - cam.hor) / cam.K;
}

/* ---------- Schleife ---------- */
const loop = createLoop({ update, render });

function ruf(text, sek = 2.2) { S.ruf = { text, bis: S.zeit + sek }; }

function update(dt) {
  S.zeit += dt;
  if (S.phase === 'malheur' || S.phase === 'ziel') {
    S.ende += dt;
    S.v = Math.max(0, S.v - (S.phase === 'ziel' ? 9 : 30) * dt);
    S.z += S.v * dt;
    if (S.phase === 'malheur' && S.ende > 2.1) zeigeMalheur();
    if (S.phase === 'ziel' && S.ende > 1.6) zeigeEnde();
    return;
  }
  if (S.phase !== 'play') return;
  S.t += dt;

  /* Eingaben */
  const lenk = (input.down('rechts') ? 1 : 0) - (input.down('links') ? 1 : 0);
  S.kneift = input.down('aktion') && S.sturz <= 0 && S.halt <= 0;
  const hw = breite(S.z);

  /* Tempo */
  let ziel = TEMPO, rate = 4.5;
  if (S.kneift) { ziel = TEMPO_KNEIFEN; rate = 16; }
  if (Math.abs(S.x) > hw) { ziel = Math.min(ziel, 9); rate = Math.max(rate, 10); }
  if (S.boost > 0) { ziel = TEMPO_BOOST; rate = 30; }
  if (S.sturz > 0 || S.halt > 0) { S.v = 0; ziel = 0; }
  const d = ziel - S.v;
  S.v += clamp(d, -rate * dt, (d > 0 && S.boost <= 0 ? 4.5 : rate) * dt);
  S.boost = Math.max(0, S.boost - dt);
  S.boostPause = Math.max(0, S.boostPause - dt);
  S.wackel = Math.max(0, S.wackel - dt);
  S.sturz = Math.max(0, S.sturz - dt);
  S.halt = Math.max(0, S.halt - dt);

  /* Lenken (wackelig nach dem Zirbenschnaps) */
  let wunsch = lenk * 9;
  let folgen = 10;
  if (S.wackel > 0) { wunsch += 5 * Math.sin(S.zeit * 4.3) + 3 * Math.sin(S.zeit * 7.7); folgen = 3; }
  if (S.luft > 0) folgen = 1.5;
  if (S.sturz > 0 || S.halt > 0) wunsch = 0;
  S.vx += (wunsch - S.vx) * Math.min(1, folgen * dt);
  S.x = clamp(S.x + S.vx * dt, -(hw + 3), hw + 3);

  /* Sprung */
  if (S.luft > 0 || S.vy > 0) {
    S.vy -= 16 * dt;
    S.luft += S.vy * dt;
    if (S.luft <= 0) {
      S.luft = 0; S.vy = 0;
      S.druck += 14;
      cam.shake = 0.5;
      ruf('Autsch! Die Landung drückt.');
      sound.beep(90, 0.25, 'square', 0.14);
    }
  }

  /* Vorwärts */
  S.z += S.v * dt;

  /* Druck: steigt immer, schneller bei Tempo */
  let dd = 0.9 + S.v * 0.045;
  if (S.kneift) dd -= 13;
  S.buckel = imBuckel(S.z) && S.luft <= 0;
  if (S.buckel) { dd += 5 * S.v / 20; cam.shake = Math.max(cam.shake, 0.18 * S.v / 20); }
  S.kanone = KANONEN.some((k) => S.z > k.z - 5 && S.z < k.z + 26 && k.s * S.x > breite(k.z) - 10);
  if (S.kanone) { dd += 9; if (!S.kanoneGemeldet) { ruf('Brrr! Kälteschock!'); S.kanoneGemeldet = true; sound.beep(1300, 0.3, 'triangle', 0.06); } } else S.kanoneGemeldet = false;
  S.druck = clamp(S.druck + dd * dt, 0, 100);
  cam.shake = Math.max(0, cam.shake - dt);

  /* bewegte Hindernisse */
  for (const o of OBJ) {
    if (o.art === 'raupe') {
      if (!o.aktiv && o.z - S.z < 170) o.aktiv = true;
      if (o.aktiv && !o.weg) o.z -= 2.5 * dt;
    } else if (o.art === 'kind') {
      if (!o.aktiv && o.z - S.z < 130) o.aktiv = true;
      if (o.aktiv) o.z += 4 * dt;
      o.x = 5.5 * Math.sin(o.z / 9 + (o.phase || 0)) + (o.phase ? -1 : 1);
    }
  }

  /* Zusammenstöße: ein Objekt wird „überfahren“, wenn es von vor Kasper nach hinter Kasper wechselt */
  for (const o of OBJ) {
    const rel = o.z - S.z;
    const relAlt = o.rel;
    o.rel = rel;
    if (o.weg || !(relAlt > 0 && rel <= 0)) continue;
    const a = ART[o.art];
    if (!a || Math.abs(S.x - o.x) > a.r + 0.45) continue;
    treffen(o, a);
  }

  /* Grummeln */
  S.grummel -= dt;
  if (S.grummel <= 0) {
    S.grummel = lerp(6, 1.2, S.druck / 100) + Math.random();
    if (S.druck > 55) sound.beep(60 + Math.random() * 35, 0.45, 'sawtooth', 0.05 + S.druck / 1500);
  }

  S.druck = Math.min(100, S.druck);
  if (S.druck >= 100) return malheur();
  if (S.z >= LAENGE) return insZiel();
}

function treffen(o, a) {
  if (a.pickup) {
    o.weg = true;
    const d = SAMMEL[o.art];
    if (d) {
      S.gesammelt[o.art] = (S.gesammelt[o.art] || 0) + 1;
      if (o.art === 'knoedel') S.knoedel++;
      S.druck = Math.max(0, S.druck + d.druck);
      const hoch = d.punkte >= 200;
      sound.melody(hoch ? [[660, 0.06], [880, 0.06], [1175, 0.06], [1568, 0.14]] : [[660, 0.06], [660 + d.punkte * 3, 0.09]], 'triangle', 0.13);
      ruf(`${d.emoji} ${d.name}! +${d.punkte}${d.druck < 0 ? ' · Druck runter' : ''}`, hoch ? 1.8 : 1.2);
    } else {
      S.druck = Math.max(0, S.druck - 20);
      S.wackel = 4;
      sound.melody([[300, 0.08], [250, 0.08], [200, 0.12]], 'sine', 0.13);
      ruf('Zirbenschnaps! Druck runter … hicks!', 2);
    }
    return;
  }
  if (S.luft > 0.8) return;   // drüber gesprungen
  if (o.art === 'schanze') {
    S.vy = 5.5 + S.v * 0.13;
    S.luft = 0.01;
    S.spruenge++;
    sound.melody([[400, 0.08], [600, 0.12]], 'square', 0.08);
    ruf(`Hui! Sprung +${PUNKTE.sprung}`, 1.2);
    return;
  }
  if (o.art === 'dixi') {
    o.weg = true;
    S.halt = 1.6;
    S.druck += 8;
    S.vx = 0;
    sound.melody([[500, 0.1], [420, 0.1], [300, 0.25]], 'square', 0.08);
    ruf('🚽 Besetzt! Gabor: „Dauert no a bissl!“', 2.4);
    return;
  }
  /* Sturz */
  o.weg = true;
  S.sturz = 1.4;
  S.stuerze++;
  S.druck += 10;
  S.vx = 0;
  cam.shake = 0.4;
  sound.beep(110, 0.3, 'square', 0.16);
  sound.beep(70, 0.4, 'sine', 0.2, 0.05);
  ruf(a.text, 2.4);
}

function boost() {
  if (S.phase !== 'play' || S.boostPause > 0 || S.sturz > 0 || S.halt > 0 || S.druck < 8) return;
  const risiko = 0.08 + (S.druck > 80 ? 0.17 : 0);
  const panne = S.risiko !== null ? S.risiko : Math.random() < risiko;
  S.druck = Math.max(0, S.druck - 14);
  S.boost = 1.1;
  S.boostPause = 2.2;
  sound.melody([[170, 0.06], [130, 0.08], [95, 0.14]], 'sawtooth', 0.1);
  if (panne) {
    S.pannen++;
    S.flecken.push({ z: S.z - 1.2, x: S.x, g: 0.7 });
    ruf(`Ups … das war nicht nur Luft! ${PUNKTE.panne}`, 2.4);
  } else ruf('💨 Pffft – Rückstoß!', 1);
}
input.on('hoch', boost);

function malheur() {
  S.druck = 100;
  S.phase = 'malheur';
  S.ende = 0;
  S.flecken.push({ z: S.z + (S.v * S.v) / 60 + 0.3, x: S.x, g: 2.2, gross: true });
  S.kneift = false;
  sound.melody([[392, 0.18], [370, 0.18], [349, 0.18], [330, 0.5]], 'sawtooth', 0.1);
  steuerung(false);
  /* Auch ein Malheur kommt in die Bestenliste – ohne Ankunft, Zeit- und 99-%-Bonus,
     darum liegt jede Ankunft vor einem Malheur mit gleich vielen Knödeln */
  S.ergebnis = malheurWertung();
  storage.saveScore({ points: S.ergebnis.gesamt, seconds: S.ergebnis.sekundenSpeichern });
}

function malheurWertung() {
  const sekunden = Math.round(S.t);
  const real = Math.max(1, Math.round((performance.now() - S.start - S.realPause) / 1000));
  const meter = Math.floor(clamp(S.z, 0, LAENGE));
  const zeilen = [
    [`⛷️ ${meter} m geschafft`, Math.min(MALHEUR_MAX, Math.floor(meter / 5))],
    ...sammelZeilen(),
  ];
  if (S.spruenge) zeilen.push([`🎿 ${S.spruenge} ${S.spruenge === 1 ? 'Sprung' : 'Sprünge'}`, S.spruenge * PUNKTE.sprung]);
  if (S.pannen) zeilen.push([`💩 ${S.pannen}× nicht nur Luft`, S.pannen * PUNKTE.panne]);
  const gesamt = Math.max(0, zeilen.reduce((sum, [, pkt]) => sum + pkt, 0));
  return { zeilen, gesamt, sekunden, sekundenSpeichern: Math.min(sekunden, real), meter, malheur: true };
}

function insZiel() {
  S.phase = 'ziel';
  S.ende = 0;
  S.kneift = false;
  steuerung(false);
  S.ergebnis = wertung();
  sound.gewonnen();
  storage.saveScore({ points: S.ergebnis.gesamt, seconds: S.ergebnis.sekundenSpeichern });
}

/* Wertung beim Zieleinlauf */
function wertung() {
  const sekunden = Math.round(S.t);
  const real = Math.max(1, Math.round((performance.now() - S.start - S.realPause) / 1000));
  const druck = Math.floor(S.druck);
  const zeitBonus = Math.max(0, Math.round((ZEIT_REFERENZ - S.t) * ZEIT_FAKTOR));
  const b = BONUS_99.find(([ab]) => druck >= ab);
  const zeilen = [
    ['🚽 Angekommen', PUNKTE.ankunft],
    [`⏱ Zeit ${fmtZeit(S.t)}`, zeitBonus],
    ...sammelZeilen(),
  ];
  if (S.spruenge) zeilen.push([`🎿 ${S.spruenge} ${S.spruenge === 1 ? 'Sprung' : 'Sprünge'}`, S.spruenge * PUNKTE.sprung]);
  zeilen.push([`🍑 ${b ? b[2] : `Mit ${druck} % ins Ziel`}`, b ? b[1] : 0]);
  if (S.pannen) zeilen.push([`💩 ${S.pannen}× nicht nur Luft`, S.pannen * PUNKTE.panne]);
  const gesamt = Math.max(0, zeilen.reduce((s, [, p]) => s + p, 0));
  return { zeilen, gesamt, sekunden, sekundenSpeichern: Math.min(sekunden, real), druck, titel: TITEL.find(([ab]) => gesamt >= ab)[1] };
}

/* eine Zeile je gesammelter Sorte, Knödel immer */
function sammelZeilen() {
  return Object.entries(SAMMEL).filter(([art]) => art === 'knoedel' || S.gesammelt[art]).map(([art, d]) => {
    const n = S.gesammelt[art] || 0;
    return [`${d.emoji} ${n} ${n === 1 ? d.name : d.mehr}`, n * d.punkte];
  });
}
const sammelPunkte = () => Object.entries(S.gesammelt).reduce((sum, [art, n]) => sum + n * SAMMEL[art].punkte, 0);

const fmtZeit = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- Projektion ---------- */
function proj(wx, wy, wz) {
  const dz = wz - cam.z;
  if (dz < 0.6) return null;
  const s = cam.f / dz;
  return { x: view.width / 2 + (wx - cam.x) * s, y: cam.hor + (cam.y - wy) * s, s, dz };
}

/* Farben: Nebel zur Ferne */
const FERNE = [214, 230, 243];
const mix = (c, t) => `rgb(${Math.round(lerp(c[0], FERNE[0], t))},${Math.round(lerp(c[1], FERNE[1], t))},${Math.round(lerp(c[2], FERNE[2], t))})`;
const C = {
  tief: [[219, 231, 246], [213, 227, 243]],
  piste: [[251, 253, 255], [245, 249, 254]],
  buckel: [[232, 240, 249], [222, 233, 245]],
  rand: [176, 202, 228],
};

/* ---------- Zeichnen ---------- */
function render() {
  const { width: W, height: H } = view;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const pz = S.z;
  cam.z = pz - cam.back;
  cam.x = mitte(pz) + S.x * 0.8;
  cam.y = hoehe(pz) + cam.h;
  if (cam.shake > 0) { cam.y += Math.sin(S.zeit * 55) * cam.shake * 0.25; cam.x += Math.sin(S.zeit * 41) * cam.shake * 0.15; }

  himmel(W, H, pz);

  /* Sprites sammeln (fern → nah) */
  const sprites = [];
  const zMax = cam.z + SICHT;
  for (const b of BAEUME) if (b.z > cam.z + 0.6 && b.z < zMax) sprites.push({ z: b.z, o: b, art: 'baum' });
  for (const o of OBJ) if (o.z > cam.z + 0.6 && o.z < zMax && !(o.weg && ART[o.art]?.pickup)) sprites.push({ z: o.z, o, art: o.art });
  for (const f of S.flecken) if (f.z > cam.z + 0.6 && f.z < zMax) sprites.push({ z: f.z, o: f, art: 'fleck' });
  for (const k of KANONEN) if (k.z > cam.z + 0.6 && k.z < zMax) sprites.push({ z: k.z, o: k, art: 'kanone' });
  sprites.push({ z: pz + 0.001, art: 'kasper' });
  sprites.sort((a, b) => b.z - a.z);

  /* Piste von vorn nach hinten: Jeder Abschnitt merkt sich, wie weit oben der Boden davor schon reicht
     (clip). Er wird nur darüber gezeichnet, ferne Sprites werden an dieser Linie abgeschnitten –
     so verdecken Kuppen, was dahinter liegt. Nahe Sprites (bis 30 m, auch Kasper) kommen zuletzt ganz. */
  const z0 = Math.floor(cam.z / SEG) * SEG;
  const N = Math.ceil(SICHT / SEG);
  const clipZ = [];
  let clip = H;
  for (let i = 0; i <= N; i++) {
    const za = Math.max(z0 + i * SEG, cam.z + 1);
    const zb = z0 + (i + 1) * SEG;
    clipZ.push([za, clip]);
    if (zb <= za) continue;
    clip = Math.min(clip, strip(za, zb, W, clip));
  }
  const nahZ = cam.z + 30;
  let ci = clipZ.length - 1;
  for (const sp of sprites) {
    if (sp.z < nahZ) { zeichneSprite(sp); continue; }
    while (ci > 0 && clipZ[ci][0] > sp.z) ci--;
    zeichneSprite(sp, clipZ[ci][1]);
  }

  /* Schneekanonen-Nebel über allem */
  for (const k of KANONEN) nebel(k);

  /* Druck-Rand: je voller, desto stärker glüht der Bildrand */
  if (S.druck > 70 && S.phase !== 'menu') {
    const a = (S.druck - 70) / 30 * (0.35 + 0.15 * Math.sin(S.zeit * (4 + S.druck / 12)));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(160,60,10,0)');
    g.addColorStop(1, `rgba(150,55,10,${clamp(a, 0, 0.6)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (S.wackel > 0) {
    ctx.fillStyle = `rgba(255,190,80,${0.12 * Math.min(1, S.wackel)})`;
    ctx.fillRect(0, 0, W, H);
  }
  streckenBalken(W, H);
  if (S.phase !== 'menu') zeigeHud();
}

function himmel(W, H, pz) {
  const g = ctx.createLinearGradient(0, 0, 0, cam.hor + 10);
  g.addColorStop(0, '#3d8fd9');
  g.addColorStop(0.7, '#9ccbf0');
  g.addColorStop(1, '#d9ecfa');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, cam.hor + 12);
  /* Sonne */
  const sx = W * 0.78, sy = cam.hor * 0.32;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, cam.hor * 0.6);
  sun.addColorStop(0, 'rgba(255,250,215,1)');
  sun.addColorStop(0.12, 'rgba(255,240,170,.9)');
  sun.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, cam.hor + 12);
  /* Berge: verschieben sich mit der Pistenrichtung */
  const richtung = (mitte(pz + 30) - mitte(pz)) / 30;
  bergKette(W, cam.hor, richtung * W * 0.9 + S.x * 2, 0.55, ['#8fb0d0', '#c3d6e8'], 11, 0.37);
  bergKette(W, cam.hor, richtung * W * 1.6 + S.x * 4, 0.32, ['#6f93b5', '#a9c3dc'], 23, 0.5);
  /* Dorf-Andeutung: Wald am Horizont */
  ctx.fillStyle = '#7d9fb9';
  ctx.fillRect(0, cam.hor - 2, W, 4);
  /* Schnee bis unten: auch dort, wo eine Kuppe den Boden dahinter verdeckt */
  ctx.fillStyle = mix(C.tief[0], 0.45);
  ctx.fillRect(0, cam.hor + 2, W, H - cam.hor);
}

const BERGE = {};
function bergKette(W, hor, off, hoeheAnteil, [farbe, schnee], seed, breiteAnteil) {
  if (!BERGE[seed]) { const r = zufall(seed); BERGE[seed] = Array.from({ length: 14 }, () => ({ h: 0.4 + r() * 0.6, w: 0.6 + r() * 0.8 })); }
  const peaks = BERGE[seed];
  const span = W * breiteAnteil;
  const total = peaks.reduce((s, p) => s + p.w * span, 0);
  let x = -(((off % total) + total) % total) - span;
  ctx.beginPath();
  ctx.moveTo(-10, hor + 2);
  const spitzen = [];
  let i = 0;
  while (x < W + span) {
    const p = peaks[i++ % peaks.length];
    const w = p.w * span;
    const h = p.h * hor * hoeheAnteil;
    ctx.lineTo(x + w * 0.5, hor - h);
    ctx.lineTo(x + w, hor - h * 0.25);
    spitzen.push([x + w * 0.5, hor - h, w, h]);
    x += w;
  }
  ctx.lineTo(W + 10, hor + 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, hor - hor * hoeheAnteil, 0, hor);
  g.addColorStop(0, farbe);
  g.addColorStop(1, schnee);
  ctx.fillStyle = g;
  ctx.fill();
  /* Schneekappen und Schattenseite */
  for (const [sx, sy, w, h] of spitzen) {
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + w * 0.17, sy + h * 0.3);
    ctx.lineTo(sx + w * 0.05, sy + h * 0.24);
    ctx.lineTo(sx - w * 0.06, sy + h * 0.33);
    ctx.lineTo(sx - w * 0.17, sy + h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,60,100,.12)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + w * 0.5, sy + h * 0.75);
    ctx.lineTo(sx + w * 0.1, sy + h);
    ctx.closePath();
    ctx.fill();
  }
}

function strip(za, zb, W, clip) {
  const ma = mitte(za), mb = mitte(zb);
  const a = proj(ma, hoehe(za), za);
  const b = proj(mb, hoehe(zb), zb);
  if (!a || !b) return clip;
  if (a.y <= b.y || b.y >= clip) return clip;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, b.y - 1, W, clip - b.y + 1); ctx.clip();
  const fog = smooth((b.dz - 40) / (SICHT - 40)) * 0.85;
  const band = Math.floor(zb / 5) & 1;
  const y0 = b.y, y1 = a.y + 0.6;
  ctx.fillStyle = mix(C.tief[band], fog);
  ctx.fillRect(0, y0, W, y1 - y0);
  const hwa = breite(za), hwb = breite(zb);
  /* Piste */
  const bu = imBuckel(zb);
  ctx.fillStyle = mix((bu ? C.buckel : C.piste)[band], fog);
  quad(b.x - hwb * b.s, y0, b.x + hwb * b.s, y0, a.x + hwa * a.s, y1, a.x - hwa * a.s, y1);
  /* Rand: weicher blauer Schatten */
  ctx.fillStyle = mix(C.rand, fog);
  const r = 0.9;
  quad(b.x - hwb * b.s, y0, b.x - (hwb - r) * b.s, y0, a.x - (hwa - r) * a.s, y1, a.x - hwa * a.s, y1);
  quad(b.x + (hwb - r) * b.s, y0, b.x + hwb * b.s, y0, a.x + hwa * a.s, y1, a.x + (hwa - r) * a.s, y1);
  /* Cord-Spuren der Pistenraupe und Skispuren */
  if (b.dz < 120) {
    ctx.strokeStyle = `rgba(150,180,215,${0.35 * (1 - b.dz / 120)})`;
    ctx.lineWidth = Math.max(0.5, a.s * 0.05);
    ctx.beginPath();
    for (const k of [-0.62, -0.25, 0.18, 0.55]) {
      const xa = k * hwa + 1.2 * Math.sin(za / 13 + k * 7), xb = k * hwb + 1.2 * Math.sin(zb / 13 + k * 7);
      ctx.moveTo(b.x + xb * b.s, y0);
      ctx.lineTo(a.x + xa * a.s, y1);
    }
    ctx.stroke();
  }
  /* Ziellinie */
  if (za <= LAENGE && zb > LAENGE) {
    ctx.fillStyle = '#e03131';
    quad(b.x - hwb * b.s, y0, b.x + hwb * b.s, y0, a.x + hwa * a.s, y1, a.x - hwa * a.s, y1);
  }
  ctx.restore();
  return b.y;
}

function quad(x1, y1, x2, y2, x3, y3, x4, y4) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
}

function zeichneSprite(sp, clip) {
  if (sp.art === 'kasper') return kasper();
  const o = sp.o;
  const wx = mitte(sp.z) + (o.x || 0);
  const p = proj(wx, hoehe(sp.z), sp.z);
  if (!p) return;
  const fog = smooth((p.dz - 60) / (SICHT - 60));
  if (p.x < -p.s * 30 || p.x > view.width + p.s * 30) return;
  ctx.save();
  if (clip !== undefined && clip < p.y + 2) { ctx.beginPath(); ctx.rect(0, 0, view.width, clip); ctx.clip(); }
  ctx.globalAlpha = 1 - fog * 0.75;
  const f = ZEICHNE[sp.art];
  if (f) f(p.x, p.y, p.s, o, p);
  ctx.restore();
}

function leuchten(x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
/* kleine Sterne, die um wertvolle Dinge kreisen */
function funkeln(x, y, r) {
  ctx.fillStyle = '#fffbe0';
  for (let k = 0; k < 4; k++) {
    const a = S.zeit * 2 + k * 1.57, f = 0.5 + 0.5 * Math.sin(S.zeit * 6 + k * 2);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6, g = Math.max(1.5, r * 0.12 * f);
    ctx.beginPath(); ctx.moveTo(px, py - g * 2); ctx.lineTo(px + g * 0.5, py); ctx.lineTo(px, py + g * 2); ctx.lineTo(px - g * 0.5, py); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - g * 2, py); ctx.lineTo(px, py + g * 0.5); ctx.lineTo(px + g * 2, py); ctx.lineTo(px, py - g * 0.5); ctx.closePath(); ctx.fill();
  }
}
const schatten = (x, y, w, s, a = 0.22) => { ctx.fillStyle = `rgba(40,70,110,${a})`; ctx.beginPath(); ctx.ellipse(x, y, w * s, w * s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); };

function blase(x, y, text, s, farbe = '#fff') {
  const fs = clamp(s * 0.55, 11, 20);
  ctx.font = `800 ${fs}px "Trebuchet MS", sans-serif`;
  const w = Math.min(ctx.measureText(text).width, view.width * 0.8) + fs * 1.1;
  const h = fs * 1.7;
  const bx = clamp(x - w / 2, 6, view.width - w - 6), by = y - h - fs * 0.6;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  rundRect(bx + 2, by + 3, w, h, h / 2); ctx.fill();
  ctx.fillStyle = farbe;
  rundRect(bx, by, w, h, h / 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(clamp(x, bx + h / 2, bx + w - h / 2) - fs * 0.35, by + h - 1); ctx.lineTo(clamp(x, bx + h / 2, bx + w - h / 2), by + h + fs * 0.55); ctx.lineTo(clamp(x, bx + h / 2, bx + w - h / 2) + fs * 0.35, by + h - 1); ctx.fill();
  ctx.fillStyle = '#16324f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + h / 2 + 1, w - fs);
}
function rundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Eine Person (von vorn gesehen, steht bergab zu Kasper hin) */
function person(x, y, s, { jacke, hose, muetze, haut = '#f2c29b', h = 1.75 }) {
  schatten(x, y, 0.55, s);
  const u = s;
  /* Ski */
  ctx.fillStyle = '#334';
  ctx.fillRect(x - 0.32 * u, y - 0.05 * u, 0.12 * u, 0.12 * u);
  ctx.fillRect(x + 0.2 * u, y - 0.05 * u, 0.12 * u, 0.12 * u);
  /* Beine */
  ctx.fillStyle = hose;
  ctx.fillRect(x - 0.3 * u, y - 0.85 * u * h / 1.75, 0.24 * u, 0.82 * u * h / 1.75);
  ctx.fillRect(x + 0.06 * u, y - 0.85 * u * h / 1.75, 0.24 * u, 0.82 * u * h / 1.75);
  /* Körper */
  const top = y - h * u;
  const g = ctx.createLinearGradient(x - 0.4 * u, 0, x + 0.4 * u, 0);
  g.addColorStop(0, jacke[0]); g.addColorStop(1, jacke[1]);
  ctx.fillStyle = g;
  rundRect(x - 0.38 * u, top + 0.34 * u, 0.76 * u, 0.62 * u * h / 1.75, 0.14 * u); ctx.fill();
  /* Kopf */
  ctx.fillStyle = haut;
  ctx.beginPath(); ctx.arc(x, top + 0.2 * u, 0.19 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = muetze;
  ctx.beginPath(); ctx.arc(x, top + 0.15 * u, 0.2 * u, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, top - 0.06 * u, 0.07 * u, 0, Math.PI * 2); ctx.fill();
  /* Gesicht */
  if (u > 14) {
    ctx.fillStyle = '#223';
    ctx.beginPath(); ctx.arc(x - 0.07 * u, top + 0.2 * u, 0.025 * u, 0, Math.PI * 2); ctx.arc(x + 0.07 * u, top + 0.2 * u, 0.025 * u, 0, Math.PI * 2); ctx.fill();
  }
  return top;
}

const ZEICHNE = {
  baum(x, y, s, b) {
    const h = b.h * s, w = b.h * 0.36 * s;
    schatten(x, y, b.h * 0.3, s, 0.18);
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(x - w * 0.08, y - h * 0.18, w * 0.16, h * 0.2);
    const gruen = b.t < 0.5 ? ['#1f5a3a', '#2f7a4c'] : ['#255f3f', '#3a8655'];
    for (let k = 0; k < 3; k++) {
      const ty = y - h * (0.12 + k * 0.27), tw = w * (1 - k * 0.24), th = h * 0.45;
      ctx.fillStyle = gruen[0];
      ctx.beginPath(); ctx.moveTo(x, ty - th); ctx.lineTo(x + tw, ty); ctx.lineTo(x - tw, ty); ctx.closePath(); ctx.fill();
      ctx.fillStyle = gruen[1];
      ctx.beginPath(); ctx.moveTo(x, ty - th); ctx.lineTo(x + tw, ty); ctx.lineTo(x + tw * 0.1, ty); ctx.closePath(); ctx.fill();
      if (s > 2) {
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath(); ctx.moveTo(x, ty - th); ctx.lineTo(x + tw * 0.38, ty - th * 0.6); ctx.lineTo(x, ty - th * 0.66); ctx.lineTo(x - tw * 0.38, ty - th * 0.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - tw * 0.55, ty - th * 0.06, tw * 0.3, th * 0.05, 0, 0, Math.PI * 2); ctx.ellipse(x + tw * 0.6, ty - th * 0.05, tw * 0.28, th * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  stange(x, y, s, o) {
    ctx.fillStyle = o.farbe ? '#1971c2' : '#f76707';
    ctx.fillRect(x - 0.05 * s, y - 1.6 * s, 0.1 * s, 1.6 * s);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 0.05 * s, y - 1.1 * s, 0.1 * s, 0.25 * s);
  },
  buckel(x, y, s, o) {
    const w = 1.6 * o.g * s, h = 0.5 * o.g * s;
    ctx.fillStyle = 'rgba(120,150,190,.35)';
    ctx.beginPath(); ctx.ellipse(x + w * 0.15, y + h * 0.1, w, h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - w * 0.3, y - h * 0.6, 0, x, y - h * 0.2, w);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d3e2f2');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - h * 0.2, w * 0.9, h, 0, Math.PI, 0); ctx.ellipse(x, y - h * 0.2, w * 0.9, h * 0.35, 0, 0, Math.PI); ctx.fill();
  },
  knoedel(x, y, s) {
    const r = 0.5 * s, cy = y - (0.9 + Math.sin(S.zeit * 4 + x * 0.01) * 0.12) * s;
    schatten(x, y, 0.45, s, 0.25);
    const glow = ctx.createRadialGradient(x, cy, 0, x, cy, r * 2.2);
    glow.addColorStop(0, 'rgba(255,214,102,.6)'); glow.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r * 1.1);
    g.addColorStop(0, '#f6d48a'); g.addColorStop(0.6, '#c98a3a'); g.addColorStop(1, '#8a5520');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, cy, r * 1.1, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    /* Kräuter und Glanz */
    ctx.fillStyle = '#3c7a2b';
    for (const [dx, dy] of [[-0.4, -0.1], [0.2, 0.25], [0.45, -0.3], [-0.1, 0.4]]) { ctx.beginPath(); ctx.arc(x + dx * r, cy + dy * r, r * 0.08, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.4, cy - r * 0.4, r * 0.25, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
  },
  brezel(x, y, s) {
    const cy = y - (0.9 + Math.sin(S.zeit * 4 + x * 0.02) * 0.1) * s, r = 0.42 * s;
    schatten(x, y, 0.4, s, 0.22);
    leuchten(x, cy, r * 1.9, '255,190,110', 0.45);
    ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.sin(S.zeit * 2 + x) * 0.15);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pfad = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.55);
      ctx.bezierCurveTo(-r * 1.25, -r * 0.2, -r * 0.7, -r * 0.95, 0, -r * 0.25);
      ctx.bezierCurveTo(r * 0.7, -r * 0.95, r * 1.25, -r * 0.2, r * 0.9, r * 0.55);
      ctx.moveTo(-r * 0.9, r * 0.55); ctx.lineTo(r * 0.35, -r * 0.05);
      ctx.moveTo(r * 0.9, r * 0.55); ctx.lineTo(-r * 0.35, -r * 0.05);
    };
    pfad(); ctx.strokeStyle = '#6e3a12'; ctx.lineWidth = r * 0.42; ctx.stroke();
    pfad(); ctx.strokeStyle = '#b8682a'; ctx.lineWidth = r * 0.3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,.55)'; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(-r * 0.85, -r * 0.1); ctx.bezierCurveTo(-r * 0.75, -r * 0.6, -r * 0.4, -r * 0.7, -r * 0.15, -r * 0.45); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [dx, dy] of [[-0.8, 0.1], [-0.45, -0.6], [0.5, -0.62], [0.85, 0.05], [0, -0.22], [-0.55, 0.45], [0.6, 0.42]]) ctx.fillRect(dx * r, dy * r, r * 0.09, r * 0.09);
    ctx.restore();
  },
  edelweiss(x, y, s) {
    const cy = y - (0.85 + Math.sin(S.zeit * 3 + x * 0.02) * 0.1) * s, r = 0.45 * s;
    schatten(x, y, 0.35, s, 0.2);
    leuchten(x, cy, r * 2, '255,255,220', 0.55);
    ctx.save(); ctx.translate(x, cy); ctx.rotate(S.zeit * 0.6);
    for (let k = 0; k < 8; k++) {
      ctx.rotate(Math.PI / 4);
      const g = ctx.createLinearGradient(0, 0, 0, -r);
      g.addColorStop(0, '#e9f1e4'); g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -r * 0.55, r * 0.2, r * 0.48, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,110,.5)'; ctx.lineWidth = Math.max(0.5, r * 0.03); ctx.stroke();
    }
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a52b';
    for (let k = 0; k < 5; k++) { const a = k * 1.256; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.13, Math.sin(a) * r * 0.13, r * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  schmarrn(x, y, s) {
    const cy = y - (0.9 + Math.sin(S.zeit * 3.6 + x * 0.02) * 0.1) * s, r = 0.6 * s;
    schatten(x, y, 0.55, s, 0.25);
    leuchten(x, cy, r * 1.8, '255,200,90', 0.5);
    /* Teller */
    ctx.fillStyle = '#c9d6e3'; ctx.beginPath(); ctx.ellipse(x, cy + r * 0.12, r, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, cy + r * 0.05, r * 0.96, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    /* Schmarrn-Stücke */
    for (const [dx, dy, w] of [[-0.4, -0.12, 0.3], [0.05, -0.2, 0.34], [0.42, -0.08, 0.28], [-0.15, 0.02, 0.3], [0.25, 0.04, 0.26], [0, -0.38, 0.24]]) {
      const g = ctx.createLinearGradient(0, cy + (dy - w * 0.4) * r, 0, cy + (dy + w * 0.4) * r);
      g.addColorStop(0, '#f3c46b'); g.addColorStop(1, '#a8621f');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x + dx * r, cy + dy * r, w * r * 0.6, w * r * 0.38, dx, 0, Math.PI * 2); ctx.fill();
    }
    /* Puderzucker und Zwetschgenröster */
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const [dx, dy] of [[-0.35, -0.22], [0.1, -0.3], [0.4, -0.16], [-0.05, -0.05], [0.25, -0.02], [0, -0.45]]) { ctx.beginPath(); ctx.arc(x + dx * r, cy + dy * r, r * 0.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7b1d4a'; ctx.beginPath(); ctx.ellipse(x + r * 0.62, cy + r * 0.08, r * 0.16, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  },
  germknoedel(x, y, s) {
    const cy = y - (1 + Math.sin(S.zeit * 3.2 + x * 0.02) * 0.12) * s, r = 0.55 * s;
    schatten(x, y, 0.55, s, 0.25);
    leuchten(x, cy, r * 2.4, '255,230,120', 0.7);
    /* Vanillesoße */
    ctx.fillStyle = '#f7d774'; ctx.beginPath(); ctx.ellipse(x, cy + r * 0.62, r * 1.15, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.4, r * 0.1, x, cy, r * 1.05);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#efe7dc'); g.addColorStop(1, '#c9bba8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
    /* Mohn und Butter */
    ctx.fillStyle = '#3b3b4a';
    for (let k = 0; k < 18; k++) { const a = k * 2.4, d = 0.15 + (k % 4) * 0.12; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d * r, cy - r * 0.45 + Math.sin(a) * d * r * 0.5, r * 0.045, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffe58a'; ctx.beginPath(); ctx.ellipse(x + r * 0.1, cy - r * 0.62, r * 0.28, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    funkeln(x, cy, r * 1.4);
  },
  klopapier(x, y, s) {
    const cy = y - (1.1 + Math.sin(S.zeit * 3 + x * 0.02) * 0.15) * s, r = 0.45 * s, h = 0.8 * s;
    schatten(x, y, 0.5, s, 0.25);
    leuchten(x, cy, s * 1.6, '255,215,60', 0.85);
    ctx.save(); ctx.translate(x, cy); ctx.rotate(Math.sin(S.zeit * 2.2) * 0.2);
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, '#b8860b'); g.addColorStop(0.35, '#ffe680'); g.addColorStop(0.6, '#f5c542'); g.addColorStop(1, '#9a6b00');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -h / 2, r * 2, h);
    ctx.beginPath(); ctx.ellipse(0, h / 2, r, r * 0.35, 0, 0, Math.PI); ctx.fill();
    /* Blatt hängt herunter */
    ctx.fillStyle = '#ffd84d'; ctx.fillRect(r * 0.2, -h * 0.1, r * 0.75, h * 0.95);
    ctx.strokeStyle = 'rgba(150,100,0,.5)'; ctx.lineWidth = Math.max(0.5, r * 0.04);
    ctx.beginPath(); ctx.moveTo(r * 0.2, h * 0.4); ctx.lineTo(r * 0.95, h * 0.4); ctx.stroke();
    /* Oberseite mit Loch */
    ctx.fillStyle = '#fff2b3'; ctx.beginPath(); ctx.ellipse(0, -h / 2, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a5a00'; ctx.beginPath(); ctx.ellipse(0, -h / 2, r * 0.32, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    funkeln(x, cy, s * 0.9);
  },
  schnaps(x, y, s) {
    const cy = y - (1 + Math.sin(S.zeit * 3.5) * 0.1) * s;
    schatten(x, y, 0.35, s, 0.25);
    const glow = ctx.createRadialGradient(x, cy, 0, x, cy, s * 1.1);
    glow.addColorStop(0, 'rgba(255,170,60,.55)'); glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, cy, s * 1.1, 0, Math.PI * 2); ctx.fill();
    const w = 0.34 * s, h = 0.6 * s;
    ctx.fillStyle = 'rgba(230,245,255,.85)';
    quad(x - w, cy - h / 2, x + w, cy - h / 2, x + w * 0.75, cy + h / 2, x - w * 0.75, cy + h / 2);
    const g = ctx.createLinearGradient(0, cy - h * 0.1, 0, cy + h / 2);
    g.addColorStop(0, '#f2a33a'); g.addColorStop(1, '#b8621b');
    ctx.fillStyle = g;
    quad(x - w * 0.92, cy - h * 0.1, x + w * 0.92, cy - h * 0.1, x + w * 0.72, cy + h * 0.45, x - w * 0.72, cy + h * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - w * 0.7, cy - h * 0.4, w * 0.18, h * 0.75);
    /* Zirbenzweig */
    ctx.strokeStyle = '#2f7a4c'; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.moveTo(x + w * 0.4, cy - h * 0.2); ctx.lineTo(x + w * 1.3, cy - h * 0.95); ctx.stroke();
    for (let k = 0; k < 4; k++) { const t = 0.25 + k * 0.2; ctx.beginPath(); ctx.moveTo(x + w * (0.4 + 0.9 * t), cy - h * (0.2 + 0.75 * t)); ctx.lineTo(x + w * (0.9 + 0.9 * t), cy - h * (0.1 + 0.75 * t)); ctx.stroke(); }
  },
  dixi(x, y, s, o, p) {
    const w = 1.2 * s, h = 2.4 * s;
    schatten(x, y, 1, s);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#1c7ed6'); g.addColorStop(1, '#0b4f8a');
    ctx.fillStyle = g;
    rundRect(x - w / 2, y - h, w, h, w * 0.08); ctx.fill();
    ctx.fillStyle = '#e7f5ff';
    rundRect(x - w * 0.58, y - h - 0.12 * s, w * 1.16, 0.22 * s, 0.08 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x - w * 0.38, y - h * 0.88, w * 0.76, h * 0.84);
    ctx.fillStyle = '#e03131';
    ctx.fillRect(x + w * 0.05, y - h * 0.52, w * 0.3, 0.16 * s);
    ctx.fillStyle = '#ffffff';
    if (s > 9) { ctx.font = `800 ${0.22 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WC', x, y - h * 0.75); }
    if (p.dz < 55) blase(x, y - h, o.weg ? 'Gabor: „Besetzt!“' : '🚽 Besetzt – Gabor', Math.max(s, 22), '#ffe8cc');
  },
  dani(x, y, s, o, p) {
    schatten(x, y, 1.6, s, 0.25);
    /* liegt quer: Körper waagrecht, Ski gekreuzt */
    ctx.strokeStyle = '#5f3dc4'; ctx.lineWidth = 0.1 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 1.8 * s, y - 0.1 * s); ctx.lineTo(x + 0.4 * s, y - 0.4 * s); ctx.moveTo(x - 1.6 * s, y - 0.45 * s); ctx.lineTo(x + 0.2 * s, y + 0.05 * s); ctx.stroke();
    ctx.fillStyle = '#343a40';
    rundRect(x - 1.2 * s, y - 0.42 * s, 0.9 * s, 0.32 * s, 0.14 * s); ctx.fill();
    const g = ctx.createLinearGradient(0, y - 0.6 * s, 0, y);
    g.addColorStop(0, '#22b8cf'); g.addColorStop(1, '#0c8599');
    ctx.fillStyle = g;
    rundRect(x - 0.4 * s, y - 0.55 * s, 1.3 * s, 0.5 * s, 0.22 * s); ctx.fill();
    ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(x + 1.15 * s, y - 0.35 * s, 0.22 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(x + 1.2 * s, y - 0.42 * s, 0.23 * s, Math.PI * 0.9, Math.PI * 1.95); ctx.fill();
    ctx.strokeStyle = '#495057'; ctx.lineWidth = Math.max(1, 0.04 * s);
    ctx.beginPath(); ctx.moveTo(x + 0.4 * s, y - 0.5 * s); ctx.lineTo(x + 1.3 * s, y - 1.2 * s); ctx.stroke();
    if (p.dz < 60) blase(x, y - 0.9 * s, o.weg ? 'Dani: „Aua!“' : 'Dani: „I lieg nur kurz!“', Math.max(s, 22));
  },
  alex(x, y, s, o, p) {
    const top = person(x, y, s, { jacke: ['#ff6b6b', '#c92a2a'], hose: '#212529', muetze: '#ffd43b' });
    /* Selfie-Stange und Handy, Blitz */
    ctx.strokeStyle = '#495057'; ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.beginPath(); ctx.moveTo(x + 0.3 * s, top + 0.6 * s); ctx.lineTo(x + 0.9 * s, top - 0.2 * s); ctx.stroke();
    ctx.fillStyle = '#212529'; ctx.fillRect(x + 0.8 * s, top - 0.42 * s, 0.22 * s, 0.34 * s);
    if (Math.sin(S.zeit * 5) > 0.85) {
      const g = ctx.createRadialGradient(x + 0.9 * s, top - 0.25 * s, 0, x + 0.9 * s, top - 0.25 * s, s * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 0.9 * s, top - 0.25 * s, s * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    if (p.dz < 60) blase(x, top - 0.5 * s, o.weg ? 'Alex: „Verwackelt!“' : 'Alex: „Selfie! 📸“', Math.max(s, 22));
  },
  matze(x, y, s, o, p) {
    const top = person(x, y, s, { jacke: ['#94d82d', '#5c940d'], hose: '#1864ab', muetze: '#e8590c' });
    /* Bierglas in der Hand */
    ctx.fillStyle = 'rgba(255,200,60,.95)'; ctx.fillRect(x - 0.62 * s, top + 0.55 * s, 0.22 * s, 0.3 * s);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 0.64 * s, top + 0.5 * s, 0.26 * s, 0.08 * s);
    if (p.dz < 70) blase(x, top - 0.2 * s, o.weg ? 'Matze: „Später halt!“' : 'Matze: „Gemma no oane?“', Math.max(s, 22), '#fff3bf');
  },
  kind(x, y, s, o) {
    const lehrer = o.nr === 0;
    person(x, y, s, lehrer ? { jacke: ['#e03131', '#a61e1e'], hose: '#212529', muetze: '#e03131' } : { jacke: ['#ffe066', '#fab005'], hose: '#495057', muetze: ['#4dabf7', '#ff8787', '#69db7c'][o.nr % 3], h: 1.15 });
    if (lehrer && !o.weg && s > 6 && s < 60) blase(x, y - 1.9 * s, 'Skischule: „Pizza!“', Math.max(s * 0.8, 20), '#ffe3e3');
  },
  raupe(x, y, s, o) {
    const w = 4.6 * s, h = 2.6 * s;
    schatten(x, y, 2.8, s, 0.3);
    /* Ketten */
    ctx.fillStyle = '#343a40';
    rundRect(x - w / 2, y - 0.9 * s, w * 0.3, 0.9 * s, 0.2 * s); ctx.fill();
    rundRect(x + w * 0.2, y - 0.9 * s, w * 0.3, 0.9 * s, 0.2 * s); ctx.fill();
    /* Schild vorn */
    ctx.fillStyle = '#adb5bd';
    quad(x - w * 0.62, y - 0.3 * s, x + w * 0.62, y - 0.3 * s, x + w * 0.56, y + 0.15 * s, x - w * 0.56, y + 0.15 * s);
    /* Aufbau */
    const g = ctx.createLinearGradient(0, y - h, 0, y - 0.6 * s);
    g.addColorStop(0, '#ff6b6b'); g.addColorStop(1, '#c92a2a');
    ctx.fillStyle = g;
    rundRect(x - w * 0.45, y - h * 0.75, w * 0.9, h * 0.5, 0.2 * s); ctx.fill();
    ctx.fillStyle = '#e03131';
    rundRect(x - w * 0.3, y - h, w * 0.6, h * 0.32, 0.2 * s); ctx.fill();
    ctx.fillStyle = '#a5d8ff';
    rundRect(x - w * 0.25, y - h * 0.95, w * 0.5, h * 0.2, 0.12 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - w * 0.22, y - h * 0.93, w * 0.12, h * 0.16);
    /* Scheinwerfer, Rundumleuchte */
    ctx.fillStyle = '#fff9db';
    ctx.beginPath(); ctx.arc(x - w * 0.33, y - h * 0.45, 0.15 * s, 0, Math.PI * 2); ctx.arc(x + w * 0.33, y - h * 0.45, 0.15 * s, 0, Math.PI * 2); ctx.fill();
    const an = Math.sin(S.zeit * 9) > 0;
    ctx.fillStyle = an ? '#ffa94d' : '#d9480f';
    ctx.beginPath(); ctx.arc(x, y - h - 0.12 * s, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    if (an) { ctx.fillStyle = 'rgba(255,169,77,.35)'; ctx.beginPath(); ctx.arc(x, y - h - 0.12 * s, 0.6 * s, 0, Math.PI * 2); ctx.fill(); }
  },
  schanze(x, y, s) {
    const w = 3.8 * s, h = 1.1 * s;
    ctx.fillStyle = 'rgba(80,120,170,.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 0.05 * s, w * 1.05, 0.35 * s, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bcd3ea');
    ctx.fillStyle = g;
    quad(x - w * 0.9, y - h, x + w * 0.9, y - h, x + w, y, x - w, y);
    ctx.fillStyle = '#e8f1fa';
    quad(x - w * 0.9, y - h, x + w * 0.9, y - h, x + w * 0.85, y - h * 1.12, x - w * 0.85, y - h * 1.12);
    ctx.fillStyle = '#f76707';
    ctx.fillRect(x - w * 0.9, y - h * 1.12, w * 1.8, Math.max(1.5, 0.08 * s));
    for (const sx of [-1, 1]) { ctx.fillStyle = '#495057'; ctx.fillRect(x + sx * w - 0.03 * s, y - 1.8 * s, 0.06 * s, 1.8 * s); ctx.fillStyle = sx < 0 ? '#f76707' : '#1971c2'; quad(x + sx * w, y - 1.8 * s, x + sx * w + sx * 0.5 * s, y - 1.6 * s, x + sx * w, y - 1.4 * s, x + sx * w, y - 1.4 * s); }
  },
  kanone(x0, y0, s, k) {
    const z = k.z, hw = breite(z);
    const p = proj(mitte(z) + k.s * (hw + 1.5), hoehe(z), z);
    if (!p) return;
    const { x, y } = p, u = p.s;
    schatten(x, y, 0.6, u);
    ctx.fillStyle = '#868e96'; ctx.fillRect(x - 0.08 * u, y - 3.2 * u, 0.16 * u, 3.2 * u);
    ctx.save(); ctx.translate(x, y - 3.3 * u); ctx.rotate(-k.s * 0.35 + (k.s < 0 ? Math.PI : 0));
    const g = ctx.createLinearGradient(0, -0.5 * u, 0, 0.5 * u);
    g.addColorStop(0, '#ffe066'); g.addColorStop(1, '#f59f00');
    ctx.fillStyle = g;
    rundRect(-1.6 * u, -0.45 * u, 1.8 * u, 0.9 * u, 0.4 * u); ctx.fill();
    ctx.fillStyle = '#343a40'; ctx.beginPath(); ctx.ellipse(-1.6 * u, 0, 0.12 * u, 0.45 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
  schild(x, y, s, o) {
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 0.06 * s, y - 2 * s, 0.12 * s, 2 * s);
    const fs = 0.32 * s;
    if (fs < 3) return;
    ctx.font = `800 ${fs}px "Trebuchet MS", sans-serif`;
    const w = ctx.measureText(o.text).width + fs;
    ctx.fillStyle = '#ffd43b'; rundRect(x - w / 2, y - 2.6 * s, w, 0.7 * s, 0.12 * s); ctx.fill();
    ctx.strokeStyle = '#212529'; ctx.lineWidth = Math.max(1, 0.05 * s); ctx.stroke();
    ctx.fillStyle = '#212529'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.text, x, y - 2.25 * s);
  },
  start(x, y, s) { banner(x, y, s, breite(9), 'START · Schönjoch 2436 m', '#2b8a3e'); },
  ziel(x, y, s) { banner(x, y, s, breite(LAENGE), 'ZIEL · Talstation Fiss', '#e03131'); },
  huette(x, y, s) {
    const w = 7 * s, h = 3.4 * s;
    schatten(x, y, 4.2, s, 0.25);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#8a5a35'); g.addColorStop(1, '#5c3a20');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#fff'; quad(x - w * 0.62, y - h, x + w * 0.62, y - h, x + w * 0.1, y - h * 1.75, x - w * 0.1, y - h * 1.75);
    ctx.fillStyle = '#ffec99';
    for (const k of [-0.3, 0.1]) ctx.fillRect(x + k * w, y - h * 0.7, w * 0.16, h * 0.3);
    if (s > 6) { ctx.fillStyle = '#fff'; ctx.font = `800 ${0.45 * s}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Hütte Schönjoch', x, y - h * 1.85); }
  },
  talstation(x, y, s) {
    const w = 22 * s, h = 7 * s;
    schatten(x, y, 12, s, 0.25);
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, '#e9ecef'); g.addColorStop(1, '#adb5bd');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#7a4f2c'; ctx.fillRect(x - w / 2, y - h * 0.45, w, h * 0.45);
    ctx.fillStyle = '#495057'; quad(x - w * 0.56, y - h, x + w * 0.56, y - h, x + w * 0.4, y - h * 1.35, x - w * 0.4, y - h * 1.35);
    ctx.fillStyle = '#fff'; quad(x - w * 0.52, y - h * 1.05, x + w * 0.52, y - h * 1.05, x + w * 0.4, y - h * 1.35, x - w * 0.4, y - h * 1.35);
    ctx.fillStyle = '#a5d8ff';
    for (let k = -4; k <= 4; k++) if (k) ctx.fillRect(x + k * w * 0.1 - w * 0.03, y - h * 0.85, w * 0.06, h * 0.25);
    /* WC-Tür: FREI! */
    ctx.fillStyle = '#2b8a3e'; ctx.fillRect(x - w * 0.05, y - h * 0.42, w * 0.1, h * 0.42);
    ctx.fillStyle = '#fff'; ctx.font = `900 ${0.9 * s}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s > 1.2) { ctx.fillText('WC', x, y - h * 0.3); ctx.fillText('FREI', x, y - h * 0.14); }
    ctx.fillStyle = '#16324f'; ctx.font = `900 ${1.3 * s}px "Trebuchet MS", sans-serif`;
    if (s > 1) ctx.fillText('TALSTATION FISS', x, y - h * 0.68);
  },
  fleck(x, y, s, f) {
    const g = f.g * (f.gross ? smooth(S.phase === 'malheur' ? S.ende / 0.8 : 1) : 1);
    if (g <= 0) return;
    ctx.fillStyle = 'rgba(70,40,15,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, 1.1 * g * s, 0.32 * g * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a1e';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.85 * g * s, 0.26 * g * s, 0, 0, Math.PI * 2);
    for (const [dx, dy, r] of [[-0.6, 0.05, 0.35], [0.55, -0.04, 0.4], [0.15, 0.12, 0.32], [-0.25, -0.1, 0.3]]) {
      ctx.moveTo(x + (dx + r) * g * s, y + dy * g * s);
      ctx.ellipse(x + dx * g * s, y + dy * g * s, r * g * s, r * 0.32 * g * s, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#5a3412';
    ctx.beginPath(); ctx.ellipse(x - 0.2 * g * s, y + 0.02 * s, 0.4 * g * s, 0.1 * g * s, 0, 0, Math.PI * 2); ctx.fill();
    /* Duftlinien */
    if (f.gross) {
      ctx.strokeStyle = 'rgba(110,140,60,.7)'; ctx.lineWidth = Math.max(1.5, 0.06 * s);
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.1) ctx.lineTo(x + k * 0.6 * s + Math.sin(t * 9 + S.zeit * 4 + k) * 0.12 * s, y - (0.3 + t * 1.3) * s * g / 2);
        ctx.stroke();
      }
    }
  },
};

function banner(x, y, s, hw, text, farbe) {
  const l = x - hw * s, r = x + hw * s, top = y - 3.4 * s;
  ctx.fillStyle = '#495057';
  ctx.fillRect(l - 0.1 * s, top, 0.2 * s, 3.4 * s);
  ctx.fillRect(r - 0.1 * s, top, 0.2 * s, 3.4 * s);
  const g = ctx.createLinearGradient(0, top, 0, top + 0.9 * s);
  g.addColorStop(0, farbe); g.addColorStop(1, '#16324f');
  ctx.fillStyle = g;
  ctx.fillRect(l, top, r - l, 0.9 * s);
  const fs = 0.6 * s;
  if (fs < 4) return;
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${fs}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, top + 0.47 * s, r - l - s);
}

function nebel(k) {
  if (Math.abs(k.z - S.z) > SICHT) return;
  const hw = breite(k.z);
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const t = ((i * 0.137 + S.zeit * 0.35) % 1);
    const z = k.z - 4 + t * 30;
    const x = k.s * (hw + 1.5 - t * 11) + Math.sin(i * 3.1) * 1.2;
    const p = proj(mitte(z) + x, hoehe(z) + 2.5 - t * 1.5 + Math.sin(i) * 0.4, z);
    if (!p || p.dz < 1.5) continue;
    const r = (1 + t * 1.8) * p.s;
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - t) * (p.dz < 4 ? p.dz / 4 : 1)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (S.kanone) {
    ctx.fillStyle = 'rgba(200,235,255,.25)';
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

/* Kasper: von hinten, Kasperl-Mütze mit Glöckchen */
function kasper() {
  const wx = mitte(S.z) + S.x;
  const boden = proj(wx, hoehe(S.z), S.z);
  if (!boden) return;
  const p = proj(wx, hoehe(S.z) + S.luft, S.z);
  const s = p.s;
  /* Schatten am Boden */
  schatten(boden.x, boden.y, 0.75 / (1 + S.luft * 0.3), s, 0.28);
  ctx.save();
  ctx.translate(p.x, p.y);
  let lean = clamp(S.vx * 0.035, -0.35, 0.35);
  if (S.sturz > 0) lean = 1.25 * Math.sin(Math.min(1, (1.4 - S.sturz) * 6) * Math.PI / 2) * (S.x >= 0 ? 1 : -1);
  if (S.phase === 'malheur') lean = 0;
  ctx.rotate(lean);
  const zitter = S.kneift || S.druck > 85 ? Math.sin(S.zeit * 60) * s * 0.02 : 0;
  ctx.translate(zitter, 0);
  const hock = S.kneift ? 0.86 : S.luft > 0 ? 0.92 : 1;
  const u = s;

  /* Boost-Wolken hinter Kasper (also zur Kamera hin) */
  if (S.boost > 0) {
    for (let i = 0; i < 6; i++) {
      const t = ((S.zeit * 3 + i / 6) % 1);
      ctx.fillStyle = `rgba(190,205,170,${0.6 * (1 - t)})`;
      ctx.beginPath(); ctx.arc((Math.sin(i * 2.3) * 0.25) * u, (-0.75 + t * 0.9) * u, (0.18 + t * 0.5) * u, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* Ski: zwei Latten nach vorn (zum Horizont) */
  const skiSpreiz = S.kneift ? 0.12 : 0.2;
  for (const sx of [-1, 1]) {
    const g = ctx.createLinearGradient(0, -0.6 * u, 0, 0.25 * u);
    g.addColorStop(0, '#ff922b'); g.addColorStop(1, '#d9480f');
    ctx.fillStyle = g;
    const spitze = sx * (skiSpreiz + 0.06) * u + S.vx * 0.012 * u;
    quad(sx * skiSpreiz * u - 0.075 * u, 0.3 * u, sx * skiSpreiz * u + 0.075 * u, 0.3 * u, spitze + 0.04 * u, -0.62 * u, spitze - 0.04 * u, -0.62 * u);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    quad(sx * skiSpreiz * u - 0.02 * u, 0.28 * u, sx * skiSpreiz * u + 0.01 * u, 0.28 * u, spitze + 0.005 * u, -0.6 * u, spitze - 0.01 * u, -0.6 * u);
  }
  /* Beine (beim Kneifen x-förmig) */
  const knie = S.kneift ? 0.05 : 0.17;
  ctx.strokeStyle = '#1c3d6e'; ctx.lineCap = 'round'; ctx.lineWidth = 0.2 * u;
  ctx.beginPath();
  ctx.moveTo(-skiSpreiz * u, 0); ctx.lineTo(-knie * u, -0.45 * u * hock); ctx.lineTo(-0.13 * u, -0.85 * u * hock);
  ctx.moveTo(skiSpreiz * u, 0); ctx.lineTo(knie * u, -0.45 * u * hock); ctx.lineTo(0.13 * u, -0.85 * u * hock);
  ctx.stroke();
  /* Hosenboden */
  const po = -0.9 * u * hock;
  ctx.fillStyle = '#244a85';
  ctx.beginPath(); ctx.ellipse(-0.12 * u, po, 0.17 * u, 0.15 * u, 0, 0, Math.PI * 2); ctx.ellipse(0.12 * u, po, 0.17 * u, 0.15 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#132c55'; ctx.lineWidth = Math.max(1, 0.025 * u);
  ctx.beginPath(); ctx.moveTo(0, po - 0.12 * u); ctx.lineTo(0, po + 0.1 * u); ctx.stroke();
  if (S.kneift) {
    /* Anspannung: kleine Striche */
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = Math.max(1.5, 0.035 * u);
    ctx.beginPath();
    for (const sx of [-1, 1]) { ctx.moveTo(sx * 0.36 * u, po - 0.08 * u); ctx.lineTo(sx * 0.48 * u, po - 0.14 * u); ctx.moveTo(sx * 0.37 * u, po + 0.04 * u); ctx.lineTo(sx * 0.5 * u, po + 0.04 * u); }
    ctx.stroke();
  }
  /* Jacke */
  const jt = po - 0.72 * u * hock;
  const g = ctx.createLinearGradient(-0.35 * u, 0, 0.35 * u, 0);
  g.addColorStop(0, '#ff4d4d'); g.addColorStop(0.55, '#e03131'); g.addColorStop(1, '#a61e1e');
  ctx.fillStyle = g;
  rundRect(-0.3 * u, jt, 0.6 * u, 0.75 * u * hock, 0.15 * u); ctx.fill();
  /* gelbe Rauten wie beim Kasperl */
  ctx.fillStyle = '#ffd43b';
  for (const [dx, dy] of [[-0.12, 0.2], [0.12, 0.2], [0, 0.45]]) {
    const cx = dx * u, cy = jt + dy * u * hock, r = 0.07 * u;
    quad(cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy);
  }
  ctx.fillStyle = '#ffd43b'; ctx.fillRect(-0.3 * u, jt + 0.62 * u * hock, 0.6 * u, 0.07 * u);
  /* Arme und Stöcke */
  ctx.strokeStyle = '#c92a2a'; ctx.lineWidth = 0.13 * u;
  const arm = S.kneift ? 0.38 : 0.46;
  ctx.beginPath();
  ctx.moveTo(-0.26 * u, jt + 0.12 * u); ctx.lineTo(-arm * u, jt + 0.5 * u);
  ctx.moveTo(0.26 * u, jt + 0.12 * u); ctx.lineTo(arm * u, jt + 0.5 * u);
  ctx.stroke();
  ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = Math.max(1, 0.035 * u);
  ctx.beginPath();
  ctx.moveTo(-arm * u, jt + 0.5 * u); ctx.lineTo(-(arm + 0.25) * u, 0.15 * u);
  ctx.moveTo(arm * u, jt + 0.5 * u); ctx.lineTo((arm + 0.25) * u, 0.15 * u);
  ctx.stroke();
  /* Kopf (von hinten) mit Ohren */
  const kopf = jt - 0.17 * u;
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(-0.17 * u, kopf + 0.03 * u, 0.05 * u, 0, Math.PI * 2); ctx.arc(0.17 * u, kopf + 0.03 * u, 0.05 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a4a1e';
  ctx.beginPath(); ctx.arc(0, kopf, 0.17 * u, 0, Math.PI * 2); ctx.fill();
  /* Kasperl-Mütze: rot, spitz, im Fahrtwind nach hinten gebogen, gelbes Glöckchen */
  const wehen = Math.sin(S.zeit * 7) * 0.06 + clamp(S.v / 30, 0, 1) * 0.25;
  ctx.fillStyle = '#e03131';
  ctx.beginPath();
  ctx.moveTo(-0.21 * u, kopf - 0.02 * u);
  ctx.quadraticCurveTo(-0.14 * u, kopf - 0.62 * u, (0.3 + wehen) * u, kopf - (0.72 - wehen) * u);
  ctx.quadraticCurveTo(0.08 * u, kopf - 0.3 * u, 0.21 * u, kopf - 0.02 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff3bf';
  rundRect(-0.22 * u, kopf - 0.07 * u, 0.44 * u, 0.1 * u, 0.05 * u); ctx.fill();
  const gl = ctx.createRadialGradient((0.28 + wehen) * u, kopf - (0.74 - wehen) * u, 0, (0.3 + wehen) * u, kopf - (0.72 - wehen) * u, 0.09 * u);
  gl.addColorStop(0, '#fff9db'); gl.addColorStop(1, '#f59f00');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.arc((0.3 + wehen) * u, kopf - (0.72 - wehen) * u, 0.085 * u, 0, Math.PI * 2); ctx.fill();
  /* Schweißtropfen bei hohem Druck */
  if (S.druck > 75) {
    ctx.fillStyle = '#74c0fc';
    for (let i = 0; i < 2; i++) {
      const t = (S.zeit * 1.5 + i * 0.5) % 1;
      ctx.beginPath(); ctx.arc((i ? 0.28 : -0.3) * u, kopf + t * 0.3 * u, 0.035 * u, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (S.sturz > 0) {
    ctx.fillStyle = '#ffd43b';
    for (let i = 0; i < 3; i++) { const a = S.zeit * 5 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.3 * u, kopf - 0.3 * u + Math.sin(a) * 0.08 * u, 0.05 * u, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();

  /* Sprechblase */
  const kopfY = p.y - 2.25 * s;
  if (S.ruf && S.ruf.bis > S.zeit) blase(p.x, kopfY, S.ruf.text, clamp(s * 0.4, 16, 30), '#fff');
  else if (S.phase === 'play' && S.druck > 72) blase(p.x, kopfY, ['Grummel …', 'Oha!', 'Uiuiui!', 'Gleich …!', 'Schneller!'][Math.floor(S.zeit / 2.5) % 5], clamp(s * 0.4, 16, 30), '#ffe8cc');
}

let rechtsRand = 0;
let balkenSichtbar = true;
let balkenTakt = 0;   // Abstand zur Notch (aus --gt-right), bei jeder Größenänderung neu
/* Strecke als Balken am rechten Rand: Schönjoch oben, Fiss unten */
function streckenBalken(W, H) {
  if (S.phase === 'menu') return;
  /* Vorschaubild (tools/thumbnail.js) blendet die Anzeigen aus – dann auch den Balken; selten prüfen */
  if (++balkenTakt % 30 === 1) balkenSichtbar = getComputedStyle(meter).visibility !== 'hidden';
  if (!balkenSichtbar) return;
  const top = 76, bottom = H - (matchMedia('(pointer: coarse)').matches ? 132 : 40);
  if (bottom - top < 60) return;
  const x = W - 22 - rechtsRand;
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  rundRect(x - 7, top, 14, bottom - top, 7); ctx.fill();
  const t = clamp(S.z / LAENGE, 0, 1);
  ctx.fillStyle = 'rgba(59,143,216,.8)';
  rundRect(x - 4, top + 3, 8, Math.max(8, (bottom - top - 6) * t), 4); ctx.fill();
  ctx.fillStyle = '#e03131';
  ctx.beginPath(); ctx.arc(x, top + 3 + (bottom - top - 6) * t, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.font = '800 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#16324f';
  ctx.fillText('🚽', x, bottom + 12);
}

/* ---------- Anzeigen ---------- */
const hudAlt = {};
function setText(id, text) { if (hudAlt[id] !== text) { hudAlt[id] = text; $(id).textContent = text; } }
const meter = $('meter');
const meterFill = meter.querySelector('.m-fill');
function zeigeHud(sofort) {
  setText('hud-knoedel', `⭐ ${sammelPunkte()}`);
  setText('hud-zeit', `⏱ ${fmtZeit(S.t)}`);
  setText('hud-weg', `🏁 ${Math.max(0, Math.ceil(LAENGE - S.z))} m`);
  const d = Math.floor(S.druck);
  if (sofort || hudAlt.druck !== d) {
    hudAlt.druck = d;
    meterFill.style.height = `${d}%`;
    meterFill.style.setProperty('--rohr', `${meter.querySelector('.m-rohr').clientHeight}px`);
    meter.querySelector('.m-wert').textContent = `${d} %`;
    meter.setAttribute('aria-valuenow', String(d));
    meter.querySelector('.m-face').textContent = d >= 100 ? '💩' : d >= 90 ? '🥵' : d >= 75 ? '😰' : d >= 55 ? '😬' : d >= 35 ? '😐' : '😊';
    meter.classList.toggle('kritisch', d >= 85);
  }
}

/* ---------- Ablauf ---------- */
function steuerung(an) { $('steuerung-links').hidden = $('steuerung-rechts').hidden = !an; }

function setPhase(phase) {
  S.phase = phase;
  kit.setState(phase === 'menu' ? 'menu' : phase === 'ende' ? 'end' : 'play');
  loop.setMaxFps(phase === 'menu' || phase === 'ende' ? 15 : 0);
  $('hud').hidden = meter.hidden = phase === 'menu' || phase === 'ende';
  steuerung(phase === 'play');
}

function starten() {
  neueRunde();
  input.clear();
  kit.show(null);
  document.activeElement?.blur?.();   // sonst landet die Leertaste (Kneifen) beim versteckten Knopf
  setPhase('play');
  zeigeHud(true);
  ruf('Grummel … schnell zur Talstation!', 2.5);
}

function zeigeMalheur() {
  if (S.phase !== 'malheur') return;
  $('malheur-text').textContent = `Nur noch ${Math.max(0, Math.ceil(LAENGE - S.z))} m bis zur Talstation in Fiss. Jetzt ist ein brauner Fleck im Schnee.`;
  const e = S.ergebnis;
  const tab = $('malheur-abrechnung');
  tab.innerHTML = '';
  for (const [text, punkte] of e.zeilen) {
    const tr = tab.insertRow();
    tr.insertCell().textContent = text;
    tr.insertCell().textContent = punkte > 0 ? `+${punkte}` : String(punkte);
  }
  const sum = tab.insertRow();
  sum.className = 'summe';
  sum.insertCell().textContent = '🏵️ Gesamt';
  const c = sum.insertCell();
  c.id = 'malheur-gesamt';
  c.textContent = String(e.gesamt);
  setPhase('ende');
  S.phase = 'ende';
  S.vorbei = 'malheur';
  kit.show('malheur');
  zeigeRekord(e.gesamt, 'malheur-rekord', 'Gespeichert. Mit Ankunft gibt\'s Zeit- und 99-%-Bonus!');
}

async function zeigeRekord(gesamt, id, sonst) {
  $(id).textContent = sonst || '';
  try {
    const alle = await storage.getScores();
    const best = Math.max(gesamt, ...alle.map((x) => x.points));
    const rekord = gesamt >= best && !sonst ? '🏆 Dein Rekord! Platz 1 der Fisser-Flitzer trägt die Goldene Rosette.' : `Dein Rekord: ${best} Punkte`;
    $(id).textContent = sonst ? `${sonst} ${rekord}` : rekord;
  } catch { /* ohne Rekord-Anzeige */ }
}

async function zeigeEnde() {
  if (S.phase !== 'ziel') return;
  const e = S.ergebnis;
  $('ende-titel').textContent = e.titel;
  const tab = $('abrechnung');
  tab.innerHTML = '';
  for (const [text, punkte] of e.zeilen) {
    const tr = tab.insertRow();
    tr.insertCell().textContent = text;
    tr.insertCell().textContent = punkte > 0 ? `+${punkte}` : String(punkte);
  }
  const sum = tab.insertRow();
  sum.className = 'summe';
  sum.insertCell().textContent = '🏵️ Gesamt';
  const c = sum.insertCell();
  c.id = 'gesamt';
  c.textContent = String(e.gesamt);
  setPhase('ende');
  S.vorbei = 'ziel';
  kit.show('ende');
  zeigeRekord(e.gesamt, 'rekord');
}

/* ---------- Eingaben ---------- */
input.touchButtons($('steuerung-links'), [{ action: 'links', label: '◀', title: 'nach links' }, { action: 'rechts', label: '▶', title: 'nach rechts' }]);
const [bBoost, bKneifen] = input.touchButtons($('steuerung-rechts'), [{ action: 'hoch', label: '💨', title: 'Rückstoß-Boost' }, { action: 'aktion', label: '🍑', title: 'Zusammenkneifen' }]);
bBoost.classList.add('rk-boost');
bKneifen.classList.add('rk-kneifen');
input.on('aktion', () => { if (S.phase === 'menu' && !document.querySelector('[data-screen="start"]').hidden) starten(); });
document.querySelector('[data-action="start"]').addEventListener('click', starten);
document.querySelectorAll('[data-action="nochmal"]').forEach((b) => b.addEventListener('click', starten));

function groesse() {
  view = fitCanvas(canvas);
  kamera();
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;width:var(--gt-right)';
  document.body.appendChild(probe);
  rechtsRand = Math.max(0, probe.getBoundingClientRect().width - 10);
  probe.remove();
  zeigeHud(true);
}
kit.viewport.onResize(() => { groesse(); loop.renderOnce(); });

/* Zugang für den Durchspiel-Test (tools/spieltests/rosetten-kasper.js) – ändert nichts am Spiel */
window.SPIEL = {
  loop,
  LAENGE,
  PUNKTE,
  SAMMEL,
  MALHEUR_MAX,
  state: () => ({
    phase: S.phase, vorbei: S.vorbei, z: S.z, x: S.x, v: S.v, druck: S.druck, knoedel: S.knoedel, gesammelt: { ...S.gesammelt }, sammelPunkte: sammelPunkte(), pannen: S.pannen,
    spruenge: S.spruenge, stuerze: S.stuerze, sturz: S.sturz, halt: S.halt, boost: S.boost, wackel: S.wackel, luft: S.luft,
    kneift: S.kneift, kanone: S.kanone, buckel: S.buckel, t: S.t, ruf: S.ruf && S.ruf.text, ergebnis: S.ergebnis,
  }),
  objekte: (art) => OBJ.filter((o) => o.art === art).map((o) => ({ z: o.z, x: o.x, weg: o.weg })),
  kanonen: () => KANONEN.map((k) => ({ ...k, rand: breite(k.z) })),
  buckel: BUCKEL,
  /* Kasper an eine Stelle setzen (z: Meter, x: seitlich) */
  setze(z, x = S.x) { S.z = z; S.x = x; S.vx = 0; for (const o of OBJ) o.rel = o.z - z; },
  setDruck(d) { S.druck = d; },
  risiko(r) { S.risiko = r; },
  /* Seitlich fest halten (Test lenkt nicht selbst) */
  halteX(x) { S.x = x; S.vx = 0; },
};

neueRunde();
groesse();
setPhase('menu');
kit.show('start');
loop.start();
