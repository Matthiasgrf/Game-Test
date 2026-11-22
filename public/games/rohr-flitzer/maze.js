// =====================================================================
// Rohr-Flitzer: Labyrinth aus Abflussrohren (unverändert aus der früheren React-Fassung, ohne TypeScript)
//   Raster aus Zellen (Rohr-Knoten). Zwischen zwei Nachbarzellen gibt es
//   entweder kein Rohr, ein offenes Rohr oder ein verstopftes Rohr.
//   Start: Klo oben im Dachgeschoss, Ziel: Ausgang unten in die Kanalisation.
// =====================================================================

export const COLS = 6;
export const ROWS = 9;
export const ROWS_PER_FLOOR = 3;
export const FLOORS = ["🛁 Badezimmer", "🍳 Küche", "🧺 Keller"];
/** Höchstzahl verstopfter Rohre */
const MAX_CLOGS = 5;

/* Richtungen: "up" | "down" | "left" | "right"
   Rohr (Edge): 0 = kein Rohr, 1 = offen, 2 = verstopft
   Maze: { right[r][c]: Rohr zwischen (r,c) und (r,c+1), down[r][c]: Rohr zwischen (r,c) und (r+1,c)
           (letzte Zeile = Ausgang), startCol, exitCol, shortest: Länge des kürzesten Wegs (in Zellen) } */

export const DELTA = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

/** Zustand des Rohrs von Zelle (r,c) in Richtung dir. r === ROWS ist die Kanalisation. */
export function edgeAt(m, r, c, dir) {
  switch (dir) {
    case "right":
      return c < COLS - 1 ? m.right[r][c] : 0;
    case "left":
      return c > 0 ? m.right[r][c - 1] : 0;
    case "down":
      return r < ROWS ? m.down[r][c] : 0;
    case "up":
      return r > 0 ? m.down[r - 1][c] : 0;
  }
}

function setEdge(m, r, c, dir, v) {
  if (dir === "right") m.right[r][c] = v;
  else if (dir === "left") m.right[r][c - 1] = v;
  else if (dir === "down") m.down[r][c] = v;
  else m.down[r - 1][c] = v;
}

export const DIRS = ["up", "down", "left", "right"];
export const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

/** Alle offenen (nicht verstopften) Richtungen an einer Zelle */
export const openDirs = (m, r, c) => DIRS.filter((d) => edgeAt(m, r, c, d) === 1);

/** Kürzester Weg vom Klo bis in die Kanalisation (Liste von Zellen) oder null. */
export function shortestPath(m) {
  const prev = new Map();
  const key = (r, c) => r * COLS + c;
  const start = key(0, m.startCol);
  prev.set(start, -1);
  const queue = [[0, m.startCol]];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === ROWS - 1 && c === m.exitCol) {
      const path = [];
      let k = key(r, c);
      while (k !== -1) {
        path.unshift([Math.floor(k / COLS), k % COLS]);
        k = prev.get(k);
      }
      return path;
    }
    for (const d of DIRS) {
      if (edgeAt(m, r, c, d) !== 1) continue;
      const nr = r + DELTA[d][0];
      const nc = c + DELTA[d][1];
      if (nr < 0 || nr >= ROWS) continue;
      const k = key(nr, nc);
      if (prev.has(k)) continue;
      prev.set(k, key(r, c));
      queue.push([nr, nc]);
    }
  }
  return null;
}

function dirBetween(a, b) {
  if (b[0] > a[0]) return "down";
  if (b[0] < a[0]) return "up";
  return b[1] > a[1] ? "right" : "left";
}

function build(rng) {
  const right = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const down = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const startCol = Math.floor(rng() * COLS);
  const exitCol = Math.floor(rng() * COLS);
  const m = { right, down, startCol, exitCol, shortest: 0 };

  // 1) Zufälliges perfektes Labyrinth (Tiefensuche). Seitliche Rohre werden
  //    leicht bevorzugt, damit es ordentlich verwinkelt wird.
  const weight = { down: 2, left: 3, right: 3, up: 1.2 };
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const stack = [[0, startCol]];
  seen[0][startCol] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const nr = r + DELTA[d][0];
      const nc = c + DELTA[d][1];
      return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !seen[nr][nc];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const total = options.reduce((s, d) => s + weight[d], 0);
    let x = rng() * total;
    let pick = options[0];
    for (const d of options) {
      x -= weight[d];
      if (x <= 0) {
        pick = d;
        break;
      }
    }
    setEdge(m, r, c, pick, 1);
    const nr = r + DELTA[pick][0];
    const nc = c + DELTA[pick][1];
    seen[nr][nc] = true;
    stack.push([nr, nc]);
  }

  // 2) Ein paar Zusatzrohre -> Schleifen, damit es Umwege um Verstopfungen gibt
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1 && right[r][c] === 0 && rng() < 0.14) right[r][c] = 1;
      if (r < ROWS - 1 && down[r][c] === 0 && rng() < 0.14) down[r][c] = 1;
    }

  // Ausgang in die Kanalisation
  down[ROWS - 1][exitCol] = 1;

  // 3) Verstopfungen: bevorzugt auf dem aktuell kürzesten Weg, aber nur,
  //    wenn danach noch ein Weg existiert. So muss man Umwege suchen.
  let clogs = 0;
  for (let tries = 0; tries < 400 && clogs < MAX_CLOGS; tries++) {
    const path = shortestPath(m);
    let r, c, d;
    if (rng() < 0.75 && path.length > 3) {
      const i = 1 + Math.floor(rng() * (path.length - 2));
      d = dirBetween(path[i], path[i + 1] ?? path[i]);
      [r, c] = path[i];
      if (r === ROWS - 1 && c === exitCol && d === "down") continue;
    } else {
      r = Math.floor(rng() * ROWS);
      c = Math.floor(rng() * COLS);
      d = DIRS[Math.floor(rng() * 4)];
    }
    if (edgeAt(m, r, c, d) !== 1) continue;
    if (d === "down" && r === ROWS - 1) continue; // Ausgang nie verstopfen
    if (d === "up" && r === 0) continue;
    setEdge(m, r, c, d, 2);
    if (shortestPath(m)) clogs++;
    else setEdge(m, r, c, d, 1);
  }

  m.shortest = shortestPath(m).length;
  return m;
}

/**
 * Erzeugt ein neues Rohrsystem. Die Weglänge wird so gewählt, dass eine Runde
 * für Kinder etwa 20–30 Sekunden dauert.
 */
export function generateMaze(rng = Math.random) {
  let best = null;
  for (let i = 0; i < 80; i++) {
    const m = build(rng);
    if (m.shortest >= 24 && m.shortest <= 32) return m;
    if (!best || Math.abs(m.shortest - 28) < Math.abs(best.shortest - 28)) best = m;
  }
  return best;
}
