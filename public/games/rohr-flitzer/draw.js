// =====================================================================
// Rohr-Flitzer: Zeichnen (aus der früheren React-Fassung src/games/rohr-flitzer/draw.ts)
//   Das Haus mit dem Rohrsystem liegt in logischen Pixeln bei 0…W × 0…H. Die Szene geht über das Haus
//   hinaus bis an die Bildschirmränder: Himmel, Hügel, Garten mit Bäumen, Erde und die Kanalisation über
//   die ganze Breite – so füllt das Bild jeden Bildschirm, hoch wie quer.
//   view = { k, ox, oy, dpr, width, height }: Bildschirm (CSS-Pixel) = ox + x·k, oy + y·k
//   renderStatic(m, view): Garten, Erde, Kanalisation, Haus, Zimmer, Rohre, Verstopfungen – einmal pro
//                          Rohrsystem und Bildschirmgröße
//   drawFrame(…):          Himmel, Wolken, Rauch, Wasser, Ratte, Spur, Gestank, Wurst, Effekte – jedes Bild
// =====================================================================
import { COLS, DELTA, FLOORS, ROWS, ROWS_PER_FLOOR, edgeAt } from './maze.js';

export const S = 64; // Zellgröße
export const M = 18; // Rand (Hauswand)
export const ROOF = 132; // Dachboden mit Klo
export const SEWER = 100; // Kanalisation
export const W = M * 2 + COLS * S;
export const H = ROOF + ROWS * S + SEWER;
const PW = S * 0.46; // Rohrdicke
const SEWER_Y = ROOF + ROWS * S;
const WATER_Y = H - 38;
const GROUND = ROOF + 2 * ROWS_PER_FLOOR * S; // Erdboden: Bad und Küche darüber, Keller darunter

export const cx = (c) => M + c * S + S / 2;
export const cy = (r) => ROOF + r * S + S / 2;
/** y-Mitte einer Zeile; -1 = Klo, ROWS = Wasser der Kanalisation */
const rowY = (r) => (r < 0 ? ROOF - 30 : r >= ROWS ? WATER_Y + 6 : cy(r));

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const FONT = '"Trebuchet MS","Chalkboard SE","Comic Sans MS",system-ui,sans-serif';

/* Zustand der Wurst:
   r, c: Ziel der aktuellen Bewegung bzw. aktuelle Zelle · fr, fc: Start der Bewegung · t: Fortschritt 0…1
   moving: Richtung oder null · queued: gewünschte Richtung für die nächste Abzweigung
   trail: Spur (Rohrstücke) · bump: Sprechblase · time: Spielzeit in Sekunden (ohne Pausen)
   wonAt: Uhrzeit des Platsch · particles: Spritzer */
export function freshSim(m) {
  return {
    r: -1, c: m.startCol, fr: -1, fc: m.startCol, t: 1, moving: null, queued: null,
    trail: new Set(), bump: null, time: 0, wonAt: 0, particles: [],
  };
}

/** Aktuelle Position der Wurst in logischen Pixeln */
export function wurstPos(s) {
  const t = s.moving ? s.t : 1;
  return {
    x: cx(s.fc) + (cx(s.c) - cx(s.fc)) * t,
    y: rowY(s.fr) + (rowY(s.r) - rowY(s.fr)) * t,
  };
}

/** Mitte des Rohrs von Zelle (r,c) in Richtung d */
export const edgeMid = (r, c, d) => ({
  x: (cx(c) + cx(c + DELTA[d][1])) / 2,
  y: (rowY(r) + rowY(r + DELTA[d][0])) / 2,
});

/** Sichtbarer Ausschnitt der Welt (logische Pixel) */
export function bounds(v) {
  return { x0: -v.ox / v.k, x1: (v.width - v.ox) / v.k, y0: -v.oy / v.k, y1: (v.height - v.oy) / v.k };
}
const toWorld = (ctx, v) => ctx.setTransform(v.k * v.dpr, 0, 0, v.k * v.dpr, v.ox * v.dpr, v.oy * v.dpr);

