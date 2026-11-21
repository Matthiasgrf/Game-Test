import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  COLS,
  DELTA,
  FLOORS,
  ROWS,
  ROWS_PER_FLOOR,
  edgeAt,
  generateMaze,
  type Dir,
  type Maze,
} from "../game/rohrMaze";

// ---------- Layout (logische Pixel, Canvas wird per CSS skaliert) ------
const S = 34; // Zellgröße
const M = 16; // Rand links/rechts (Hauswand)
const ROOF = 92; // Dach + Klo oben
const SEWER = 64; // Kanalisation unten
const W = M * 2 + COLS * S;
const H = ROOF + ROWS * S + SEWER;
const TIME_LIMIT = 60; // Sekunden, danach ist das Rohr "eingetrocknet"
const SIGHT = 2.3; // Sichtweite in Zellen – der Rest der Rohre liegt im Dunkeln

const SPEED: Record<Dir, number> = { down: 9, left: 6, right: 6, up: 4 }; // Zellen/s

const cx = (c: number) => M + c * S + S / 2;
const cy = (r: number) => ROOF + r * S + S / 2;

type Phase = "ready" | "playing" | "won" | "lost";

interface Sim {
  r: number;
  c: number;
  fr: number; // Startzelle der aktuellen Bewegung
  fc: number;
  t: number; // Fortschritt 0..1
  moving: Dir | null;
  held: Dir[]; // gedrückte Richtungen, zuletzt gedrückt = hinten
  buffered: { dir: Dir; at: number } | null; // kurzer Tipp merken
  trail: Set<string>;
  revealed: Set<number>; // schon gesehene Zellen (r*COLS+c)
  bump: { x: number; y: number; at: number } | null;
  start: number;
  end: number;
  splashAt: number;
}

const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

function reveal(s: Sim) {
  const r0 = Math.min(s.r, ROWS - 1);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (Math.hypot(r - r0, c - s.c) <= SIGHT) s.revealed.add(r * COLS + c);
}

function freshSim(m: Maze): Sim {
  const s: Sim = {
    r: 0, c: m.startCol, fr: -1, fc: m.startCol, t: 0, moving: null,
    held: [], buffered: null, trail: new Set(), revealed: new Set(), bump: null, start: 0, end: 0, splashAt: 0,
  };
  reveal(s);
  return s;
}

