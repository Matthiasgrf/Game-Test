// =====================================================================
// Rohr-Flitzer: Zeichnen
//   renderStatic(): Haus, Zimmer, Rohre, Verstopfungen – einmal pro Rohrsystem
//   drawFrame():    Himmel, Rauch, Wasser, Spur, Gestank, Wurst, Effekte – jedes Bild
// Alle Maße in logischen Pixeln; die Skalierung auf den Bildschirm macht k.
// =====================================================================
import { COLS, DELTA, FLOORS, ROWS, ROWS_PER_FLOOR, edgeAt, type Dir, type Maze } from "./maze";

export const S = 64; // Zellgröße
export const M = 18; // Rand (Hauswand)
export const ROOF = 132; // Dachboden mit Klo
export const SEWER = 100; // Kanalisation
export const W = M * 2 + COLS * S;
export const H = ROOF + ROWS * S + SEWER;
const PW = S * 0.46; // Rohrdicke
const SEWER_Y = ROOF + ROWS * S;
const WATER_Y = H - 38;

export const cx = (c: number) => M + c * S + S / 2;
export const cy = (r: number) => ROOF + r * S + S / 2;
/** y-Mitte einer Zeile; -1 = Klo, ROWS = Wasser der Kanalisation */
const rowY = (r: number) => (r < 0 ? ROOF - 30 : r >= ROWS ? WATER_Y + 6 : cy(r));

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const FONT = '"Trebuchet MS","Chalkboard SE","Comic Sans MS",system-ui,sans-serif';

export type Phase = "ready" | "playing" | "won";

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
}

export interface Sim {
  r: number; c: number; // Ziel der aktuellen Bewegung bzw. aktuelle Zelle
  fr: number; fc: number; // Start der aktuellen Bewegung
  t: number; // Fortschritt 0..1
  moving: Dir | null;
  queued: Dir | null; // gewünschte Richtung für die nächste Abzweigung
  trail: Set<string>;
  bump: { x: number; y: number; at: number; text: string } | null;
  start: number;
  wonAt: number;
  particles: Particle[];
}

export function freshSim(m: Maze): Sim {
  return {
    r: -1, c: m.startCol, fr: -1, fc: m.startCol, t: 1, moving: null, queued: null,
    trail: new Set(), bump: null, start: 0, wonAt: 0, particles: [],
  };
}

/** Aktuelle Position der Wurst in logischen Pixeln */
export function wurstPos(s: Sim): { x: number; y: number } {
  const t = s.moving ? s.t : 1;
  return {
    x: cx(s.fc) + (cx(s.c) - cx(s.fc)) * t,
    y: rowY(s.fr) + (rowY(s.r) - rowY(s.fr)) * t,
  };
}

/** Mitte des Rohrs von Zelle (r,c) in Richtung d */
export const edgeMid = (r: number, c: number, d: Dir) => ({
  x: (cx(c) + cx(c + DELTA[d][1])) / 2,
  y: (rowY(r) + rowY(r + DELTA[d][0])) / 2,
});

// ---------------------------------------------------------------------
// Statische Ebene
// ---------------------------------------------------------------------
export function renderStatic(m: Maze, k: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(k, 0, 0, k, 0, 0);

  drawRoof(ctx, m);
  drawRooms(ctx);
  drawSewerBack(ctx, m);
  drawPipes(ctx, m);
  drawToilet(ctx, cx(m.startCol), ROOF);
  return cv;
}