/* Pseudo-Zufall, der bei jedem Zeichnen gleich bleibt (Bäume, Steine) */
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------------
// Statische Ebene
// ---------------------------------------------------------------------
export function renderStatic(m, view) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(view.width * view.dpr));
  cv.height = Math.max(1, Math.round(view.height * view.dpr));
  const ctx = cv.getContext('2d');
  toWorld(ctx, view);
  const b = bounds(view);
  drawLand(ctx, b);
  drawRoof(ctx, m);
  drawRooms(ctx);
  drawSewerBack(ctx, m, b);
  drawPipes(ctx, m);
  drawToilet(ctx, cx(m.startCol), ROOF);
  return cv;
}

/* Die Welt rund um das Haus: Hügel, Gärten, Gras, Erde, Fels unter der Kanalisation */
function drawLand(ctx, b) {
  const x0 = Math.floor(b.x0) - 4, x1 = Math.ceil(b.x1) + 4;
  hills(ctx, x0, x1, GROUND - 64, 24, ['#b7e4ae', '#94d18c'], 0);
  hills(ctx, x0, x1, GROUND - 30, 16, ['#86cc7f', '#5fae5a'], 2.3);
  // Gärten links und rechts: Bäume und Büsche, nach außen hin immer weiter
  for (const side of [-1, 1]) {
    for (let i = 0; i < 40; i++) {
      const x = side < 0 ? -64 - i * 150 - rnd(i) * 34 : W + 64 + i * 150 + rnd(i + 50) * 34;
      if (side < 0 ? x < x0 - 80 : x > x1 + 80) break;
      if (rnd(i * 3 + (side > 0 ? 7 : 1)) < 0.6) tree(ctx, x, GROUND, 0.85 + rnd(i + 20) * 0.35);
      else bush(ctx, x, GROUND, 0.9 + rnd(i + 30) * 0.5);
      if (rnd(i + 90) < 0.7) bush(ctx, x + side * 66, GROUND, 0.55 + rnd(i + 40) * 0.3);
    }
  }
  // Gras mit Blumen
  ctx.fillStyle = '#51cf66';
  ctx.fillRect(x0, GROUND - 4, x1 - x0, 10);
  ctx.fillStyle = '#40a955';
  ctx.fillRect(x0, GROUND + 4, x1 - x0, 3);
  const flowers = ['#ffffff', '#ffd43b', '#ff8787', '#da77f2'];
  for (let x = Math.floor(x0 / 23) * 23; x < x1; x += 23) {
    if (x > -12 && x < W + 12) continue;
    const i = Math.round(x / 23);
    if (rnd(i + 300) < 0.45) continue;
    ctx.fillStyle = flowers[Math.floor(rnd(i + 400) * flowers.length)];
    ctx.beginPath();
    ctx.arc(x + rnd(i + 500) * 12, GROUND - 4 - rnd(i + 600) * 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Erde bis zur Kanalisation, mit Steinen
  const eg = ctx.createLinearGradient(0, GROUND + 7, 0, SEWER_Y);
  eg.addColorStop(0, '#8a6543');
  eg.addColorStop(1, '#5e4330');
  ctx.fillStyle = eg;
  ctx.fillRect(x0, GROUND + 7, x1 - x0, SEWER_Y - GROUND - 2);
  for (let gx = Math.floor(x0 / 70); gx * 70 < x1; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const x = gx * 70 + rnd(gx * 13 + gy) * 50;
      const y = GROUND + 28 + gy * 44 + rnd(gx * 7 + gy * 31) * 18;
      if (x > -16 && x < W + 16) continue;
      stone(ctx, x, y, 6 + rnd(gx + gy * 17) * 7);
    }
  }
  // Fels unter der Kanalisation
  if (b.y1 > H) {
    ctx.fillStyle = '#3a312b';
    ctx.fillRect(x0, H, x1 - x0, b.y1 - H + 4);
    for (let gx = Math.floor(x0 / 60); gx * 60 < x1; gx++) {
      for (let gy = 0; H + 20 + gy * 40 < b.y1 + 20; gy++) stone(ctx, gx * 60 + rnd(gx * 5 + gy) * 40, H + 22 + gy * 40, 7 + rnd(gx + gy * 3) * 6, true);
    }
  }
}

function hills(ctx, x0, x1, base, amp, [light, dark], phase) {
  const g = ctx.createLinearGradient(0, base - amp, 0, GROUND);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, GROUND);
  for (let x = x0; x <= x1 + 10; x += 10) ctx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x / 95 + phase)) - 8 * Math.sin(x / 33 + phase * 2));
  ctx.lineTo(x1 + 10, GROUND);
  ctx.closePath();
  ctx.fill();
}

