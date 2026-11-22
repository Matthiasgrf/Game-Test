/* SPIEL_TITEL – Spiellogik. Angelegt aus tools/vorlage/html/ (Regeln: docs/GAME_STANDARD.md).

   Ablauf: Start → Figur zu den Sternen lenken (Pfeiltasten, Touch-Knöpfe oder auf einen Stern tippen) →
   an jedem Stern eine Frage → alle Sterne gesammelt = Gewinn-Bildschirm mit Fehlversuchen und Zeit.
   Alles, was jedes Spiel braucht (Leiste, Pause, Ton, Drehen-Hinweis, Speicher), kommt aus dem Kit.

   TODO: Fragen, Figur, Szene und Texte durch das eigene Spiel ersetzen. Bewegungen immer mit dt rechnen. */
import { startKit, createLoop, fitCanvas } from '../shared/kit/kit.js';

/* TODO: eigene Fragen. q = Frage, a = Antworten, r = Nummer der richtigen Antwort (ab 0),
   e = kurze Erklärung, die nach der richtigen Antwort erscheint. */
const FRAGEN = [
  { q: 'Wie viele Tage hat eine Woche?', a: ['5', '7', '10'], r: 1, e: 'Eine Woche hat 7 Tage: von Montag bis Sonntag.' },
  { q: 'Welche Jahreszeit kommt nach dem Winter?', a: ['Frühling', 'Herbst', 'Sommer'], r: 0, e: 'Nach dem Winter kommt der Frühling. Dann blühen die ersten Blumen.' },
  { q: 'Was ist 6 · 4?', a: ['18', '24', '28'], r: 1, e: '6 · 4 = 24.' },
];

const $ = (id) => document.getElementById(id);
const canvas = $('szene');
const ctx = canvas.getContext('2d');

/* ---------- Kit: Leiste, Pause, Ton, Drehen-Hinweis, Speicher ---------- */
const kit = startKit({
  key: 'SPIEL_KEY',
  orientation: 'SPIEL_AUSRICHTUNG', // wie in games.json
  pause: () => { S.pausiertSeit = performance.now(); loop.pause(); },
  resume: () => { S.start += performance.now() - S.pausiertSeit; loop.resume(); },
});
const { input, sound, storage } = kit;

/* ---------- Zustand (Positionen in 0…1, damit hoch und quer gleich funktioniert) ---------- */
const S = {
  phase: 'menu',          // menu | play | frage | ende
  x: 0.5, y: 0.78,        // Figur
  ziel: null,             // angetippter Punkt
  sterne: [],
  gesammelt: 0,
  fehler: 0,
  start: 0,
  pausiertSeit: 0,
  frage: null,
  zeit: 0,                // für Animationen
};
let view = { width: 1, height: 1, dpr: 1 };

function neueRunde() {
  /* Sterne gleichmäßig verteilt, nicht zu nah am Rand und an der Leiste */
  S.sterne = FRAGEN.map((f, i) => ({
    x: 0.18 + 0.64 * ((i + 0.5) / FRAGEN.length),
    y: 0.3 + 0.25 * (i % 2),
    frage: i,
    fertig: false,
  }));
  Object.assign(S, { x: 0.5, y: 0.78, ziel: null, gesammelt: 0, fehler: 0, start: performance.now() });
  zeigeFortschritt();
}

/* ---------- Schleife ---------- */
const loop = createLoop({ update, render });

function update(dt) {
  S.zeit += dt;
  if (S.phase !== 'play') return;
  /* Steuerung: Tasten/Touch-Knöpfe, sonst zum angetippten Punkt fliegen */
  let dx = (input.down('rechts') ? 1 : 0) - (input.down('links') ? 1 : 0);
  let dy = (input.down('runter') ? 1 : 0) - (input.down('hoch') ? 1 : 0);
  if (dx || dy) S.ziel = null;
  else if (S.ziel) {
    const px = (S.ziel.x - S.x) * view.width;
    const py = (S.ziel.y - S.y) * view.height;
    if (Math.hypot(px, py) < 4) S.ziel = null; else { dx = px; dy = py; }
  }
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const speed = 0.55 * Math.min(view.width, view.height); // Pixel pro Sekunde – mit dt gleich schnell auf 60 und 120 Hz
    S.x = clamp(S.x + (dx / len) * speed * dt / view.width, 0.05, 0.95);
    S.y = clamp(S.y + (dy / len) * speed * dt / view.height, 0.12, 0.92);
  }
  /* Stern erreicht? */
  const r = 0.07 * Math.min(view.width, view.height);
  const stern = S.sterne.find((s) => !s.fertig && Math.hypot((s.x - S.x) * view.width, (s.y - S.y) * view.height) < r);
  if (stern) frageStellen(stern);
}