function drawRoof(ctx: CanvasRenderingContext2D, m: Maze) {
  const apex = 14;
  // Schornstein (hinter dem Dach), nicht über dem Klo
  const chX = m.startCol >= COLS / 2 ? W * 0.2 : W * 0.74;
  ctx.fillStyle = "#9c4a33";
  ctx.fillRect(chX, 30, 26, 70);
  ctx.fillStyle = "#6d2f1f";
  ctx.fillRect(chX - 4, 26, 34, 9);

  // Dachboden (innen)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-14, ROOF);
  ctx.lineTo(W / 2, apex);
  ctx.lineTo(W + 14, ROOF);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, apex, 0, ROOF);
  g.addColorStop(0, "#f2614a");
  g.addColorStop(1, "#c9432c");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Dachziegel
  ctx.strokeStyle = "rgba(90,20,10,0.28)";
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
  ctx.fillStyle = "#f7e6cc";
  ctx.fill();
  ctx.strokeStyle = "rgba(120,80,40,0.18)";
  ctx.lineWidth = 1;
  for (let x = 30; x < W; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, apex + 20);
    ctx.lineTo(x, ROOF);
    ctx.stroke();
  }
  ctx.restore();
  // Dachkante
  ctx.strokeStyle = "#7a2414";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-14, ROOF);
  ctx.lineTo(W / 2, apex);
  ctx.lineTo(W + 14, ROOF);
  ctx.stroke();

  // Hausschild
  const sw = 196, sh = 34, sx = W / 2 - sw / 2, sy = 22;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRect(ctx, sx + 2, sy + 3, sw, sh, 8);
  ctx.fill();
  const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
  sg.addColorStop(0, "#fffaf0");
  sg.addColorStop(1, "#f3e2c3");
  ctx.fillStyle = sg;
  ctx.strokeStyle = "#7b4a22";
  ctx.lineWidth = 3;
  roundRect(ctx, sx, sy, sw, sh, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5c3416";
  ctx.font = `bold 19px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Haus Buchhammer", W / 2, sy + sh / 2 + 1);
}

function drawRooms(ctx: CanvasRenderingContext2D) {
  const fh = ROWS_PER_FLOOR * S;
  const deco = [
    ["🛁", "🪥"],
    ["🍳", "🪴"],
    ["🧺", "🕸️"],
  ];
  for (let f = 0; f < FLOORS.length; f++) {
    const y = ROOF + f * fh;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, fh);
    ctx.clip();
    if (f === 0) {
      // Bad: Fliesen
      ctx.fillStyle = "#e3f4fb";
      ctx.fillRect(0, y, W, fh);
      ctx.fillStyle = "#c6e7f5";
      ctx.fillRect(0, y + fh * 0.55, W, fh * 0.45);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      for (let x = 0; x < W; x += 22) line(ctx, x, y, x, y + fh);
      for (let yy = y; yy < y + fh; yy += 22) line(ctx, 0, yy, W, yy);
    } else if (f === 1) {
      // Küche: Streifentapete + Fliesenspiegel
      ctx.fillStyle = "#fff3d1";
      ctx.fillRect(0, y, W, fh);
      ctx.fillStyle = "rgba(255,190,110,0.22)";
      for (let x = 0; x < W; x += 28) ctx.fillRect(x, y, 12, fh);
      for (let x = 0, i = 0; x < W; x += 16, i++)
        for (let yy = y + fh * 0.62, j = 0; yy < y + fh; yy += 16, j++) {
          ctx.fillStyle = (i + j) % 2 ? "#ffffff" : "#ffd8a8";
          ctx.fillRect(x, yy, 16, 16);
        }
      // Fenster
      ctx.fillStyle = "#a5d8ff";
      roundRect(ctx, W * 0.42, y + 18, 70, 52, 4);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 5;
      ctx.stroke();
      line(ctx, W * 0.42 + 35, y + 18, W * 0.42 + 35, y + 70);
      line(ctx, W * 0.42, y + 44, W * 0.42 + 70, y + 44);
    } else {
      // Keller: Ziegel
      ctx.fillStyle = "#d9d2c5";
      ctx.fillRect(0, y, W, fh);
      ctx.strokeStyle = "rgba(120,95,70,0.3)";
      ctx.lineWidth = 1.5;
      for (let yy = y, row = 0; yy < y + fh; yy += 16, row++) {
        line(ctx, 0, yy, W, yy);
        for (let x = (row % 2) * 18; x < W; x += 36) line(ctx, x, yy, x, yy + 16);
      }
    }
    // Einrichtung (blass, hinter den Rohren)
    ctx.globalAlpha = 0.45;
    ctx.font = `52px ${EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(deco[f][0], W * 0.2, y + fh * 0.62);
    ctx.fillText(deco[f][1], W * 0.82, y + fh * 0.5);
    ctx.globalAlpha = 1;
    ctx.restore();

  }
  // Decken / Böden
  for (let f = 0; f <= FLOORS.length; f++) {
    const y = ROOF + f * fh;
    ctx.fillStyle = f === FLOORS.length ? "#6b5a48" : "#b07a4f";
    ctx.fillRect(0, y - 5, W, 10);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, y + 3, W, 2);
  }
  // Außenwände
  ctx.fillStyle = "#8d6e63";
  ctx.fillRect(0, ROOF, 8, ROWS * S);
  ctx.fillRect(W - 8, ROOF, 8, ROWS * S);
  // Erde neben dem Keller
  ctx.fillStyle = "#7a5a3a";
  ctx.fillRect(0, ROOF + 2 * fh + 5, 8, fh);
  ctx.fillRect(W - 8, ROOF + 2 * fh + 5, 8, fh);
  ctx.fillStyle = "#51cf66";
  ctx.fillRect(0, ROOF + 2 * fh - 2, 8, 6);
  ctx.fillRect(W - 8, ROOF + 2 * fh - 2, 8, 6);
}