function tree(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + 8 * s, y - 1, 36 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  const tg = ctx.createLinearGradient(x - 8 * s, 0, x + 8 * s, 0);
  tg.addColorStop(0, '#5a3d24');
  tg.addColorStop(0.45, '#9a6b43');
  tg.addColorStop(1, '#4e341f');
  ctx.fillStyle = tg;
  ctx.fillRect(x - 8 * s, y - 74 * s, 16 * s, 74 * s);
  for (const [dx, dy, r] of [[-22, -86, 30], [22, -90, 31], [0, -118, 35]]) {
    const px = x + dx * s, py = y + dy * s, pr = r * s;
    const g = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.1, px, py, pr);
    g.addColorStop(0, '#a3e594');
    g.addColorStop(0.55, '#4fae4b');
    g.addColorStop(1, '#2b7a30');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bush(ctx, x, y, s) {
  for (const [dx, dy, r] of [[-14, -12, 15], [13, -12, 15], [0, -22, 17]]) {
    const px = x + dx * s, py = y + dy * s, pr = r * s;
    const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.4, pr * 0.1, px, py, pr);
    g.addColorStop(0, '#8fdc7f');
    g.addColorStop(1, '#2f8a3a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff6b6b';
  for (const [dx, dy] of [[-10, -18], [8, -26], [14, -12]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function stone(ctx, x, y, r, dark = false) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, dark ? '#6b625a' : '#b5a898');
  g.addColorStop(1, dark ? '#2e2722' : '#6f5f4f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoof(ctx, m) {
  const apex = 14;
  // Schornstein (hinter dem Dach), nicht über dem Klo
  const chX = m.startCol >= COLS / 2 ? W * 0.2 : W * 0.74;
  ctx.fillStyle = '#9c4a33';
  ctx.fillRect(chX, 30, 26, 70);
  ctx.fillStyle = '#6d2f1f';
  ctx.fillRect(chX - 4, 26, 34, 9);

  // Dachboden (innen)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-14, ROOF);
  ctx.lineTo(W / 2, apex);
  ctx.lineTo(W + 14, ROOF);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, apex, 0, ROOF);
  g.addColorStop(0, '#f2614a');
  g.addColorStop(1, '#c9432c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Dachziegel
  ctx.strokeStyle = 'rgba(90,20,10,0.28)';
  ctx.lineWidth = 2;
  for (let y = apex + 14, row = 0; y < ROOF + 10; y += 13, row++) {
    for (let x = (row % 2) * 11 - 22; x < W + 22; x += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI);
      ctx.stroke();
    }
  }
  // Dachboden-Wand innen
  ctx.beginPath();
  ctx.moveTo(26, ROOF);
  ctx.lineTo(W / 2, apex + 30);
  ctx.lineTo(W - 26, ROOF);
  ctx.closePath();
  ctx.fillStyle = '#f7e6cc';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,40,0.18)';
  ctx.lineWidth = 1;
  for (let x = 30; x < W; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, apex + 20);
    ctx.lineTo(x, ROOF);
    ctx.stroke();
  }
  ctx.restore();
  // Dachkante
  ctx.strokeStyle = '#7a2414';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, ROOF);
  ctx.lineTo(W / 2, apex);
  ctx.lineTo(W + 14, ROOF);
  ctx.stroke();

  // Hausschild
  const sw = 196, sh = 34, sx = W / 2 - sw / 2, sy = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, sx + 2, sy + 3, sw, sh, 8);
  ctx.fill();
  const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
  sg.addColorStop(0, '#fffaf0');
  sg.addColorStop(1, '#f3e2c3');
  ctx.fillStyle = sg;
  ctx.strokeStyle = '#7b4a22';
  ctx.lineWidth = 3;
  roundRect(ctx, sx, sy, sw, sh, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5c3416';
  ctx.font = `bold 19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Haus Buchhammer', W / 2, sy + sh / 2 + 1);
}

function drawRooms(ctx) {
  const fh = ROWS_PER_FLOOR * S;
  const deco = [
    ['🛁', '🪥'],
    ['🍳', '🪴'],
    ['🧺', '🕸️'],
  ];
  for (let f = 0; f < FLOORS.length; f++) {
    const y = ROOF + f * fh;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, fh);
    ctx.clip();
    if (f === 0) {
      // Bad: Fliesen
      ctx.fillStyle = '#e3f4fb';
      ctx.fillRect(0, y, W, fh);
      ctx.fillStyle = '#c6e7f5';
      ctx.fillRect(0, y + fh * 0.55, W, fh * 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < W; x += 22) line(ctx, x, y, x, y + fh);
      for (let yy = y; yy < y + fh; yy += 22) line(ctx, 0, yy, W, yy);
    } else if (f === 1) {
      // Küche: Streifentapete + Fliesenspiegel
      ctx.fillStyle = '#fff3d1';
      ctx.fillRect(0, y, W, fh);
      ctx.fillStyle = 'rgba(255,190,110,0.22)';
      for (let x = 0; x < W; x += 28) ctx.fillRect(x, y, 12, fh);
      for (let x = 0, i = 0; x < W; x += 16, i++)
        for (let yy = y + fh * 0.62, j = 0; yy < y + fh; yy += 16, j++) {
          ctx.fillStyle = (i + j) % 2 ? '#ffffff' : '#ffd8a8';
          ctx.fillRect(x, yy, 16, 16);
        }
      // Fenster
      ctx.fillStyle = '#a5d8ff';
      roundRect(ctx, W * 0.42, y + 18, 70, 52, 4);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.stroke();
      line(ctx, W * 0.42 + 35, y + 18, W * 0.42 + 35, y + 70);
      line(ctx, W * 0.42, y + 44, W * 0.42 + 70, y + 44);
    } else {
      // Keller: Ziegel
      ctx.fillStyle = '#d9d2c5';
      ctx.fillRect(0, y, W, fh);
      ctx.strokeStyle = 'rgba(120,95,70,0.3)';
      ctx.lineWidth = 1.5;
      for (let yy = y, row = 0; yy < y + fh; yy += 16, row++) {
        line(ctx, 0, yy, W, yy);
        for (let x = (row % 2) * 18; x < W; x += 36) line(ctx, x, yy, x, yy + 16);
      }
    }
    // Einrichtung (blass, hinter den Rohren)
    ctx.globalAlpha = 0.45;
    ctx.font = `52px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(deco[f][0], W * 0.2, y + fh * 0.62);
    ctx.fillText(deco[f][1], W * 0.82, y + fh * 0.5);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // Decken / Böden
  for (let f = 0; f <= FLOORS.length; f++) {
    const y = ROOF + f * fh;
    ctx.fillStyle = f === FLOORS.length ? '#6b5a48' : '#b07a4f';
    ctx.fillRect(0, y - 5, W, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y + 3, W, 2);
  }
  // Außenwände
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(0, ROOF, 8, ROWS * S);
  ctx.fillRect(W - 8, ROOF, 8, ROWS * S);
  // Erde neben dem Keller
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(0, ROOF + 2 * fh + 5, 8, fh);
  ctx.fillRect(W - 8, ROOF + 2 * fh + 5, 8, fh);
  ctx.fillStyle = '#51cf66';
  ctx.fillRect(0, ROOF + 2 * fh - 2, 8, 6);
  ctx.fillRect(W - 8, ROOF + 2 * fh - 2, 8, 6);
}

