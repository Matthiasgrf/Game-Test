/* Labyrinth-Abenteuer – Tiere durch 5 Labyrinthe führen und unterwegs Sterne sammeln (ab 5 Jahren).
   Spielregeln wie in der früheren React-Fassung: drei Stufen mit je 5 Labyrinthen, in jedem 3 Sterne,
   jedes Labyrinth wird neu erzeugt (maze.js).
   Ergebnis für die Bestenliste: Variante = Stufe, Punkte = Sterne (maxPoints = mögliche Sterne), Zeit ohne Pausen.
   Steuerung: Pfeiltasten oder WASD (gedrückt halten = weiterlaufen), Figur mit Finger oder Maus durch die Gänge
   ziehen, Steuerkreuz (gedrückt halten = weiterlaufen).
   Darstellung: Die Szene füllt den Bildschirm, das quadratische Labyrinth liegt so groß wie möglich darin –
   je nach Bildschirm mit Anzeigen und Steuerkreuz darüber/darunter (hoch) oder links/rechts daneben (quer).
   Für Tests: window.SPIEL (Zustand, Weg zu allen Sternen und zum Ziel, Schritt gehen, Position einer Zelle). */
import { startKit, board } from '../shared/kit/kit.js';
import { N, E, S, W, DX, DY, DIRS, canMove, generateMaze, idx } from './maze.js';

const MODES = [
  { id: 'leicht', label: 'Leicht', emoji: '🐣', sizes: [4, 5, 5, 6, 6] },
  { id: 'mittel', label: 'Mittel', emoji: '🦊', sizes: [5, 6, 7, 7, 8] },
  { id: 'knifflig', label: 'Knifflig', emoji: '🦁', sizes: [7, 8, 9, 10, 11] },
];
const THEMES = [
  { hero: '🐭', goal: '🧀', task: 'Bring die Maus zum Käse!', floor: '#fff8e1', wall: '#e8590c', trail: '#ffd8a8' },
  { hero: '🐰', goal: '🥕', task: 'Der Hase hat Hunger auf eine Karotte!', floor: '#ebfbee', wall: '#2b8a3e', trail: '#b2f2bb' },
  { hero: '🐶', goal: '🦴', task: 'Hilf dem Hund, seinen Knochen zu finden!', floor: '#e7f5ff', wall: '#1971c2', trail: '#a5d8ff' },
  { hero: '🐝', goal: '🌻', task: 'Die Biene fliegt zur Blume!', floor: '#fff9db', wall: '#e67700', trail: '#ffec99' },
  { hero: '🐧', goal: '🐟', task: 'Der Pinguin möchte einen Fisch!', floor: '#f3f0ff', wall: '#6741d9', trail: '#d0bfff' },
];
const PRAISE = ['Super!', 'Toll gemacht!', 'Klasse!', 'Wow!', 'Spitze!', 'Prima!'];
const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🍬', '🌟'];
const CELL = 10;               // SVG-Einheiten pro Zelle
const REPEAT_MS = 220;         // Steuerkreuz gedrückt halten: alle 220 ms ein Schritt
const KEYS = { ArrowUp: N, ArrowRight: E, ArrowDown: S, ArrowLeft: W, KeyW: N, KeyD: E, KeyS: S, KeyA: W };
const NAMES = { [N]: 'N', [E]: 'E', [S]: 'S', [W]: 'W' };
const BY_NAME = { N, E, S, W };

const $ = (id) => document.getElementById(id);
const better = (a, b) => !b || a.stars > b.stars || (a.stars === b.stars && a.seconds < b.seconds);
const formatTime = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);
const sounds = {
  step: () => kit.sound.beep(520, 0.06, 'triangle', 0.05),
  bump: () => kit.sound.beep(140, 0.12, 'square', 0.06),
  star: () => { kit.sound.beep(880, 0.12, 'sine', 0.15); kit.sound.beep(1320, 0.2, 'sine', 0.15, 0.08); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => kit.sound.beep(f, 0.3, 'triangle', 0.12, i * 0.12)),
  trophy: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => kit.sound.beep(f, 0.35, 'triangle', 0.12, i * 0.13)),
};

