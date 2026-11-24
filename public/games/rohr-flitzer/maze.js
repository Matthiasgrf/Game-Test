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

/** Tempo der Wurst in Zellen pro Sekunde (bergab schneller, bergauf langsamer) */
export const SPEED = { down: 5.5, up: 3.5, left: 4.2, right: 4.2 };

/** Bestzeit in Sekunden bei perfektem Spiel: schnellster Weg vom Klo bis in die Kanalisation (Dijkstra). */
export function bestTime(m) {
  const key = (r, c) => r * COLS + c;
  const done = new Set();
  const open = [[1 / SPEED.down, 0, m.startCol]]; // Spülung: aus dem Klo ins erste Rohr
  while (open.length) {
    let i = 0;
    for (let j = 1; j < open.length; j++) if (open[j][0] < open[i][0]) i = j;
    const [t, r, c] = open.splice(i, 1)[0];
    if (done.has(key(r, c))) continue;
    done.add(key(r, c));
    if (r === ROWS - 1 && c === m.exitCol) return t + 1 / SPEED.down;
    for (const d of DIRS) {
      if (edgeAt(m, r, c, d) !== 1) continue;
      const nr = r + DELTA[d][0];
      const nc = c + DELTA[d][1];
      if (nr < 0 || nr >= ROWS || done.has(key(nr, nc))) continue;
      open.push([t + 1 / SPEED[d], nr, nc]);
    }
  }
  return Infinity;
}

/** Ziel-Bestzeit: jedes Rohrsystem ist perfekt gespielt etwa gleich schnell (etwa 5,15 s),
 *  sehr gute Spieler schaffen damit etwa 5,5 s, gute etwa 6 s. */
export const TARGET_TIME = 5.2;
export const TIME_TOLERANCE = 0.1;

/**
 * Erzeugt ein neues Rohrsystem, dessen Bestzeit nahe TARGET_TIME liegt –
 * so hängt die Zeit für die Bestenliste kaum vom Zufall ab.
 */
export function generateMaze(rng = Math.random) {
  let best = null;
  for (let i = 0; i < 400; i++) {
    const m = build(rng);
    m.best = bestTime(m);
    if (Math.abs(m.best - TARGET_TIME) <= TIME_TOLERANCE) return m;
    if (!best || Math.abs(m.best - TARGET_TIME) < Math.abs(best.best - TARGET_TIME)) best = m;
  }
  return best;
}