/* Kanalisation: Ziegel über die ganze Breite, Decke neben dem Haus, Schild */
function drawSewerBack(ctx, m, b) {
  const x0 = Math.floor(b.x0) - 4, x1 = Math.ceil(b.x1) + 4;
  ctx.fillStyle = '#4a3f37';
  ctx.fillRect(x0, SEWER_Y + 5, x1 - x0, SEWER - 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  for (let yy = SEWER_Y + 5, row = 0; yy < WATER_Y; yy += 14, row++) {
    line(ctx, x0, yy, x1, yy);
    for (let x = Math.floor(x0 / 32) * 32 + (row % 2) * 16; x < x1; x += 32) line(ctx, x, yy, x, yy + 14);
  }
  // Decke der Kanalisation links und rechts vom Haus
  ctx.fillStyle = '#6b5a48';
  ctx.fillRect(x0, SEWER_Y - 5, -x0, 10);
  ctx.fillRect(W, SEWER_Y - 5, x1 - W, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x0, SEWER_Y + 3, -x0, 2);
  ctx.fillRect(W, SEWER_Y + 3, x1 - W, 2);
  // Boden der Kanalisation
  ctx.fillStyle = '#2b2420';
  ctx.fillRect(x0, H - 2, x1 - x0, 4);

  const exitRight = m.exitCol >= COLS / 2;
  ctx.font = `bold 12px ${FONT}`;
  const label = 'KANALISATION';
  const tw = ctx.measureText(label).width + 16;
  const lx = exitRight ? 12 : W - 12 - tw;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, lx, SEWER_Y + 14, tw, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#e9f5db';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + 8, SEWER_Y + 25);
}

export function segments(m) {
  const segs = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1 && m.right[r][c]) segs.push({ x1: cx(c), y1: cy(r), x2: cx(c + 1), y2: cy(r), clog: m.right[r][c] === 2 });
      if (r < ROWS - 1 && m.down[r][c]) segs.push({ x1: cx(c), y1: cy(r), x2: cx(c), y2: cy(r + 1), clog: m.down[r][c] === 2 });
    }
  segs.push({ x1: cx(m.startCol), y1: ROOF - 14, x2: cx(m.startCol), y2: cy(0), clog: false });
  segs.push({ x1: cx(m.exitCol), y1: cy(ROWS - 1), x2: cx(m.exitCol), y2: WATER_Y - 14, clog: false });
  return segs;
}

