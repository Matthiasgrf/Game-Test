/* Rohr-Flitzer – ein Spiel der Fisser-Flitzer.
   Die Kackwurst wird auf dem Dachboden von Haus Buchhammer heruntergespült und muss durch die Abflussrohre
   bis in die Kanalisation. Spielregeln wie in der früheren React-Fassung (src/games/rohr-flitzer/):
   Die Wurst bewegt sich nur, solange eine Richtung gedrückt ist – kurz drücken = ein Feld, gedrückt halten =
   weiterflitzen. Von selbst läuft sie nie, auch nicht um Kurven.
   Ergebnis: Punkte = Sekunden bis in die Kanalisation (weniger ist besser), Pausen zählen nicht mit.
   Darstellung: Die Szene füllt den Bildschirm (draw.js), das Haus steht so groß wie möglich darin –
   hochkant mit Zeit oben und Knöpfen unten, quer mit ◀ ▶ links und ▲ ▼ rechts.
   Für Tests: window.SPIEL (maze(), sim(), state(), view(), loop). */
import { startKit, createLoop, fitCanvas } from '../shared/kit/kit.js';
import { DELTA, OPPOSITE, ROWS, SPEED, edgeAt, generateMaze } from './maze.js';
import { H, SEWER, W, drawFrame, edgeMid, freshSim, renderStatic, splash, stepParticles, wurstPos } from './draw.js';

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};
const SEWER_Y = H - SEWER;

const $ = (id) => document.getElementById(id);
const canvas = $('szene');
const ctx = canvas.getContext('2d');
const hud = $('hud'), pad = $('pad'), platsch = $('platsch');
const fmt = (secs) => secs.toFixed(1).replace('.', ',');

let maze = generateMaze();
let sim = freshSim(maze);
let phase = 'ready';        // ready | playing | won
let held = [];              // gerade gedrückte Richtungen, zuletzt gedrückte hinten
let now = 0;                // Uhr für Animationen in ms (steht in der Pause)
let lastUi = 0;
let winShown = false;
let view = null;            // { k, ox, oy, dpr, width, height } – siehe draw.js
let staticLayer = null;
let touch = null;           // Wischen/Tippen auf der Szene

const loop = createLoop({ update, render });
const kit = startKit({
  key: 'rohr-flitzer',
  orientation: 'any',
  pause() { loop.pause(); held = []; touch = null; },
  resume() { loop.resume(); },
});

/* ---------- Bewegung ---------- */
/** Losflitzen in Richtung d, falls dort ein offenes Rohr ist. */
function go(s, d, quiet = false) {
  const e = edgeAt(maze, s.r, s.c, d);
  if (e === 1) {
    s.fr = s.r;
    s.fc = s.c;
    s.r += DELTA[d][0];
    s.c += DELTA[d][1];
    s.t = 0;
    s.moving = d;
    return true;
  }
  if (e === 2 && !quiet) {
    const p = edgeMid(s.r, s.c, d);
    s.bump = { x: p.x, y: p.y, at: now, text: 'Verstopft! 🚫' };
  } else if (!quiet) {
    const p = wurstPos(s);
    s.bump = { x: p.x, y: p.y, at: now, text: 'Kein Rohr!' };
  }
  return false;
}

/** Richtung gedrückt (Taste, Knopf, Finger) */
function press(d) {
  if (kit.paused) return;
  held = held.filter((x) => x !== d).concat(d);
  if (phase !== 'playing') return;
  const s = sim;
  if (s.moving) {
    if (d === OPPOSITE[s.moving] && s.fr >= 0) {
      // sofort umdrehen
      [s.r, s.c, s.fr, s.fc] = [s.fr, s.fc, s.r, s.c];
      s.t = 1 - s.t;
      s.moving = d;
      s.queued = null;
    } else s.queued = d;
    return;
  }
  if (s.r < 0) return;
  s.queued = null;
  go(s, d);
}

/** Richtung losgelassen */
function release(d) {
  held = held.filter((x) => x !== d);
}

/** kurzer Druck: genau ein Feld */
function tap(d) {
  press(d);
  release(d);
}