function drawSewerBack(ctx: CanvasRenderingContext2D, m: Maze) {
  ctx.fillStyle = "#4a3f37";
  ctx.fillRect(0, SEWER_Y + 5, W, SEWER);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  for (let yy = SEWER_Y + 5, row = 0; yy < WATER_Y; yy += 14, row++) {
    line(ctx, 0, yy, W, yy);
    for (let x = (row % 2) * 16; x < W; x += 32) line(ctx, x, yy, x, yy + 14);
  }
  const exitRight = m.exitCol >= COLS / 2;
  ctx.font = `bold 12px ${FONT}`;
  const label = "KANALISATION";
  const tw = ctx.measureText(label).width + 16;
  const lx = exitRight ? 12 : W - 12 - tw;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundRect(ctx, lx, SEWER_Y + 14, tw, 22, 11);
  ctx.fill();
  ctx.fillStyle = "#e9f5db";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, lx + 8, SEWER_Y + 25);
}

type Seg = { x1: number; y1: number; x2: number; y2: number; clog: boolean };

export function segments(m: Maze): Seg[] {
  const segs: Seg[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1 && m.right[r][c]) segs.push({ x1: cx(c), y1: cy(r), x2: cx(c + 1), y2: cy(r), clog: m.right[r][c] === 2 });
      if (r < ROWS - 1 && m.down[r][c]) segs.push({ x1: cx(c), y1: cy(r), x2: cx(c), y2: cy(r + 1), clog: m.down[r][c] === 2 });
    }
  segs.push({ x1: cx(m.startCol), y1: ROOF - 14, x2: cx(m.startCol), y2: cy(0), clog: false });
  segs.push({ x1: cx(m.exitCol), y1: cy(ROWS - 1), x2: cx(m.exitCol), y2: WATER_Y - 14, clog: false });
  return segs;
}

function drawPipes(ctx: CanvasRenderingContext2D, m: Maze) {
  const segs = segments(m);
  // Schatten
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  for (const s of segs) tube(ctx, s, 4, 5, null);
  // Rohre mit Metallglanz
  for (const s of segs) tube(ctx, s, 0, 0, "#4f5b66");
  // Muffen an den Knoten
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (!(["up", "down", "left", "right"] as Dir[]).some((d) => edgeAt(m, r, c, d) !== 0)) continue;
      joint(ctx, cx(c), cy(r));
    }
  // Auslauf in die Kanalisation
  const ex = cx(m.exitCol);
  ctx.fillStyle = "#4f5b66";
  roundRect(ctx, ex - PW * 0.75, WATER_Y - 26, PW * 1.5, 14, 4);
  ctx.fill();
  // Verstopfungen
  for (const s of segs) if (s.clog) drawClog(ctx, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
}