function drawPipes(ctx, m) {
  const segs = segments(m);
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (const s of segs) tube(ctx, s, 4, 5, null);
  // Rohre mit Metallglanz
  for (const s of segs) tube(ctx, s, 0, 0, '#4f5b66');
  // Muffen an den Knoten
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (!['up', 'down', 'left', 'right'].some((d) => edgeAt(m, r, c, d) !== 0)) continue;
      joint(ctx, cx(c), cy(r));
    }
  // Auslauf in die Kanalisation
  const ex = cx(m.exitCol);
  ctx.fillStyle = '#4f5b66';
  roundRect(ctx, ex - PW * 0.75, WATER_Y - 26, PW * 1.5, 14, 4);
  ctx.fill();
  // Verstopfungen
  for (const s of segs) if (s.clog) drawClog(ctx, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
}

function tube(ctx, s, dx, dy, outline) {
  const horiz = s.y1 === s.y2;
  const x = Math.min(s.x1, s.x2) + dx, y = Math.min(s.y1, s.y2) + dy;
  const len = horiz ? Math.abs(s.x2 - s.x1) : Math.abs(s.y2 - s.y1);
  const rx = horiz ? x : x - PW / 2;
  const ry = horiz ? y - PW / 2 : y;
  const w = horiz ? len : PW;
  const h = horiz ? PW : len;
  if (!outline) {
    ctx.fillRect(rx, ry, w, h);
    return;
  }
  ctx.fillStyle = outline;
  ctx.fillRect(rx - (horiz ? 0 : 2.5), ry - (horiz ? 2.5 : 0), w + (horiz ? 0 : 5), h + (horiz ? 5 : 0));
  const g = horiz ? ctx.createLinearGradient(0, ry, 0, ry + h) : ctx.createLinearGradient(rx, 0, rx + w, 0);
  g.addColorStop(0, '#8a97a4');
  g.addColorStop(0.28, '#eef2f6');
  g.addColorStop(0.5, '#c8d0d8');
  g.addColorStop(1, '#7d8996');
  ctx.fillStyle = g;
  ctx.fillRect(rx, ry, w, h);
}

