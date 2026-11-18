// Labyrinth-Generator (Recursive Backtracker) – erzeugt "perfekte" Labyrinthe:
// jeder Punkt ist von jedem anderen auf genau einem Weg erreichbar.

export const N = 1, E = 2, S = 4, W = 8;
export type Dir = typeof N | typeof E | typeof S | typeof W;

export const DX: Record<Dir, number> = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
export const DY: Record<Dir, number> = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPP: Record<Dir, Dir> = { [N]: S, [E]: W, [S]: N, [W]: E };
export const DIRS: Dir[] = [N, E, S, W];

export interface Cell { x: number; y: number }

export interface Maze {
  w: number;
  h: number;
  /** Bitmaske je Zelle: gesetztes Bit = Durchgang offen in diese Richtung */
  open: number[];
  start: Cell;
  goal: Cell;
  stars: Cell[];
}

export const idx = (m: { w: number }, x: number, y: number) => y * m.w + x;

export function canMove(m: Maze, c: Cell, d: Dir) {
  return (m.open[idx(m, c.x, c.y)] & d) !== 0;
}

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Abstand jeder Zelle zum Start (Breitensuche) */
function distances(m: Pick<Maze, "w" | "h" | "open">, from: Cell) {
  const dist = new Array(m.w * m.h).fill(-1);
  const q: Cell[] = [from];
  dist[idx(m, from.x, from.y)] = 0;
  while (q.length) {
    const c = q.shift()!;
    for (const d of DIRS) {
      if (!(m.open[idx(m, c.x, c.y)] & d)) continue;
      const nx = c.x + DX[d], ny = c.y + DY[d];
      const i = idx(m, nx, ny);
      if (dist[i] === -1) {
        dist[i] = dist[idx(m, c.x, c.y)] + 1;
        q.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

export function generateMaze(w: number, h: number, starCount = 3): Maze {
  const open = new Array(w * h).fill(0);
  const seen = new Array(w * h).fill(false);
  const stack: Cell[] = [{ x: 0, y: 0 }];
  seen[0] = true;

  while (stack.length) {
    const c = stack[stack.length - 1];
    const next = shuffle([...DIRS]).find((d) => {
      const nx = c.x + DX[d], ny = c.y + DY[d];
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
    });
    if (next === undefined) {
      stack.pop();
      continue;
    }
    const nx = c.x + DX[next], ny = c.y + DY[next];
    open[c.y * w + c.x] |= next;
    open[ny * w + nx] |= OPP[next];
    seen[ny * w + nx] = true;
    stack.push({ x: nx, y: ny });
  }

  // Ein paar Extra-Durchgänge: Sackgassen werden seltener, das Labyrinth
  // fuehlt sich fuer Kinder weniger frustrierend an.
  const extra = Math.floor((w * h) / 12);
  for (let k = 0; k < extra; k++) {
    const x = Math.floor(Math.random() * w), y = Math.floor(Math.random() * h);
    const d = DIRS[Math.floor(Math.random() * 4)];
    const nx = x + DX[d], ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    open[y * w + x] |= d;
    open[ny * w + nx] |= OPP[d];
  }

  const start = { x: 0, y: 0 };
  const goal = { x: w - 1, y: h - 1 };

  // Sterne bevorzugt in Sackgassen und weiter entfernten Ecken verstecken
  const dist = distances({ w, h, open }, start);
  const candidates: Cell[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if ((x === start.x && y === start.y) || (x === goal.x && y === goal.y)) continue;
      if (dist[y * w + x] < 2) continue;
      candidates.push({ x, y });
    }
  const isDeadEnd = (c: Cell) =>
    DIRS.filter((d) => open[c.y * w + c.x] & d).length === 1;
  shuffle(candidates).sort((a, b) => Number(isDeadEnd(b)) - Number(isDeadEnd(a)));

  const stars: Cell[] = [];
  for (const c of candidates) {
    if (stars.length >= starCount) break;
    // Sterne nicht direkt nebeneinander
    if (stars.some((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) < 3)) continue;
    stars.push(c);
  }

  return { w, h, open, start, goal, stars };
}
