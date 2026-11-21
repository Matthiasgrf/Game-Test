import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { DX, DY, E, N, S, W, canMove, generateMaze, idx, type Cell, type Dir, type Maze } from "./maze";
import { isMuted, setMuted, sounds } from "./sound";
import { loadMyScores, saveScore } from "../scores";
import { useAuth } from "../../auth/AuthProvider";
import "./labyrinth.css";

// ---------- Konfiguration ---------------------------------------------

interface Mode {
  id: string;
  label: string;
  emoji: string;
  sizes: number[]; // Kantenlaenge je Level
}

const MODES: Mode[] = [
  { id: "leicht", label: "Leicht", emoji: "🐣", sizes: [4, 5, 5, 6, 6] },
  { id: "mittel", label: "Mittel", emoji: "🦊", sizes: [5, 6, 7, 7, 8] },
  { id: "knifflig", label: "Knifflig", emoji: "🦁", sizes: [7, 8, 9, 10, 11] },
];

interface Theme {
  hero: string;
  goal: string;
  task: string;
  floor: string;
  wall: string;
  trail: string;
}

const THEMES: Theme[] = [
  { hero: "🐭", goal: "🧀", task: "Bring die Maus zum Käse!", floor: "#fff8e1", wall: "#e8590c", trail: "#ffd8a8" },
  { hero: "🐰", goal: "🥕", task: "Der Hase hat Hunger auf eine Karotte!", floor: "#ebfbee", wall: "#2b8a3e", trail: "#b2f2bb" },
  { hero: "🐶", goal: "🦴", task: "Hilf dem Hund, seinen Knochen zu finden!", floor: "#e7f5ff", wall: "#1971c2", trail: "#a5d8ff" },
  { hero: "🐝", goal: "🌻", task: "Die Biene fliegt zur Blume!", floor: "#fff9db", wall: "#e67700", trail: "#ffec99" },
  { hero: "🐧", goal: "🐟", task: "Der Pinguin möchte einen Fisch!", floor: "#f3f0ff", wall: "#6741d9", trail: "#d0bfff" },
];

const PRAISE = ["Super!", "Toll gemacht!", "Klasse!", "Wow!", "Spitze!", "Prima!"];
const CELL = 10; // SVG-Einheiten pro Zelle

// ---------- Spielzustand ------------------------------------------------

interface Play {
  maze: Maze;
  pos: Cell;
  visited: boolean[];
  got: boolean[]; // eingesammelte Sterne
  bump: number; // Zaehler -> loest Wackel-Animation aus
  won: boolean;
}

function newPlay(size: number): Play {
  const maze = generateMaze(size, size, 3);
  const visited = new Array(size * size).fill(false);
  visited[idx(maze, maze.start.x, maze.start.y)] = true;
  return { maze, pos: maze.start, visited, got: maze.stars.map(() => false), bump: 0, won: false };
}

type Phase = "menu" | "play" | "levelDone" | "finished";

interface Best { stars: number; seconds: number }
const better = (a: Best, b: Best | undefined) =>
  !b || a.stars > b.stars || (a.stars === b.stars && a.seconds < b.seconds);

type SaveState = "saving" | "saved" | "error";

const KEYS: Record<string, Dir> = {
  ArrowUp: N, ArrowRight: E, ArrowDown: S, ArrowLeft: W,
  w: N, d: E, s: S, a: W, W: N, D: E, S: S, A: W,
};

// ---------- Komponente --------------------------------------------------