/* ---------- Zeichnen (CSS-Pixel; fitCanvas sorgt für Schärfe auf Retina) ---------- */
function render() {
  const { width: W, height: H } = view;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, css.getPropertyValue('--gt-sky-1').trim() || '#69b9ee');
  sky.addColorStop(0.7, css.getPropertyValue('--gt-sky-2').trim() || '#d6ecfb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  /* Sonne mit Schein */
  const sun = ctx.createRadialGradient(W * 0.85, H * 0.18, 0, W * 0.85, H * 0.18, H * 0.22);
  sun.addColorStop(0, 'rgba(255,236,150,.95)');
  sun.addColorStop(1, 'rgba(255,236,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  /* Wolken ziehen langsam */
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.31 + S.zeit * 0.012 * (1 + i * 0.3)) % 1.3 - 0.15) * W;
    wolke(cx, H * (0.12 + 0.09 * i), Math.min(W, H) * (0.06 + 0.015 * i));
  }

  /* Hügel mit Verlauf */
  huegel(H * 0.8, '#8fd694', '#5fb86f', 0.9);
  huegel(H * 0.88, '#5fb86f', '#3f9a55', 1.7);

  /* Sterne: leuchten und wippen */
  const r = 0.045 * Math.min(W, H);
  for (const s of S.sterne) {
    if (s.fertig) continue;
    const x = s.x * W;
    const y = s.y * H + Math.sin(S.zeit * 2 + s.frage) * r * 0.25;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(0, 'rgba(255,214,102,.75)');
    glow.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
    stern(x, y, r, S.zeit * 0.8 + s.frage);
  }

  /* Figur: kleine Rakete mit Schatten */
  figur(S.x * W, S.y * H, 0.05 * Math.min(W, H));
}

function wolke(x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 1.4, s * 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x - s * 0.6, y + s * 0.1, s * 0.8, s * 0.5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.7, y + s * 0.15, s * 0.9, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function huegel(y, top, bottom, phase) {
  const { width: W, height: H } = view;
  const g = ctx.createLinearGradient(0, y - H * 0.1, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, y - Math.sin(x / W * Math.PI * 2 + phase) * H * 0.035);
  ctx.lineTo(W, H);
  ctx.fill();
}

function stern(x, y, r, dreh) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(dreh) * 0.15);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#ffd166');
  g.addColorStop(1, '#ff8a1f');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(11,58,102,.35)';
  ctx.shadowBlur = r * 0.4;
  ctx.shadowOffsetY = r * 0.15;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function figur(x, y, s) {
  /* Schatten auf dem Boden */
  ctx.fillStyle = 'rgba(20,60,40,.25)';
  ctx.beginPath(); ctx.ellipse(x, view.height * 0.93, s * 0.9, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  /* Flamme flackert */
  const f = 0.8 + Math.sin(S.zeit * 30) * 0.2;
  ctx.fillStyle = '#ff9f1c';
  ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.8); ctx.lineTo(x, y + s * (1.3 + 0.4 * f)); ctx.lineTo(x + s * 0.35, y + s * 0.8); ctx.fill();
  /* Körper mit Licht von oben links */
  const body = ctx.createLinearGradient(x - s, y - s, x + s, y + s);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(1, '#c9d8e8');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#16324f';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.95, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4dabf7';
  ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.4); ctx.lineTo(x - s * 0.85, y + s * 0.95); ctx.lineTo(x - s * 0.35, y + s * 0.75); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + s * 0.5, y + s * 0.4); ctx.lineTo(x + s * 0.85, y + s * 0.95); ctx.lineTo(x + s * 0.35, y + s * 0.75); ctx.fill();
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Ablauf ---------- */
function setPhase(phase) {
  S.phase = phase;
  kit.setState(phase === 'menu' ? 'menu' : phase === 'ende' ? 'end' : 'play');
  /* Im Menü und hinter Fenstern lebt die Szene nur langsam weiter – spart Akku */
  loop.setMaxFps(phase === 'play' ? 0 : 15);
  $('hud').hidden = phase === 'menu' || phase === 'ende';
  $('steuerung-links').hidden = $('steuerung-rechts').hidden = phase !== 'play';
}