const brett = $('brett'), hud = $('hud'), aufgabe = $('aufgabe'), kreuz = $('kreuz');

let phase = 'menu';            // menu | play | level | fertig
let mode = MODES[0];
let level = 0;
let theme = THEMES[0];
let play = null;               // { maze, pos, visited, got, won }
let starsTotal = 0;
let maxStars = 0;
let startedAt = 0, pausedAt = 0, pausedTotal = 0;
let paused = false;
let dragging = false;
let repeat = 0;
let finishTimer = 0;
const best = {};               // Stufe → { stars, seconds } (eigene Bestleistung)

const kit = startKit({
  key: 'labyrinth',
  orientation: 'any',
  pause() {
    paused = true;
    pausedAt = Date.now();
    stopRepeat();
    dragging = false;
    document.body.classList.add('pausiert');
  },
  resume() { endPause(); },
  pauseButtons: [{ label: '↩ Andere Stufe', action: () => goMenu() }],
});

function endPause() {
  if (!paused) return;
  paused = false;
  pausedTotal += Date.now() - pausedAt;
  document.body.classList.remove('pausiert');
}
/* Spielzeit in Sekunden, ohne Pausen */
const elapsed = () => ((paused ? pausedAt : Date.now()) - startedAt - pausedTotal) / 1000;

/* ---------- Start-Bildschirm mit den drei Stufen ---------- */
MODES.forEach((m, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'stufe';
  b.dataset.mode = m.id;
  if (i === 0) b.setAttribute('autofocus', '');
  b.innerHTML = `<span class="e" aria-hidden="true">${m.emoji}</span>${m.label}<small hidden></small>`;
  b.addEventListener('click', () => startChallenge(m));
  $('stufen').appendChild(b);
});
function showRecords() {
  document.querySelectorAll('.stufe').forEach((b) => {
    const r = best[b.dataset.mode];
    const small = b.querySelector('small');
    small.hidden = !r;
    if (r) small.textContent = `Rekord: ⭐ ${r.stars}`;
  });
}
/* Eigene Bestleistungen je Stufe (in der App aus der Datenbank) */
kit.storage.getScores().then((list) => {
  for (const r of list) {
    const mine = { stars: r.points, seconds: r.seconds ?? 0 };
    if (r.variant && better(mine, best[r.variant])) best[r.variant] = mine;
  }
  showRecords();
}).catch(() => {});

function goMenu() {
  clearTimeout(finishTimer);
  stopRepeat();
  endPause();
  phase = 'menu';
  play = null;
  showPlayUi(false);
  showRecords();
  kit.setState('menu');
  kit.show('menu');
}

function showPlayUi(on) {
  for (const e of [brett, hud, aufgabe, kreuz]) e.hidden = !on;
}

/* ---------- Ablauf ---------- */
function startChallenge(m) {
  mode = m;
  level = 0;
  starsTotal = 0;
  maxStars = 0;
  startedAt = Date.now();
  pausedTotal = 0;
  endPause();
  kit.setState('play');
  startLevel();
}

function startLevel() {
  clearTimeout(finishTimer);
  const size = mode.sizes[level];
  const maze = generateMaze(size, size, 3);
  const visited = new Array(size * size).fill(false);
  visited[idx(maze, maze.start.x, maze.start.y)] = true;
  play = { maze, pos: { ...maze.start }, visited, got: maze.stars.map(() => false), won: false };
  theme = THEMES[level % THEMES.length];
  phase = 'play';
  const root = document.documentElement.style;
  root.setProperty('--boden', theme.floor);
  root.setProperty('--wand', theme.wall);
  root.setProperty('--spur', theme.trail);
  aufgabe.innerHTML = `${theme.task} <span class="weg">${theme.hero} ➜ ${theme.goal}</span>`;
  buildBoard();
  showLevels();
  showStars();
  showPlayUi(true);
  kit.show(null);
  layout();
}