export default function Labyrinth() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const [level, setLevel] = useState(0);
  const [play, setPlayState] = useState<Play | null>(null);
  const [starsTotal, setStarsTotal] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [result, setResult] = useState<{ stars: number; maxStars: number; seconds: number; record: boolean } | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [praise, setPraise] = useState(PRAISE[0]);
  const [best, setBest] = useState<Record<string, Best>>({});
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const { profile } = useAuth();

  // Eigene Bestleistungen je Stufe aus Supabase laden
  const userId = profile?.id;
  useEffect(() => {
    if (!userId) return;
    loadMyScores("labyrinth", userId)
      .then((rows) => {
        const b: Record<string, Best> = {};
        for (const r of rows) {
          const mine = { stars: r.points, seconds: r.seconds ?? 0 };
          if (better(mine, b[r.variant])) b[r.variant] = mine;
        }
        setBest(b);
      })
      .catch(() => {});
  }, [userId]);

  // Ref spiegelt den aktuellen Zustand, damit Tastatur-/Touch-Handler
  // mehrere Schritte direkt hintereinander ausfuehren koennen.
  const playRef = useRef<Play | null>(null);
  const setPlay = (p: Play | null) => {
    playRef.current = p;
    setPlayState(p);
  };

  const theme = THEMES[level % THEMES.length];
  const maxStarsSoFar = useRef(0);

  const startChallenge = (m: Mode) => {
    setMode(m);
    setLevel(0);
    setStarsTotal(0);
    maxStarsSoFar.current = 0;
    setStartedAt(Date.now());
    setPlay(newPlay(m.sizes[0]));
    setPhase("play");
  };

  const nextLevel = () => {
    const l = level + 1;
    setLevel(l);
    setPlay(newPlay(mode.sizes[l]));
    setPhase("play");
  };

  const finishLevel = useCallback(
    (p: Play) => {
      const got = p.got.filter(Boolean).length;
      const total = starsTotal + got;
      setStarsTotal(total);
      maxStarsSoFar.current += p.maze.stars.length;
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      if (level + 1 >= mode.sizes.length) {
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        const maxStars = maxStarsSoFar.current;
        const mine = { stars: total, seconds };
        const record = better(mine, best[mode.id]);
        if (record) setBest((b) => ({ ...b, [mode.id]: mine }));
        setResult({ stars: total, maxStars, seconds, record });
        // Ergebnis speichern (Tabelle game_scores, Variante = Stufe)
        setSaveState("saving");
        void saveScore("labyrinth", { variant: mode.id, points: total, maxPoints: maxStars, seconds })
          .then((error) => setSaveState(error ? "error" : "saved"));
        sounds.trophy();
        setPhase("finished");
      } else {
        sounds.win();
        setPhase("levelDone");
      }
    },
    [level, mode, starsTotal, startedAt, best],
  );

  /** Einen Schritt gehen. Gibt true zurueck, wenn sich die Figur bewegt hat. */
  const move = useCallback(
    (d: Dir, quietBump = false): boolean => {
      const p = playRef.current;
      if (!p || p.won) return false;
      if (!canMove(p.maze, p.pos, d)) {
        if (!quietBump) {
          sounds.bump();
          setPlay({ ...p, bump: p.bump + 1 });
        }
        return false;
      }
      const pos = { x: p.pos.x + DX[d], y: p.pos.y + DY[d] };
      const visited = p.visited.slice();
      visited[idx(p.maze, pos.x, pos.y)] = true;
      let got = p.got;
      const si = p.maze.stars.findIndex((s, i) => !p.got[i] && s.x === pos.x && s.y === pos.y);
      if (si >= 0) {
        got = p.got.slice();
        got[si] = true;
        sounds.star();
      } else {
        sounds.step();
      }
      const won = pos.x === p.maze.goal.x && pos.y === p.maze.goal.y;
      const next = { ...p, pos, visited, got, won };
      setPlay(next);
      if (won) setTimeout(() => finishLevel(next), 450);
      return true;
    },
    [finishLevel],
  );

  // ---- Tastatur ----
  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d === undefined) return;
      e.preventDefault(); // Seite nicht scrollen
      move(d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, move]);

  // Enter/Leertaste auf den Zwischen-Bildschirmen
  useEffect(() => {
    if (phase !== "levelDone") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        nextLevel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Finger / Maus: Figur folgt dem Finger durch die Gaenge ----
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const walkToward = (clientX: number, clientY: number) => {
    const p = playRef.current;
    const svg = svgRef.current;
    if (!p || !svg) return;
    const r = svg.getBoundingClientRect();
    const tx = Math.floor(((clientX - r.left) / r.width) * p.maze.w);
    const ty = Math.floor(((clientY - r.top) / r.height) * p.maze.h);
    if (tx < 0 || ty < 0 || tx >= p.maze.w || ty >= p.maze.h) return;
    for (let i = 0; i < p.maze.w + p.maze.h; i++) {
      const c = playRef.current!.pos;
      const dx = tx - c.x, dy = ty - c.y;
      if (dx === 0 && dy === 0) break;
      const h: Dir | null = dx > 0 ? E : dx < 0 ? W : null;
      const v: Dir | null = dy > 0 ? S : dy < 0 ? N : null;
      const order = Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
      const moved = order.some((d) => d !== null && move(d, true));
      if (!moved) break;
    }
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    walkToward(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) walkToward(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  // ---- Pfeil-Buttons: gedrueckt halten = weiterlaufen ----
  const repeat = useRef<number | null>(null);
  const stopRepeat = () => {
    if (repeat.current !== null) window.clearInterval(repeat.current);
    repeat.current = null;
  };
  const startRepeat = (d: Dir) => {
    stopRepeat();
    move(d);
    repeat.current = window.setInterval(() => move(d, true), 220);
  };
  useEffect(() => stopRepeat, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  // ---------- Rendering ----------

  if (phase === "menu") {
    return (
      <main className="card lab">
        <BackLink />
        <div className="lab-menu">
          <div className="lab-heroes">{THEMES.map((t) => <span key={t.hero}>{t.hero}</span>)}</div>
          <h2>Labyrinth-Abenteuer</h2>
          <p className="lab-big">Hilf den Tieren durch {MODES[0].sizes.length} Labyrinthe!</p>
          <p className="muted">Sammle unterwegs die ⭐ Sterne ein.</p>
          <div className="lab-modes">
            {MODES.map((m) => {
              const b = best[m.id];
              return (
                <button key={m.id} className="lab-mode" onClick={() => startChallenge(m)}>
                  <span className="lab-mode-emoji">{m.emoji}</span>
                  <span className="lab-mode-label">{m.label}</span>
                  {b && <span className="lab-mode-best">Rekord: ⭐ {b.stars}</span>}
                </button>
              );
            })}
          </div>
          <p className="muted lab-help">
            💻 Pfeiltasten &nbsp;·&nbsp; 📱 Figur mit dem Finger ziehen oder Pfeile antippen
          </p>
        </div>
      </main>
    );
  }

  if (phase === "finished" && result) {
    return (
      <main className="card lab">
        <Confetti />
        <div className="lab-menu">
          <div className="lab-trophy">🏆</div>
          <h2>Geschafft! Alle {mode.sizes.length} Labyrinthe!</h2>
          <p className="lab-big">
            Du hast <strong>{result.stars}</strong> von {result.maxStars} ⭐ gesammelt.
          </p>
          <p className="muted">Zeit: {formatTime(result.seconds)}</p>
          {result.record && <p className="lab-record">🎖️ Neuer Rekord!</p>}
          <p className="muted lab-save">
            {saveState === "saving" && "Speichere…"}
            {saveState === "saved" && "✔ Ergebnis gespeichert"}
            {saveState === "error" && "⚠️ Speichern hat nicht geklappt"}
          </p>
          <div className="lab-heroes">{THEMES.map((t) => <span key={t.hero}>{t.hero}</span>)}</div>
          <div className="lab-actions">
            <button className="lab-btn" onClick={() => startChallenge(mode)}>🔁 Nochmal</button>
            <button className="lab-btn secondary" onClick={() => setPhase("menu")}>Andere Stufe</button>
          </div>
          <p><Link to="/highscores" className="lab-back">🏅 Bestenliste</Link> &nbsp; <BackLink /></p>
        </div>
      </main>
    );
  }

  if (!play) return null;
  const { maze, pos } = play;
  const gotNow = play.got.filter(Boolean).length;

  return (
    <main className="card lab" style={{ background: theme.floor }}>
      <div className="lab-hud">
        <button className="lab-icon" onClick={() => setPhase("menu")} aria-label="Zurück zum Menü">✖</button>
        <div className="lab-levels" aria-label={`Level ${level + 1} von ${mode.sizes.length}`}>
          {mode.sizes.map((_, i) => (
            <span key={i} className={i < level ? "done" : i === level ? "now" : ""}>
              {i < level ? "✔" : i + 1}
            </span>
          ))}
        </div>
        <div className="lab-stars" aria-label={`${gotNow} von ${maze.stars.length} Sternen`}>
          {maze.stars.map((_, i) => (
            <span key={i} className={play.got[i] ? "on" : ""}>⭐</span>
          ))}
        </div>
        <button className="lab-icon" onClick={toggleMute} aria-label={muted ? "Ton an" : "Ton aus"}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <p className="lab-task" style={{ color: theme.wall }}>
        {theme.task} {theme.hero} ➜ {theme.goal}
      </p>

      <div className="lab-board-wrap">
        <svg
          ref={svgRef}
          className="lab-board"
          viewBox={`-1 -1 ${maze.w * CELL + 2} ${maze.h * CELL + 2}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="Labyrinth"
        >
          <rect x={0} y={0} width={maze.w * CELL} height={maze.h * CELL} fill="#fff" rx={2} />
          {play.visited.map((v, i) =>
            v ? (
              <circle
                key={i}
                cx={(i % maze.w) * CELL + CELL / 2}
                cy={Math.floor(i / maze.w) * CELL + CELL / 2}
                r={1.3}
                fill={theme.trail}
              />
            ) : null,
          )}
          <Walls maze={maze} color={theme.wall} />
          {maze.stars.map((s, i) =>
            play.got[i] ? null : (
              <text key={i} className="lab-star" x={s.x * CELL + CELL / 2} y={s.y * CELL + CELL / 2}>
                ⭐
              </text>
            ),
          )}
          <text className="lab-goal" x={maze.goal.x * CELL + CELL / 2} y={maze.goal.y * CELL + CELL / 2}>
            {theme.goal}
          </text>
          <g className="lab-hero" style={{ transform: `translate(${pos.x * CELL}px, ${pos.y * CELL}px)` }}>
            <text key={play.bump} className={play.bump ? "bump" : ""} x={CELL / 2} y={CELL / 2}>
              {theme.hero}
            </text>
          </g>
        </svg>

        {phase === "levelDone" && (
          <div className="lab-overlay">
            <Confetti />
            <div className="lab-pop">
              <div className="lab-pop-emoji">{theme.hero}{theme.goal}</div>
              <h2>{praise}</h2>
              <div className="lab-pop-stars">
                {maze.stars.map((_, i) => (
                  <span key={i} className={play.got[i] ? "on" : ""}>⭐</span>
                ))}
              </div>
              <button className="lab-btn" onClick={nextLevel} autoFocus>
                Weiter ➜
              </button>
            </div>
          </div>
        )}
      </div>

      <DPad onStart={startRepeat} onStop={stopRepeat} />
    </main>
  );
}

// ---------- Hilfskomponenten -----------------------------------------------

function BackLink() {
  return <Link to="/" className="lab-back">← Alle Spiele</Link>;
}

function Walls({ maze, color }: { maze: Maze; color: string }) {
  const d = useMemo(() => {
    const parts: string[] = [];
    const { w, h } = maze;
    parts.push(`M0 0H${w * CELL}V${h * CELL}H0Z`);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = maze.open[idx(maze, x, y)];
        const X = x * CELL, Y = y * CELL;
        if (x < w - 1 && !(o & E)) parts.push(`M${X + CELL} ${Y}V${Y + CELL}`);
        if (y < h - 1 && !(o & S)) parts.push(`M${X} ${Y + CELL}H${X + CELL}`);
      }
    return parts.join("");
  }, [maze]);
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  );
}

const ARROWS: { d: Dir; label: string; cls: string; name: string }[] = [
  { d: N, label: "▲", cls: "up", name: "hoch" },
  { d: W, label: "◀", cls: "left", name: "links" },
  { d: E, label: "▶", cls: "right", name: "rechts" },
  { d: S, label: "▼", cls: "down", name: "runter" },
];

function DPad({ onStart, onStop }: { onStart: (d: Dir) => void; onStop: () => void }) {
  return (
    <div className="lab-dpad">
      {ARROWS.map((a) => (
        <button
          key={a.cls}
          className={`lab-arrow ${a.cls}`}
          aria-label={a.name}
          onPointerDown={(e) => {
            e.preventDefault();
            onStart(a.d);
          }}
          onPointerUp={onStop}
          onPointerLeave={onStop}
          onPointerCancel={onStop}
          onContextMenu={(e) => e.preventDefault()}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

const CONFETTI = ["🎉", "⭐", "🎈", "✨", "🍬", "🌟"];
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        ch: CONFETTI[i % CONFETTI.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.6 + Math.random() * 1.2,
        size: 1 + Math.random() * 1.2,
      })),
    [],
  );
  return (
    <div className="lab-confetti" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            left: `${b.left}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            fontSize: `${b.size}rem`,
          }}
        >
          {b.ch}
        </span>
      ))}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}