function tube(ctx: CanvasRenderingContext2D, s: Seg, dx: number, dy: number, outline: string | null) {
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
  g.addColorStop(0, "#8a97a4");
  g.addColorStop(0.28, "#eef2f6");
  g.addColorStop(0.5, "#c8d0d8");
  g.addColorStop(1, "#7d8996");
  ctx.fillStyle = g;
  ctx.fillRect(rx, ry, w, h);
}

function joint(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = PW * 0.66;
  ctx.fillStyle = "#4f5b66";
  ctx.beginPath();
  ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#cfd6dd");
  g.addColorStop(1, "#7f8b97");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Schrauben
  ctx.fillStyle = "#5f6b76";
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClog(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Klopapier-Knäuel
  ctx.fillStyle = "#f8f5ec";
  ctx.strokeStyle = "#cfc8b4";
  ctx.lineWidth = 1.5;
  for (const [dx, dy, r] of [[-9, -6, 8], [9, -5, 8], [-8, 7, 8], [8, 8, 8]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Durchfahrt-verboten-Schild
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2.5, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e03131";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x - 9, y - 3, 18, 6, 2);
  ctx.fill();
}

function drawToilet(ctx: CanvasRenderingContext2D, x: number, floorY: number) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#8c99a6";
  // Spülkasten
  const tg = ctx.createLinearGradient(x + 10, 0, x + 32, 0);
  tg.addColorStop(0, "#ffffff");
  tg.addColorStop(1, "#dde3e9");
  ctx.fillStyle = tg;
  roundRect(ctx, x + 10, floorY - 66, 22, 40, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#adb5bd";
  roundRect(ctx, x + 14, floorY - 62, 9, 5, 2);
  ctx.fill();
  // Fuß
  ctx.fillStyle = "#eef1f4";
  ctx.beginPath();
  ctx.moveTo(x - 14, floorY - 24);
  ctx.lineTo(x + 12, floorY - 24);
  ctx.lineTo(x + 8, floorY - 4);
  ctx.lineTo(x - 10, floorY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Schüssel
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x, floorY - 28, 26, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#74c0fc";
  ctx.beginPath();
  ctx.ellipse(x, floorY - 28, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------
// Jedes Bild
// ---------------------------------------------------------------------
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  k: number,
  staticLayer: HTMLCanvasElement,
  m: Maze,
  s: Sim,
  now: number,
  phase: Phase,
) {
  ctx.setTransform(k, 0, 0, k, 0, 0);
  // Himmel, Sonne, Wolken
  const sky = ctx.createLinearGradient(0, 0, 0, ROOF);
  sky.addColorStop(0, "#74c0fc");
  sky.addColorStop(1, "#d0ebff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ROOF);
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(34, 30, 17, 0, Math.PI * 2);
  ctx.fill();
  for (const [speed, y, size, off] of [[9, 34, 1, 0], [6, 70, 0.8, 220]] as const) {
    const x = ((now / 1000) * speed + off) % (W + 120) - 60;
    cloud(ctx, x, y, size);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(staticLayer, 0, 0);
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // Rauch aus dem Schornstein
  const chX = (m.startCol >= COLS / 2 ? W * 0.2 : W * 0.74) + 13;
  for (let i = 0; i < 3; i++) {
    const p = ((now / 2200 + i / 3) % 1);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(chX + Math.sin(p * 6 + i) * 5 + p * 14, 24 - p * 26, 5 + p * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wasser in der Kanalisation
  const wg = ctx.createLinearGradient(0, WATER_Y, 0, H);
  wg.addColorStop(0, "#5c9e6e");
  wg.addColorStop(1, "#2f5e3e");
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, WATER_Y + Math.sin(x / 18 + now / 380) * 3);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(200,240,200,0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const yy = WATER_Y + 14 + i * 11 + Math.sin(x / 22 - now / 300 + i * 2) * 2.5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Ratte paddelt vorbei
  const ratX = W + 40 - ((now / 1000) * 22) % (W + 80);
  ctx.font = `22px ${EMOJI}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText("🐀", ratX, WATER_Y + 4 + Math.sin(now / 200) * 2);

  // Ziel-Markierung am Auslauf
  if (phase !== "won") {
    const bob = Math.sin(now / 250) * 4;
    const ex = cx(m.exitCol);
    const lx = ex + (m.exitCol >= COLS / 2 ? -46 : 46);
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = "#ffe066";
    ctx.fillText("Ziel", lx, SEWER_Y + 50 + bob);
    ctx.font = `20px ${EMOJI}`;
    ctx.fillText("⬇️", lx, SEWER_Y + 28 + bob);
  }

  // Spur der Wurst
  ctx.strokeStyle = "rgba(110,62,20,0.45)";
  ctx.lineWidth = PW * 0.32;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const key of s.trail) {
    const [r, c, d] = key.split(",");
    const rr = +r, cc = +c;
    ctx.moveTo(cx(cc), rowY(rr));
    if (d === "h") ctx.lineTo(cx(cc + 1), rowY(rr));
    else ctx.lineTo(cx(cc), rowY(rr + 1));
  }
  ctx.stroke();

  // Gestank über Verstopfungen
  ctx.strokeStyle = "rgba(120,170,40,0.85)";
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
  const showWurst = !(phase === "won" && now - s.wonAt > 350);
  if (showWurst) {
    const p = wurstPos(s);
    let x = p.x, y = p.y;
    if (s.bump && now - s.bump.at < 300) x += Math.sin(now / 18) * 3;
    const inToilet = s.r < 0 && !s.moving;
    if (inToilet) y = ROOF - 40 + Math.sin(now / 300) * 2;
    const squash = s.moving ? 0.1 * Math.sin(now / 60) : 0.04 * Math.sin(now / 250);
    const sx = 1 + squash, sy = 1 - squash;
    const tilt = s.moving === "left" ? -0.25 : s.moving === "right" ? 0.25 : 0;
    ctx.save();
    ctx.translate(x, y);
    // Schatten
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(2, S * 0.3, S * 0.26, S * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(tilt + Math.sin(now / 140) * (s.moving ? 0.12 : 0.04));
    ctx.scale(sx, sy);
    ctx.fillStyle = "#000"; // Farbe mit Transparenz würde das Emoji blass machen
    ctx.font = `${S * 0.9}px ${EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💩", 0, 2);
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

  // Sprechblase "Verstopft!"
  if (s.bump && now - s.bump.at < 900) {
    const a = (now - s.bump.at) / 900;
    const bx = Math.min(Math.max(s.bump.x, 60), W - 60);
    const by = s.bump.y - 30 - a * 12;
    ctx.globalAlpha = a < 0.8 ? 1 : (1 - a) * 5;
    ctx.font = `bold 16px ${FONT}`;
    const tw = ctx.measureText(s.bump.text).width + 20;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e03131";
    ctx.lineWidth = 2.5;
    roundRect(ctx, bx - tw / 2, by - 15, tw, 30, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c92a2a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.bump.text, bx, by + 1);
    ctx.globalAlpha = 1;
  }
}

/** Spritzer, wenn die Wurst ins Wasser fällt */
export function splash(s: Sim, x: number) {
  const colors = ["#8ce99a", "#c0eb75", "#a9e34b", "#ffffff", "#8b5a2b"];
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = 120 + Math.random() * 200;
    s.particles.push({
      x, y: WATER_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1,
      color: colors[i % colors.length], size: 2.5 + Math.random() * 3.5,
    });
  }
}

export function stepParticles(s: Sim, dt: number) {
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    p.life -= dt * 0.9;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}

// ---------------------------------------------------------------------
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 17], [34, 0, 13], [17, 5, 13]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * k, y + dy * k, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