function finishLevel() {
  const got = play.got.filter(Boolean).length;
  starsTotal += got;
  maxStars += play.maze.stars.length;
  konfetti();
  if (level + 1 >= mode.sizes.length) {
    const seconds = Math.round(elapsed());
    const mine = { stars: starsTotal, seconds };
    const record = better(mine, best[mode.id]);
    if (record) best[mode.id] = mine;
    kit.storage.saveScore({ variant: mode.id, points: starsTotal, maxPoints: maxStars, seconds });
    sounds.trophy();
    phase = 'fertig';
    endPause();
    $('ergebnis').innerHTML = `Du hast <b>${starsTotal}</b> von ${maxStars} ⭐ gesammelt.`;
    $('zeit').textContent = `Zeit: ${formatTime(seconds)}`;
    $('rekord').hidden = !record;
    kit.setState('end');
    kit.show('fertig');
  } else {
    sounds.win();
    phase = 'level';
    $('lobTiere').textContent = theme.hero + theme.goal;
    $('lob').textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('lobSterne').innerHTML = play.got.map((g) => `<span class="${g ? 'an' : ''}">⭐</span>`).join('');
    kit.show('level');
  }
}

function nextLevel() {
  if (phase !== 'level' || paused) return;
  level++;
  startLevel();
}

document.querySelector('[data-action="weiter"]').addEventListener('click', nextLevel);
document.querySelector('[data-action="nochmal"]').addEventListener('click', () => startChallenge(mode));
document.querySelector('[data-action="stufe"]').addEventListener('click', goMenu);
kit.input.on('aktion', () => { if (phase === 'level') nextLevel(); });

/* ---------- Spielbrett (SVG) ---------- */
function wallPath(maze) {
  const { w, h } = maze;
  const parts = [`M0 0H${w * CELL}V${h * CELL}H0Z`];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = maze.open[idx(maze, x, y)];
      const X = x * CELL, Y = y * CELL;
      if (x < w - 1 && !(o & E)) parts.push(`M${X + CELL} ${Y}V${Y + CELL}`);
      if (y < h - 1 && !(o & S)) parts.push(`M${X} ${Y + CELL}H${X + CELL}`);
    }
  }
  return parts.join('');
}

const center = (c) => [c.x * CELL + CELL / 2, c.y * CELL + CELL / 2];

function buildBoard() {
  const { maze } = play;
  const w = maze.w * CELL, h = maze.h * CELL;
  const walls = wallPath(maze);
  let tiles = '';
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) if ((x + y) % 2 === 0) tiles += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}"/>`;
  }
  const stars = maze.stars.map((s, i) => { const [x, y] = center(s); return `<text class="stern" data-i="${i}" x="${x}" y="${y}">⭐</text>`; }).join('');
  const [gx, gy] = center(maze.goal);
  brett.innerHTML = `
    <svg viewBox="-1 -1 ${w + 2} ${h + 2}" role="img" aria-label="Labyrinth">
      <defs>
        <linearGradient id="bodenVerlauf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${theme.floor}"/>
        </linearGradient>
        <radialGradient id="zielLicht">
          <stop offset="0" stop-color="${theme.trail}"/><stop offset="1" stop-color="${theme.trail}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${w}" height="${h}" rx="2" fill="url(#bodenVerlauf)"/>
      <g fill="${theme.floor}" opacity=".75">${tiles}</g>
      <circle class="licht" cx="${gx}" cy="${gy}" r="${CELL * 0.6}" fill="url(#zielLicht)"/>
      <g id="spur" fill="${theme.trail}"></g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${walls}" stroke="rgba(0,0,0,.22)" stroke-width="1.9" transform="translate(.35 .6)"/>
        <path d="${walls}" stroke="${theme.wall}" stroke-width="1.6"/>
        <path d="${walls}" stroke="rgba(255,255,255,.38)" stroke-width=".35" transform="translate(-.18 -.22)"/>
      </g>
      <g id="sternbild">${stars}</g>
      <text class="ziel" x="${gx}" y="${gy}">${theme.goal}</text>
      <g id="held">
        <ellipse cx="${CELL / 2}" cy="${CELL * 0.84}" rx="${CELL * 0.3}" ry="${CELL * 0.09}" fill="rgba(0,0,0,.2)"/>
        <text x="${CELL / 2}" y="${CELL / 2}">${theme.hero}</text>
      </g>
    </svg>`;
  play.visited.forEach((v, i) => { if (v) addTrail({ x: i % maze.w, y: Math.floor(i / maze.w) }); });
  placeHero();
}