function starten() {
  neueRunde();
  kit.show(null);
  setPhase('play');
}

function frageStellen(stern) {
  S.frage = stern;
  input.clear();
  const f = FRAGEN[stern.frage];
  $('frage-text').textContent = f.q;
  $('rueckmeldung').textContent = '';
  $('antworten').innerHTML = '';
  document.querySelector('[data-action="weiter"]').hidden = true;
  f.a.forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gt-option';
    b.textContent = text;
    b.addEventListener('click', () => antworten(b, i === f.r, f));
    $('antworten').appendChild(b);
  });
  setPhase('frage');
  kit.show('frage');
}

function antworten(button, richtig, f) {
  if (richtig) {
    button.classList.add('gt-good');
    $('antworten').querySelectorAll('button').forEach((b) => { b.disabled = true; });
    $('rueckmeldung').textContent = `✅ Richtig! ${f.e}`;
    sound.richtig();
    const weiter = document.querySelector('[data-action="weiter"]');
    weiter.hidden = false;
    weiter.focus();
  } else {
    S.fehler++;
    button.classList.add('gt-bad');
    button.disabled = true;
    $('rueckmeldung').textContent = '🤔 Noch nicht ganz. Versuch es noch einmal!';
    sound.falsch();
  }
}

function weiter() {
  S.frage.fertig = true;
  S.gesammelt++;
  zeigeFortschritt();
  if (S.gesammelt === FRAGEN.length) return beenden();
  kit.show(null);
  setPhase('play');
}

function beenden() {
  const sekunden = Math.round((performance.now() - S.start) / 1000);
  $('ergebnis').textContent = `Fehlversuche: ${S.fehler} · Zeit: ${sekunden} s`;
  /* HIGHSCORE-START */
  /* Ergebnis für die Bestenliste (weniger Fehlversuche sind besser, bei Gleichstand zählt die Zeit) */
  storage.saveScore({ points: S.fehler, seconds: sekunden });
  /* HIGHSCORE-ENDE */
  sound.gewonnen();
  setPhase('ende');
  kit.show('ende');
}

function zeigeFortschritt() {
  $('fortschritt').textContent = `⭐ ${S.gesammelt} / ${FRAGEN.length}`;
}

/* ---------- Eingaben ---------- */
input.touchButtons($('steuerung-links'), [{ action: 'links', label: '◀', title: 'nach links' }, { action: 'rechts', label: '▶', title: 'nach rechts' }]);
input.touchButtons($('steuerung-rechts'), [{ action: 'hoch', label: '▲', title: 'nach oben' }, { action: 'runter', label: '▼', title: 'nach unten' }]);
canvas.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'play') return;
  const r = canvas.getBoundingClientRect();
  S.ziel = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
});
input.on('aktion', () => { if (S.phase === 'menu') starten(); });
document.querySelector('[data-action="start"]').addEventListener('click', starten);
document.querySelector('[data-action="weiter"]').addEventListener('click', weiter);
document.querySelector('[data-action="nochmal"]').addEventListener('click', starten);

/* Größe und Drehung: Canvas scharf halten, Szene neu zeichnen */
kit.viewport.onResize(() => { view = fitCanvas(canvas); loop.renderOnce(); });

/* Zugang für den Durchspiel-Test (tools/spieltests/SPIEL_KEY.js) – ändert nichts am Spiel */
window.SPIEL = {
  fragen: FRAGEN,
  loop,
  state: () => ({ phase: S.phase, gesammelt: S.gesammelt, fehler: S.fehler, x: S.x, y: S.y }),
  /* Figur direkt neben den Stern i setzen (der Test muss nicht hinfliegen) */
  zuStern(i) { const s = S.sterne[i]; S.x = s.x; S.y = s.y + 0.02; },
};

neueRunde();
setPhase('menu');
kit.show('start');
loop.start();