function arrive(s) {
  if (s.fr >= 0) {
    const v = s.fr !== s.r;
    s.trail.add(`${Math.min(s.fr, s.r)},${Math.min(s.fc, s.c)},${v ? 'v' : 'h'}`);
  }
  s.moving = null;
  s.t = 1;
  if (s.r >= ROWS) {
    win();
    return;
  }
  // 1. während der Bewegung gedrückte Richtung (auch wenn schon losgelassen)
  if (s.queued && go(s, s.queued, true)) {
    s.queued = null;
    return;
  }
  // 2. weiter, solange eine Richtung gedrückt ist – zuletzt gedrückte zuerst
  for (let i = held.length - 1; i >= 0; i--) {
    if (go(s, held[i], true)) {
      s.queued = null;
      return;
    }
  }
  // 3. sonst anhalten; zeigt „Verstopft!“, wenn gegen einen Pfropfen gedrückt wird
  const want = s.queued ?? held[held.length - 1];
  if (want) go(s, want);
  s.queued = null;
}

/* ---------- Ablauf ---------- */
function start() {
  if (phase === 'playing') return;
  if (phase === 'won') {
    maze = generateMaze();
    staticLayer = null;
  }
  sim = freshSim(maze);
  sim.r = 0; // Spülung: aus dem Klo ins erste Rohr
  sim.t = 0;
  sim.moving = 'down';
  held = [];
  phase = 'playing';
  winShown = false;
  platsch.hidden = true;
  showTime(0);
  kit.setState('play');
  kit.show(null);
  loop.setMaxFps(0);
}

function win() {
  sim.wonAt = now;
  splash(sim, wurstPos(sim).x);
  phase = 'won';
  const secs = sim.time;
  showTime(secs);
  // Punkte in Hundertstelsekunden (games.json: pointsDecimals 2), seconds ganzzahlig für die Plausibilitätsprüfung
  const hundredths = Math.max(1, Math.round(secs * 100));
  kit.storage.saveScore({ points: hundredths, seconds: Math.max(1, Math.ceil(hundredths / 100)) });
  kit.setState('end');
  $('ergebnis').textContent = `⏱ ${secs.toFixed(2).replace('.', ',')} Sekunden`;
  // „Platsch!“ über der Kanalisation, bis das Gewinn-Fenster kommt
  if (view) {
    platsch.style.left = `${view.ox + (W * view.k) / 2}px`;
    platsch.style.top = `${view.oy + (SEWER_Y + 30) * view.k}px`;
  }
  platsch.hidden = false;
}

function showTime(secs) {
  $('zeit').textContent = `⏱ ${fmt(secs)} s`;
}

/* ---------- Spielschleife ---------- */
function update(dt) {
  now += dt * 1000;
  if (phase === 'playing') {
    sim.time += dt;
    if (sim.moving) {
      sim.t += SPEED[sim.moving] * dt;
      if (sim.t >= 1) {
        // Die Zeit über das Feld hinaus geht nicht verloren: gleiche Zeit bei 30, 60 und 120 Bildern pro Sekunde
        const rest = (sim.t - 1) / SPEED[sim.moving];
        sim.time -= rest; // Ankunft genau auf dem Feld (zählt fürs Ziel)
        arrive(sim);
        if (phase === 'playing') sim.time += rest;
        if (sim.moving) sim.t = Math.min(0.99, rest * SPEED[sim.moving]);
      }
    }
    if (phase === 'playing' && now - lastUi > 100) {
      lastUi = now;
      showTime(sim.time);
    }
  }
  if (phase === 'won' && !winShown && now - sim.wonAt > 900) {
    winShown = true;
    platsch.hidden = true;
    kit.show('win');
    loop.setMaxFps(20); // die Szene lebt hinter dem Fenster langsamer weiter
  }
  stepParticles(sim, dt);
}

function render() {
  if (!view) return;
  if (!staticLayer) staticLayer = renderStatic(maze, view);
  drawFrame(ctx, view, staticLayer, maze, sim, now, phase);
}

/* ---------- Aufteilung des Bildschirms ----------
   hochkant: Zeit und Leiste oben, Knöpfe unten, das Haus dazwischen
   quer:     das Haus über die ganze Höhe in der Mitte, links Zeit und ◀ ▶, rechts Leiste und ▲ ▼ */
const probe = document.body.appendChild(document.createElement('div'));
probe.style.cssText = 'position:fixed;top:var(--gt-top);right:var(--gt-right);bottom:var(--gt-bottom);left:var(--gt-left);visibility:hidden;pointer-events:none';