function addTrail(c) {
  const [x, y] = center(c);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', x);
  dot.setAttribute('cy', y);
  dot.setAttribute('r', '1.3');
  $('spur').appendChild(dot);
}

function placeHero() {
  $('held').style.transform = `translate(${play.pos.x * CELL}px, ${play.pos.y * CELL}px)`;
}

function bump() {
  const t = $('held').querySelector('text');
  t.classList.remove('stoss');
  void t.getBoundingClientRect(); // Animation neu starten
  t.classList.add('stoss');
}

function showLevels() {
  $('level').setAttribute('aria-label', `Labyrinth ${level + 1} von ${mode.sizes.length}`);
  $('level').innerHTML = mode.sizes.map((_, i) =>
    `<span class="${i < level ? 'fertig' : i === level ? 'jetzt' : ''}">${i < level ? '✔' : i + 1}</span>`).join('');
}

function showStars() {
  const n = play.got.filter(Boolean).length;
  $('sterne').setAttribute('aria-label', `${n} von ${play.maze.stars.length} Sternen`);
  $('sterne').innerHTML = play.got.map((g) => `<span class="${g ? 'an' : ''}">⭐</span>`).join('');
}

/* ---------- Bewegen ---------- */
/* Einen Schritt gehen. true = die Figur hat sich bewegt. quietBump: gegen die Wand ohne Ton (Ziehen, Halten) */
function move(d, quietBump = false) {
  if (!play || play.won || phase !== 'play' || paused) return false;
  const { maze } = play;
  if (!canMove(maze, play.pos, d)) {
    if (!quietBump) { sounds.bump(); bump(); }
    return false;
  }
  const pos = { x: play.pos.x + DX[d], y: play.pos.y + DY[d] };
  play.pos = pos;
  const i = idx(maze, pos.x, pos.y);
  if (!play.visited[i]) { play.visited[i] = true; addTrail(pos); }
  const si = maze.stars.findIndex((s, k) => !play.got[k] && s.x === pos.x && s.y === pos.y);
  if (si >= 0) {
    play.got[si] = true;
    brett.querySelector(`.stern[data-i="${si}"]`)?.remove();
    showStars();
    sounds.star();
  } else {
    sounds.step();
  }
  placeHero();
  if (pos.x === maze.goal.x && pos.y === maze.goal.y) {
    play.won = true;
    stopRepeat();
    dragging = false;
    finishTimer = setTimeout(finishLevel, 450);
  }
  return true;
}