function joint(ctx, x, y) {
  const r = PW * 0.66;
  ctx.fillStyle = '#4f5b66';
  ctx.beginPath();
  ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#cfd6dd');
  g.addColorStop(1, '#7f8b97');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Schrauben
  ctx.fillStyle = '#5f6b76';
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClog(ctx, x, y) {
  // Klopapier-Knäuel
  ctx.fillStyle = '#f8f5ec';
  ctx.strokeStyle = '#cfc8b4';
  ctx.lineWidth = 1.5;
  for (const [dx, dy, r] of [[-9, -6, 8], [9, -5, 8], [-8, 7, 8], [8, 8, 8]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Durchfahrt-verboten-Schild
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2.5, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e03131';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 9, y - 3, 18, 6, 2);
  ctx.fill();
}

function drawToilet(ctx, x, floorY) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#8c99a6';
  // Spülkasten
  const tg = ctx.createLinearGradient(x + 10, 0, x + 32, 0);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(1, '#dde3e9');
  ctx.fillStyle = tg;
  roundRect(ctx, x + 10, floorY - 66, 22, 40, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#adb5bd';
  roundRect(ctx, x + 14, floorY - 62, 9, 5, 2);
  ctx.fill();
  // Fuß
  ctx.fillStyle = '#eef1f4';
  ctx.beginPath();
  ctx.moveTo(x - 14, floorY - 24);
  ctx.lineTo(x + 12, floorY - 24);
  ctx.lineTo(x + 8, floorY - 4);
  ctx.lineTo(x - 10, floorY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Schüssel
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, floorY - 28, 26, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#74c0fc';
  ctx.beginPath();
  ctx.ellipse(x, floorY - 28, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------
// Jedes Bild
// ---------------------------------------------------------------------
export function drawFrame(ctx, view, staticLayer, m, s, now, phase) {
  const b = bounds(view);
  const x0 = b.x0 - 4, x1 = b.x1 + 4;
  toWorld(ctx, view);
  // Himmel, Sonne, Wolken – über die ganze Breite
  const sky = ctx.createLinearGradient(0, Math.min(0, b.y0), 0, GROUND - 40);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(x0, b.y0 - 4, x1 - x0, GROUND - b.y0 + 8);
  const sun = ctx.createRadialGradient(34, 30, 6, 34, 30, 40);
  sun.addColorStop(0, 'rgba(255,240,150,0.9)');
  sun.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(-6, -10, 80, 80);
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.arc(34, 30, 17, 0, Math.PI * 2);
  ctx.fill();
  const span = x1 - x0 + 160;
  const clouds = Math.max(2, Math.ceil((x1 - x0) / 260));
  for (let i = 0; i < clouds; i++) {
    const speed = [9, 6, 7.5][i % 3];
    const y = [34, 70, 48][i % 3] + (i >= 3 ? rnd(i) * 20 - 10 : 0);
    const x = x0 - 80 + (((now / 1000) * speed + (i * span) / clouds) % span);
    cloud(ctx, x, y, [1, 0.8, 0.9][i % 3]);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(staticLayer, 0, 0);
  toWorld(ctx, view);

  // Rauch aus dem Schornstein
  const chX = (m.startCol >= COLS / 2 ? W * 0.2 : W * 0.74) + 13;
  for (let i = 0; i < 3; i++) {
    const p = (now / 2200 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(chX + Math.sin(p * 6 + i) * 5 + p * 14, 24 - p * 26, 5 + p * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wasser in der Kanalisation – über die ganze Breite
  const wg = ctx.createLinearGradient(0, WATER_Y, 0, H);
  wg.addColorStop(0, '#5c9e6e');
  wg.addColorStop(1, '#2f5e3e');
  ctx.fillStyle = wg;
  const wx0 = Math.floor(x0 / 8) * 8;
  ctx.beginPath();
  ctx.moveTo(wx0, H);
  for (let x = wx0; x <= x1 + 8; x += 8) ctx.lineTo(x, WATER_Y + Math.sin(x / 18 + now / 380) * 3);
  ctx.lineTo(x1 + 8, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,240,200,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    for (let x = wx0; x <= x1 + 8; x += 8) {
      const yy = WATER_Y + 14 + i * 11 + Math.sin(x / 22 - now / 300 + i * 2) * 2.5;
      if (x === wx0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Ratte paddelt vorbei
  const ratX = x1 + 40 - ((now / 1000) * 22) % (x1 - x0 + 80);
  ctx.font = `22px ${EMOJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText('🐀', ratX, WATER_Y + 4 + Math.sin(now / 200) * 2);

  // Ziel-Markierung am Auslauf
  if (phase !== 'won') {
    const bob = Math.sin(now / 250) * 4;
    const ex = cx(m.exitCol);
    const lx = ex + (m.exitCol >= COLS / 2 ? -46 : 46);
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = '#ffe066';
    ctx.fillText('Ziel', lx, SEWER_Y + 50 + bob);
    ctx.font = `20px ${EMOJI}`;
    ctx.fillText('⬇️', lx, SEWER_Y + 28 + bob);
  }

  // Spur der Wurst
  ctx.strokeStyle = 'rgba(110,62,20,0.45)';
  ctx.lineWidth = PW * 0.32;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const key of s.trail) {
    const [r, c, d] = key.split(',');
    const rr = +r, cc = +c;
    ctx.moveTo(cx(cc), rowY(rr));
    if (d === 'h') ctx.lineTo(cx(cc + 1), rowY(rr));
    else ctx.lineTo(cx(cc), rowY(rr + 1));
  }
  ctx.stroke();

  // Gestank über Verstopfungen
  ctx.strokeStyle = 'rgba(120,170,40,0.85)';
  ctx.lineWidth = 2.2;
  for (const seg of segments(m)) {
    if (!seg.clog) continue;
    const x = (seg.x1 + seg.x2) / 2, y = (seg.y1 + seg.y2) / 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let j = 0; j <= 8; j++) {
        const yy = y - 18 - j * 2;
        const xx = x + i * 8 + Math.sin(j / 1.6 + now / 180 + i) * 2.5;
        if (j === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  }

  // Wurst
  const showWurst = !(phase === 'won' && now - s.wonAt > 350);
  if (showWurst) {
    const p = wurstPos(s);
    let x = p.x, y = p.y;
    if (s.bump && now - s.bump.at < 300) x += Math.sin(now / 18) * 3;
    const inToilet = s.r < 0 && !s.moving;
    if (inToilet) y = ROOF - 40 + Math.sin(now / 300) * 2;
    const squash = s.moving ? 0.1 * Math.sin(now / 60) : 0.04 * Math.sin(now / 250);
    const sx = 1 + squash, sy = 1 - squash;
    const tilt = s.moving === 'left' ? -0.25 : s.moving === 'right' ? 0.25 : 0;
    // auf kleinen Bildschirmen (Handy quer) mindestens 32 Pixel groß
    const size = Math.max(S * 0.9, 32 / view.k), grow = size / (S * 0.9);
    ctx.save();
    ctx.translate(x, y);
    // Schatten
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(2, S * 0.3 * grow, S * 0.26 * grow, S * 0.08 * grow, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(tilt + Math.sin(now / 140) * (s.moving ? 0.12 : 0.04));
    ctx.scale(sx, sy);
    ctx.fillStyle = '#000'; // Farbe mit Transparenz würde das Emoji blass machen
    ctx.font = `${size}px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💩', 0, 2);
    ctx.restore();
  }

  // Spritzer
  for (const pt of s.particles) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Sprechblase „Verstopft!“
  if (s.bump && now - s.bump.at < 900) {
    const a = (now - s.bump.at) / 900;
    const bx = Math.min(Math.max(s.bump.x, 60), W - 60);
    const by = s.bump.y - 30 - a * 12;
    ctx.globalAlpha = a < 0.8 ? 1 : (1 - a) * 5;
    ctx.font = `bold 16px ${FONT}`;
    const tw = ctx.measureText(s.bump.text).width + 20;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e03131';
    ctx.lineWidth = 2.5;
    roundRect(ctx, bx - tw / 2, by - 15, tw, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c92a2a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.bump.text, bx, by + 1);
    ctx.globalAlpha = 1;
  }
}

/** Spritzer, wenn die Wurst ins Wasser fällt */
export function splash(s, x) {
  const colors = ['#8ce99a', '#c0eb75', '#a9e34b', '#ffffff', '#8b5a2b'];
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = 120 + Math.random() * 200;
    s.particles.push({
      x, y: WATER_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1,
      color: colors[i % colors.length], size: 2.5 + Math.random() * 3.5,
    });
  }
}

export function stepParticles(s, dt) {
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    p.life -= dt * 0.9;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------------
function cloud(ctx, x, y, k) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 17], [34, 0, 13], [17, 5, 13]]) {
    ctx.beginPath();
    ctx.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