function layout() {
  const fit = fitCanvas(canvas, { maxDpr: 2 });
  const vw = fit.width, vh = fit.height;
  const quer = vw > vh;
  document.body.classList.toggle('quer', quer);
  const p = probe.getBoundingClientRect();
  const barEl = document.querySelector('.gt-bar');
  const bar = barEl ? barEl.getBoundingClientRect() : null;
  const hudBox = hud.getBoundingClientRect();
  const padOn = getComputedStyle(pad).display !== 'none';
  let top = 0, bottom = 0, side = 0;
  if (quer) {
    const lr = padOn ? $('padLR').getBoundingClientRect() : null;
    const ud = padOn ? $('padUD').getBoundingClientRect() : null;
    side = Math.max(hudBox.right, lr ? lr.right : 0, bar ? vw - bar.left : 0, ud ? vw - ud.left : 0) + 10;
  } else {
    top = Math.max(hudBox.bottom, bar ? bar.bottom : 0) + 6;
    bottom = padOn ? vh - pad.getBoundingClientRect().top + 6 : innerHeight - p.bottom;
  }
  const aw = Math.max(60, vw - 2 * side), ah = Math.max(60, vh - top - bottom);
  const k = Math.min(aw / W, ah / H, 1.6);
  view = { k, ox: side + (aw - W * k) / 2, oy: top + (ah - H * k) / 2, dpr: fit.dpr, width: vw, height: vh };
  staticLayer = null;
  if (loop.paused) loop.renderOnce();
}
kit.viewport.onResize(layout);

/* ---------- Eingaben ---------- */
addEventListener('keydown', (e) => {
  const d = KEYS[e.code];
  if (!d || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (!e.repeat) press(d);
});
addEventListener('keyup', (e) => {
  const d = KEYS[e.code];
  if (d) release(d);
});
addEventListener('blur', () => { held = []; });
/* Leertaste/Enter startet (auf einem Knopf klickt der Knopf selbst) */
kit.input.on('aktion', () => { if (phase !== 'playing' && !kit.paused) start(); });

/* Wischen und den Finger liegen lassen = weiterflitzen; Finger weg = anhalten. Tippen = ein Feld in diese Richtung */
canvas.addEventListener('pointerdown', (e) => {
  if (kit.paused) return;
  touch = { x: e.clientX, y: e.clientY, dir: null };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* kein echter Zeiger (Test) */ }
});
canvas.addEventListener('pointermove', (e) => {
  const t = touch;
  if (!t) return;
  const dx = e.clientX - t.x;
  const dy = e.clientY - t.y;
  if (Math.hypot(dx, dy) < 22) return;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  if (d !== t.dir) {
    if (t.dir) release(t.dir);
    press(d);
    t.dir = d;
  }
  t.x = e.clientX;
  t.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  const t = touch;
  touch = null;
  if (t?.dir) release(t.dir);
  if (!t || t.dir || phase !== 'playing' || !view) return;
  const px = (e.clientX - view.ox) / view.k;
  const py = (e.clientY - view.oy) / view.k;
  const p = wurstPos(sim);
  const dx = px - p.x, dy = py - p.y;
  if (Math.hypot(dx, dy) < 18) return;
  tap(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
});
canvas.addEventListener('pointercancel', () => {
  if (touch?.dir) release(touch.dir);
  touch = null;
});

/* Pfeil-Knöpfe: gedrückt halten = weiterflitzen */
pad.querySelectorAll('button').forEach((b) => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('gt-on');
    press(d);
  });
  const up = () => { b.classList.remove('gt-on'); release(d); };
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(type, up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

document.querySelector('[data-action="start"]').addEventListener('click', start);
document.querySelector('[data-action="nochmal"]').addEventListener('click', start);

/* ---------- Zugang für Tests ---------- */
window.SPIEL = {
  loop,
  maze: () => maze,
  sim: () => sim,
  state: () => ({ phase, r: sim.r, c: sim.c, moving: sim.moving, time: sim.time, paused: kit.paused }),
  view: () => view && ({
    house: { x: view.ox, y: view.oy, width: W * view.k, height: H * view.k },
    canvas: [canvas.width, canvas.height],
    screen: [Math.round(innerWidth * view.dpr), Math.round(innerHeight * view.dpr)],
  }),
};

kit.setState('menu');
kit.show('start');
loop.setMaxFps(20);
loop.start();