/* Tastatur: gedrückt halten = weiterlaufen (Wiederholung der Taste) */
addEventListener('keydown', (e) => {
  const d = KEYS[e.code];
  if (d === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (phase === 'play') move(d);
});

/* Finger oder Maus: die Figur folgt durch die Gänge */
function cellAt(clientX, clientY) {
  const svg = brett.querySelector('svg');
  const r = svg.getBoundingClientRect();
  const { w, h } = play.maze;
  const ux = ((clientX - r.left) / r.width) * (w * CELL + 2) - 1;
  const uy = ((clientY - r.top) / r.height) * (h * CELL + 2) - 1;
  return { x: Math.floor(ux / CELL), y: Math.floor(uy / CELL) };
}

function walkToward(clientX, clientY) {
  if (!play) return;
  const { maze } = play;
  const t = cellAt(clientX, clientY);
  if (t.x < 0 || t.y < 0 || t.x >= maze.w || t.y >= maze.h) return;
  for (let i = 0; i < maze.w + maze.h; i++) {
    const dx = t.x - play.pos.x, dy = t.y - play.pos.y;
    if (dx === 0 && dy === 0) break;
    const hd = dx > 0 ? E : dx < 0 ? W : null;
    const vd = dy > 0 ? S : dy < 0 ? N : null;
    const order = Math.abs(dx) >= Math.abs(dy) ? [hd, vd] : [vd, hd];
    if (!order.some((d) => d !== null && move(d, true))) break;
  }
}

brett.addEventListener('pointerdown', (e) => {
  if (phase !== 'play' || paused) return;
  e.preventDefault();
  dragging = true;
  try { brett.setPointerCapture(e.pointerId); } catch { /* kein echter Zeiger (Test) */ }
  walkToward(e.clientX, e.clientY);
});
brett.addEventListener('pointermove', (e) => { if (dragging) walkToward(e.clientX, e.clientY); });
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) brett.addEventListener(type, () => { dragging = false; });