export default function RohrFlitzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mazeRef = useRef<Maze>(null as unknown as Maze);
  if (!mazeRef.current) mazeRef.current = generateMaze();
  const sim = useRef<Sim>(freshSim(mazeRef.current));
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const changePhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ---------- Steuerung --------------------------------------------
  const press = useCallback((d: Dir) => {
    const s = sim.current;
    s.held = s.held.filter((x) => x !== d).concat(d);
    s.buffered = { dir: d, at: performance.now() };
  }, []);
  const release = useCallback((d: Dir) => {
    sim.current.held = sim.current.held.filter((x) => x !== d);
  }, []);

  const start = useCallback(() => {
    if (phaseRef.current === "playing") return;
    if (phaseRef.current !== "ready") {
      mazeRef.current = generateMaze();
    }
    const s = freshSim(mazeRef.current);
    s.start = performance.now();
    // Spülung: die Wurst plumpst aus dem Klo in das erste Rohr
    s.fr = -1;
    s.fc = mazeRef.current.startCol;
    s.r = 0;
    s.moving = "down";
    reveal(s);
    sim.current = s;
    setSaveMsg(null);
    setElapsed(0);
    changePhase("playing");
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if (phaseRef.current !== "playing") {
          e.preventDefault();
          start();
        }
        return;
      }
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      if (!e.repeat) press(d);
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) release(d);
    };
    const blur = () => (sim.current.held = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [press, release, start]);

  // Wischen auf dem Spielfeld (Handy)
  const swipe = useRef<{ x: number; y: number; dir: Dir | null } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, dir: null };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sw = swipe.current;
    if (!sw) return;
    const dx = e.clientX - sw.x;
    const dy = e.clientY - sw.y;
    if (Math.hypot(dx, dy) < 18) return;
    const d: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    if (d !== sw.dir) {
      if (sw.dir) release(sw.dir);
      press(d);
      sw.dir = d;
    }
    sw.x = e.clientX;
    sw.y = e.clientY;
  };
  const onPointerUp = () => {
    if (swipe.current?.dir) release(swipe.current.dir);
    swipe.current = null;
  };

  // ---------- Spielschleife -----------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    let raf = 0;
    let last = performance.now();
    let lastUi = 0;

    const tryMove = (s: Sim, m: Maze, d: Dir, now: number): boolean => {
      const e = edgeAt(m, s.r, s.c, d);
      if (e === 1) {
        s.fr = s.r;
        s.fc = s.c;
        s.r += DELTA[d][0];
        s.c += DELTA[d][1];
        s.t = 0;
        s.moving = d;
        return true;
      }
      if (e === 2 && (!s.bump || now - s.bump.at > 500)) {
        s.bump = {
          x: (cx(s.c) + cx(s.c + DELTA[d][1])) / 2,
          y: (cy(s.r) + cy(s.r + DELTA[d][0])) / 2,
          at: now,
        };
      }
      return false;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = sim.current;
      const m = mazeRef.current;
      const ph = phaseRef.current;

      if (ph === "playing") {
        if (s.moving) {
          s.t += SPEED[s.moving] * dt;
          if (s.t >= 1) {
            if (s.fr >= 0) s.trail.add(`${Math.min(s.fr, s.r)},${Math.min(s.fc, s.c)},${s.fr === s.r ? "h" : "v"}`);
            s.t = 1;
            s.moving = null;
            reveal(s);
            if (s.r === ROWS) {
              // Platsch – angekommen in der Kanalisation!
              s.end = now;
              s.splashAt = now;
              changePhase("won");
              const ms = Math.round(s.end - s.start);
              setElapsed(ms / 1000);
              supabase
                .from("rohr_scores")
                .insert({ time_ms: ms })
                .then(({ error }) =>
                  setSaveMsg(error ? `Fehler beim Speichern: ${error.message}` : "Zeit gespeichert ✔"),
                );
            }
          }
        }
        if (!s.moving && phaseRef.current === "playing") {
          let moved = false;
          if (s.buffered && now - s.buffered.at < 250) {
            moved = tryMove(s, m, s.buffered.dir, now);
            if (moved) s.buffered = null;
          }
          for (let i = s.held.length - 1; i >= 0 && !moved; i--) moved = tryMove(s, m, s.held[i], now);
          // Schwerkraft: ohne "hoch" rutscht die Wurst nach unten
          if (!moved && !s.held.includes("up") && edgeAt(m, s.r, s.c, "down") === 1) tryMove(s, m, "down", now);
        }
        const secs = (now - s.start) / 1000;
        if (phaseRef.current === "playing" && secs >= TIME_LIMIT) {
          s.end = now;
          changePhase("lost");
        }
        if (now - lastUi > 100) {
          lastUi = now;
          if (phaseRef.current === "playing") setElapsed(secs);
        }
      }

      draw(ctx, dpr, m, s, now, ph);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dpad = (d: Dir, label: string) => (
    <button
      className={`dpad-${d}`}
      aria-label={d}
      onPointerDown={(e) => {
        e.preventDefault();
        press(d);
      }}
      onPointerUp={() => release(d)}
      onPointerLeave={() => release(d)}
      onPointerCancel={() => release(d)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <main className="card rohr">
      <p className="muted presents">Die Fisser-Flitzer präsentieren</p>
      <h2>💩 Rohr-Flitzer</h2>
      <p className="muted">
        Flitz durch die Abflussrohre von <b>Haus Buchhammer</b> bis in die Kanalisation.
        Im Rohr ist es dunkel – und manche Rohre sind verstopft!
      </p>
      <div className="rohr-hud">
        <span>⏱ {elapsed.toFixed(1)} s</span>
        <span className="muted">Pfeiltasten / WASD · Wischen</span>
      </div>
      <div className="rohr-stage">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {phase !== "playing" && (
          <div className="rohr-overlay">
            {phase === "ready" && (
              <>
                <p className="big">Bereit zum Abziehen?</p>
                <button onClick={start}>🚽 Spülen!</button>
                <p className="muted small">Leertaste startet auch</p>
              </>
            )}
            {phase === "won" && (
              <>
                <p className="big">Platsch! 🎉</p>
                <p>In <b>{elapsed.toFixed(2)} s</b> in der Kanalisation.</p>
                {saveMsg && <p className="small">{saveMsg}</p>}
                <button onClick={start}>Nochmal spülen</button>
              </>
            )}
            {phase === "lost" && (
              <>
                <p className="big">Eingetrocknet… 😖</p>
                <p>Nach {TIME_LIMIT} s steckt die Wurst immer noch fest.</p>
                <button onClick={start}>Nochmal spülen</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="dpad">
        {dpad("up", "▲")}
        {dpad("left", "◀")}
        {dpad("down", "▼")}
        {dpad("right", "▶")}
      </div>
    </main>
  );
}

// =====================================================================
// Zeichnen
// =====================================================================
function draw(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  m: Maze,
  s: Sim,
  now: number,
  phase: Phase,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // --- Himmel + Dach
  ctx.fillStyle = "#bfe3f5";
  ctx.fillRect(0, 0, W, ROOF);
  ctx.fillStyle = "#b5452e";
  ctx.beginPath();
  ctx.moveTo(-6, ROOF + 2);
  ctx.lineTo(W / 2, 6);
  ctx.lineTo(W + 6, ROOF + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7d2a1a";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Schornstein
  ctx.fillStyle = "#8a3a28";
  ctx.fillRect(m.startCol >= COLS / 2 ? W * 0.2 : W * 0.74, 34, 16, 34); // nicht hinter dem Klo
  // Hausschild
  ctx.fillStyle = "#fff8e7";
  ctx.strokeStyle = "#5c3b1e";
  ctx.lineWidth = 2;
  roundRect(ctx, W / 2 - 78, 12, 156, 24, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#5c3b1e";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Haus Buchhammer", W / 2, 25);

  // --- Hauswände + Stockwerke
  const floorColors = ["#f3e9d6", "#eee2cb", "#f3e9d6", "#d9d4cc"];
  for (let f = 0; f < FLOORS.length; f++) {
    const y = ROOF + f * ROWS_PER_FLOOR * S;
    ctx.fillStyle = floorColors[f];
    ctx.fillRect(0, y, W, ROWS_PER_FLOOR * S);
  }
  // Erdreich neben dem Keller
  ctx.fillStyle = "#8b6b4a";
  ctx.fillRect(0, ROOF + 3 * ROWS_PER_FLOOR * S, 6, ROWS_PER_FLOOR * S);
  ctx.fillRect(W - 6, ROOF + 3 * ROWS_PER_FLOOR * S, 6, ROWS_PER_FLOOR * S);
  // Decken
  ctx.fillStyle = "#9c8f7d";
  for (let f = 1; f < FLOORS.length; f++) ctx.fillRect(0, ROOF + f * ROWS_PER_FLOOR * S - 3, W, 6);
  // Stockwerk-Beschriftung
  ctx.font = "600 10px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(60,45,30,0.55)";
  for (let f = 0; f < FLOORS.length; f++) ctx.fillText(FLOORS[f], 8, ROOF + f * ROWS_PER_FLOOR * S + 5);
  // Außenwände
  ctx.fillStyle = "#6e5b45";
  ctx.fillRect(0, ROOF, 4, ROWS * S);
  ctx.fillRect(W - 4, ROOF, 4, ROWS * S);

  // --- Kanalisation
  const sy = ROOF + ROWS * S;
  ctx.fillStyle = "#5a4a3a";
  ctx.fillRect(0, sy, W, SEWER);
  ctx.fillStyle = "#3d5a4a";
  ctx.fillRect(0, sy + 22, W, SEWER - 22);
  ctx.strokeStyle = "rgba(160,200,140,0.5)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const wy = sy + 32 + k * 10;
    for (let x = 0; x <= W; x += 6) {
      const yy = wy + Math.sin(x / 14 + now / 300 + k) * 2.5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 11px system-ui, sans-serif";
  const exitRight = m.exitCol >= COLS / 2;
  ctx.textAlign = exitRight ? "left" : "right";
  ctx.textBaseline = "top";
  ctx.fillText("KANALISATION", exitRight ? 10 : W - 10, sy + 6);

  // --- Rohre
  const pipes: [number, number, number, number, boolean][] = [];
  const seen = (r: number, c: number) => phase === "lost" || phase === "won" || s.revealed.has(r * COLS + c);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const vis = seen(r, c);
      // Ausgang in die Kanalisation ist immer zu sehen (das Ziel)
      if (r === ROWS - 1 && c === m.exitCol) pipes.push([cx(c), cy(r), cx(c), sy + 26, false]);
      if (!vis && !(c < COLS - 1 && seen(r, c + 1)) && !(r < ROWS - 1 && seen(r + 1, c))) continue;
      if (m.right[r][c]) pipes.push([cx(c), cy(r), cx(c + 1), cy(r), m.right[r][c] === 2]);
      if (m.down[r][c] && r < ROWS - 1) pipes.push([cx(c), cy(r), cx(c), cy(r + 1), m.down[r][c] === 2]);
    }
  // Zulauf vom Klo
  pipes.push([cx(m.startCol), ROOF - 14, cx(m.startCol), cy(0), false]);

  ctx.lineCap = "round";
  const pass = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of pipes) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  };
  pass(S * 0.62, "#4a525c");
  pass(S * 0.5, "#a7b0ba");
  pass(S * 0.32, "#3a3f46"); // dunkles Rohrinneres

  // Spur der Wurst
  ctx.strokeStyle = "rgba(120,75,30,0.55)";
  ctx.lineWidth = S * 0.18;
  ctx.beginPath();
  for (const k of s.trail) {
    const [r, c, o] = k.split(",");
    const rr = +r, cc = +c;
    ctx.moveTo(cx(cc), cy(rr));
    if (o === "h") ctx.lineTo(cx(cc + 1), cy(rr));
    else ctx.lineTo(cx(cc), rr === ROWS - 1 ? sy + 26 : cy(rr + 1));
  }
  ctx.stroke();

  // Muffen an den Knoten
  ctx.fillStyle = "#8d96a1";
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const any = (["up", "down", "left", "right"] as Dir[]).some((d) => edgeAt(m, r, c, d) !== 0);
      const exit = r === ROWS - 1 && c === m.exitCol;
      if (!any || !(seen(r, c) || exit)) continue;
      ctx.beginPath();
      ctx.arc(cx(c), cy(r), S * 0.29, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a3f46";
      ctx.beginPath();
      ctx.arc(cx(c), cy(r), S * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8d96a1";
    }

  // Verstopfungen
  for (const [x1, y1, x2, y2, clog] of pipes) {
    if (!clog) continue;
    drawClog(ctx, (x1 + x2) / 2, (y1 + y2) / 2, now);
  }

  // --- Klo oben
  drawToilet(ctx, cx(m.startCol), ROOF - 24);

  // --- Wurst
  let px: number, py: number;
  const fromY = s.fr < 0 ? ROOF - 22 : cy(s.fr);
  const toY = s.r === ROWS ? sy + 30 : cy(s.r);
  const t = s.moving ? s.t : 1;
  px = cx(s.fc) + (cx(s.c) - cx(s.fc)) * t;
  py = fromY + (toY - fromY) * t;
  if (phase === "ready") {
    px = cx(m.startCol);
    py = ROOF - 30;
  }
  let rot = Math.sin(now / 120) * (s.moving ? 0.25 : 0.08);
  if (s.bump && now - s.bump.at < 250) {
    px += Math.sin(now / 15) * 2.5;
  }
  const showWurst = !(phase === "won" && now - s.splashAt > 600);
  if (showWurst) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.font = `${S * 0.82}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💩", 0, 1);
    ctx.restore();
  }

  // Platsch!
  if (phase === "won") {
    const k = Math.min((now - s.splashAt) / 700, 1);
    ctx.strokeStyle = `rgba(200,230,180,${1 - k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx(s.c), sy + 34, 8 + k * 40, 3 + k * 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // "Verstopft!"-Hinweis
  if (s.bump && now - s.bump.at < 700) {
    const k = (now - s.bump.at) / 700;
    ctx.globalAlpha = 1 - k;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.strokeText("Verstopft!", s.bump.x, s.bump.y - 16 - k * 14);
    ctx.fillStyle = "#c92a2a";
    ctx.fillText("Verstopft!", s.bump.x, s.bump.y - 16 - k * 14);
    ctx.globalAlpha = 1;
  }
}

function drawClog(ctx: CanvasRenderingContext2D, x: number, y: number, now: number) {
  // Pfropfen aus Klopapier, Haaren & grünem Schleim
  ctx.fillStyle = "#6f8f3a";
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2f0e8";
  for (const [dx, dy, r] of [[-4, -3, 5], [4, -2, 5], [0, 4, 5], [-5, 4, 3]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#c92a2a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6);
  ctx.lineTo(x + 6, y + 6);
  ctx.moveTo(x + 6, y - 6);
  ctx.lineTo(x - 6, y + 6);
  ctx.stroke();
  // Gestank
  ctx.strokeStyle = "rgba(110,160,40,0.8)";
  ctx.lineWidth = 1.6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const yy = y - 10 - k * 1.4;
      const xx = x + i * 6 + Math.sin(k / 2 + now / 200 + i) * 2;
      if (k === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
}

function drawToilet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#7b8794";
  ctx.lineWidth = 2;
  // Spülkasten
  roundRect(ctx, x + 6, y - 22, 14, 30, 3);
  ctx.fill();
  ctx.stroke();
  // Schüssel
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 2, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9fd3ea";
  ctx.beginPath();
  ctx.ellipse(x - 2, y + 2, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
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