/* Steuerkreuz: gedrückt halten = weiterlaufen */
function stopRepeat() {
  clearInterval(repeat);
  repeat = 0;
  kreuz.querySelectorAll('.gt-on').forEach((b) => b.classList.remove('gt-on'));
}
kreuz.querySelectorAll('button').forEach((b) => {
  const d = BY_NAME[b.dataset.dir];
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stopRepeat();
    if (phase !== 'play' || paused) return;
    b.classList.add('gt-on');
    move(d);
    repeat = setInterval(() => move(d, true), REPEAT_MS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(type, stopRepeat);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

/* ---------- Aufteilung des Bildschirms ----------
   „hoch“: Anzeigen und Aufgabe oben, Steuerkreuz unten, Labyrinth dazwischen.
   „quer“: Anzeigen und Aufgabe links, Leiste und Steuerkreuz rechts, Labyrinth in der Mitte.
   Gewählt wird, was das größere Labyrinth ergibt. */
const probe = document.body.appendChild(document.createElement('div'));
probe.style.cssText = 'position:fixed;top:var(--gt-top);right:var(--gt-right);bottom:var(--gt-bottom);left:var(--gt-left);visibility:hidden;pointer-events:none';
const GAP = 12;

function arrange(kind) {
  const quer = kind === 'quer';
  document.body.classList.toggle('quer', quer);
  document.body.classList.toggle('hoch', !quer);
  const vw = innerWidth;
  const vh = Math.min(innerHeight, kit.viewport.height || innerHeight);
  const p = probe.getBoundingClientRect();
  const ins = { top: p.top, left: p.left, right: vw - p.right, bottom: innerHeight - p.bottom };
  const barEl = document.querySelector('.gt-bar');
  const bar = barEl ? barEl.getBoundingClientRect() : { left: vw - ins.right, width: 0, bottom: ins.top };
  const k = kreuz.getBoundingClientRect();
  if (quer) {
    const side = ins.right + Math.max(k.width, bar.width) + GAP;
    const room = Math.max(120, side - ins.left - GAP);
    hud.style.maxWidth = `${room}px`;
    aufgabe.style.maxWidth = `${room}px`;
    aufgabe.style.top = `${hud.getBoundingClientRect().bottom + 8}px`;
    return board(1, { top: ins.top, bottom: ins.bottom, left: side, right: side, width: vw, height: vh });
  }
  hud.style.maxWidth = `${Math.max(120, bar.left - ins.left - GAP)}px`;
  aufgabe.style.maxWidth = `${vw - ins.left - ins.right}px`;
  aufgabe.style.top = `${Math.max(hud.getBoundingClientRect().bottom, bar.bottom) + 8}px`;
  const top = aufgabe.getBoundingClientRect().bottom + GAP;
  return board(1, { top, bottom: vh - k.top + GAP, left: ins.left, right: ins.right, width: vw, height: vh });
}

function layout() {
  if (!play) return;
  const quer = arrange('quer');
  const hoch = arrange('hoch');
  const b = quer.width > hoch.width + 4 ? arrange('quer') : hoch;
  Object.assign(brett.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` });
}
kit.viewport.onResize(layout);

function konfetti() {
  document.querySelectorAll('.konfetti').forEach((e) => e.remove());
  const box = document.createElement('div');
  box.className = 'konfetti';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('span');
    s.textContent = CONFETTI[i % CONFETTI.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.8}s`;
    s.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    s.style.fontSize = `${1 + Math.random() * 1.2}rem`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3200);
}

/* ---------- Zugang für Tests ---------- */
function route(maze, from, to, avoid) {
  const prev = new Array(maze.w * maze.h).fill(null);
  const seen = new Array(maze.w * maze.h).fill(false);
  const q = [from];
  seen[idx(maze, from.x, from.y)] = true;
  while (q.length) {
    const c = q.shift();
    if (c.x === to.x && c.y === to.y) break;
    for (const d of DIRS) {
      if (!canMove(maze, c, d)) continue;
      const n = { x: c.x + DX[d], y: c.y + DY[d] };
      const i = idx(maze, n.x, n.y);
      if (seen[i] || (avoid && n.x === avoid.x && n.y === avoid.y)) continue;
      seen[i] = true;
      prev[i] = { c, d };
      q.push(n);
    }
  }
  if (!seen[idx(maze, to.x, to.y)]) return null;
  const dirs = [];
  for (let c = to; c.x !== from.x || c.y !== from.y;) {
    const p = prev[idx(maze, c.x, c.y)];
    dirs.unshift(p.d);
    c = p.c;
  }
  return dirs;
}

window.SPIEL = {
  modes: MODES.map((m) => ({ id: m.id, sizes: m.sizes.slice() })),
  state: () => ({
    phase, paused, mode: mode.id, level, starsTotal, maxStars,
    size: play ? play.maze.w : 0,
    pos: play ? { ...play.pos } : null,
    got: play ? play.got.filter(Boolean).length : 0,
    stars: play ? play.maze.stars.length : 0,
    seconds: Math.round(elapsed()),
  }),
  /* Weg (N/E/S/W) über alle noch liegenden Sterne (der nächste zuerst) zum Ziel */
  plan() {
    const { maze } = play;
    let at = { ...play.pos };
    let left = maze.stars.filter((_, i) => !play.got[i]);
    const out = [];
    while (left.length) {
      const options = left.map((s) => ({ s, r: route(maze, at, s, maze.goal) })).filter((o) => o.r);
      if (!options.length) break;
      options.sort((a, b) => a.r.length - b.r.length);
      out.push(...options[0].r);
      at = options[0].s;
      left = left.filter((s) => s !== options[0].s);
    }
    out.push(...route(maze, at, maze.goal));
    return out.map((d) => NAMES[d]);
  },
  gehe: (name) => move(BY_NAME[name]),
  /* Mittelpunkt einer Zelle in Bildschirm-Koordinaten des Spiels */
  zelle(x, y) {
    const r = brett.querySelector('svg').getBoundingClientRect();
    const n = play.maze.w * CELL + 2;
    return { x: r.left + ((x * CELL + CELL / 2 + 1) / n) * r.width, y: r.top + ((y * CELL + CELL / 2 + 1) / n) * r.height };
  },
};

goMenu();
