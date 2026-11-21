import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { saveScore } from "../scores";
import { DELTA, OPPOSITE, ROWS, edgeAt, generateMaze, openDirs, type Dir, type Maze } from "./maze";
import {
  H, W, drawFrame, edgeMid, freshSim, renderStatic, splash, stepParticles, wurstPos,
  type Phase, type Sim,
} from "./draw";
import "./rohr-flitzer.css";

// Rohr-Flitzer – ein Spiel der Fisser-Flitzer.
// Die Kackwurst flitzt nach einem Wisch von selbst durch das Rohr, auch um Kurven,
// und hält an jeder Abzweigung. Dort entscheidet das Kind, wie es weitergeht.

const SPEED: Record<Dir, number> = { down: 5.5, up: 3.5, left: 4.2, right: 4.2 }; // Zellen pro Sekunde

const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};

export default function RohrFlitzer() {
  const cardRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<HTMLDivElement>(null);

  const mazeRef = useRef<Maze>(null as unknown as Maze);
  if (!mazeRef.current) mazeRef.current = generateMaze();
  const sim = useRef<Sim>(freshSim(mazeRef.current));
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhase] = useState<Phase>("ready");
  const [showWin, setShowWin] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saveMsg, setSaveMsg] = useState("");
  const [scale, setScale] = useState(0.8);
  const scaleRef = useRef(scale);
  const staticRef = useRef<{ k: number; maze: Maze; cv: HTMLCanvasElement } | null>(null);

  // Für den Durchspiel-Test (tools/spieltests/rohr-flitzer.js): Rohrplan und Position lesbar machen
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__rohrFlitzer = { maze: () => mazeRef.current, sim: () => sim.current };
  }, []);

  // ---------- Spielfeld an den Bildschirm anpassen -------------------
  useLayoutEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const top = topRef.current?.offsetHeight ?? 0;
      const pad = padRef.current && getComputedStyle(padRef.current).display !== "none" ? padRef.current.offsetHeight + 10 : 0;
      const availW = wrap.clientWidth;
      const availH = window.innerHeight - top - pad - 34;
      const k = Math.max(0.35, Math.min(availW / W, availH / H, 1.3));
      scaleRef.current = k;
      setScale(k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const changePhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ---------- Bewegung ---------------------------------------------
  /** Losflitzen in Richtung d, falls dort ein offenes Rohr ist. */
  const go = (s: Sim, m: Maze, d: Dir, now: number, quiet = false): boolean => {
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
    if (e === 2 && !quiet) {
      const p = edgeMid(s.r, s.c, d);
      s.bump = { x: p.x, y: p.y, at: now, text: "Verstopft! 🚫" };
    } else if (!quiet) {
      const p = wurstPos(s);
      s.bump = { x: p.x, y: p.y, at: now, text: "Kein Rohr!" };
    }
    return false;
  };

  /** Eingabe vom Kind: Richtung wählen */
  const steer = useCallback((d: Dir) => {
    if (phaseRef.current !== "playing") return;
    const s = sim.current;
    const m = mazeRef.current;
    const now = performance.now();
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
    go(s, m, d, now);
  }, []);

  const start = useCallback(() => {
    if (phaseRef.current === "playing") return;
    if (phaseRef.current === "won") mazeRef.current = generateMaze();
    const s = freshSim(mazeRef.current);
    s.start = performance.now();
    s.r = 0; // Spülung: aus dem Klo ins erste Rohr
    s.t = 0;
    s.moving = "down";
    sim.current = s;
    setSaveMsg("");
    setElapsed(0);
    setShowWin(false);
    changePhase("playing");
    // Auf dem Handy das ganze Spielfeld zeigen
    const card = cardRef.current;
    if (card) {
      const r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ---------- Tastatur ---------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        if (phaseRef.current !== "playing" && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          start();
        }
        return;
      }
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      steer(d);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [start, steer]);

  // ---------- Wischen und Tippen -------------------------------------
  const touch = useRef<{ x: number; y: number; swiped: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY, swiped: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const t = touch.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.hypot(dx, dy) < 22) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    t.x = e.clientX;
    t.y = e.clientY;
    t.swiped = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.swiped || phaseRef.current !== "playing") return;
    // Tippen: in Richtung des getippten Punkts flitzen
    const rect = canvasRef.current!.getBoundingClientRect();
    const k = rect.width / W;
    const px = (e.clientX - rect.left) / k;
    const py = (e.clientY - rect.top) / k;
    const p = wurstPos(sim.current);
    const dx = px - p.x, dy = py - p.y;
    if (Math.hypot(dx, dy) < 18) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  // ---------- Spielschleife -----------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;

    const arrive = (s: Sim, m: Maze, now: number) => {
      const came = s.moving!;
      if (s.fr >= 0) {
        const v = s.fr !== s.r;
        s.trail.add(`${Math.min(s.fr, s.r)},${Math.min(s.fc, s.c)},${v ? "v" : "h"}`);
      }
      s.moving = null;
      s.t = 1;
      if (s.r >= ROWS) {
        // Platsch – angekommen in der Kanalisation!
        s.wonAt = now;
        splash(s, wurstPos(s).x);
        const secs = (now - s.start) / 1000;
        setElapsed(secs);
        changePhase("won");
        window.setTimeout(() => setShowWin(true), 900);
        const whole = Math.max(1, Math.round(secs));
        void saveScore("rohr-flitzer", { points: whole, seconds: whole }).then((error) =>
          setSaveMsg(error ? "Speichern hat leider nicht geklappt." : "🏅 Zeit gespeichert"),
        );
        return;
      }
      // 1. gewünschte Richtung, sobald es geht
      if (s.queued && go(s, m, s.queued, now, true)) {
        s.queued = null;
        return;
      }
      // 2. von selbst weiter, solange es nur einen Weg gibt (gerade oder Kurve)
      const ways = openDirs(m, s.r, s.c).filter((d) => d !== OPPOSITE[came]);
      if (ways.length === 1) {
        go(s, m, ways[0], now, true);
        return;
      }
      // 3. Abzweigung oder Sackgasse: anhalten und auf das Kind warten
      if (s.queued) go(s, m, s.queued, now); // zeigt „Verstopft!“, falls dort ein Pfropfen ist
      s.queued = null;
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = sim.current;
      const m = mazeRef.current;
      if (phaseRef.current === "playing") {
        if (s.moving) {
          s.t += SPEED[s.moving] * dt;
          if (s.t >= 1) arrive(s, m, now);
        }
        if (phaseRef.current === "playing" && now - lastUi > 100) {
          lastUi = now;
          setElapsed((now - s.start) / 1000);
        }
      }
      stepParticles(s, dt);

      // Größe der Leinwand an Skalierung und Pixeldichte anpassen
      const k = scaleRef.current * Math.min(window.devicePixelRatio || 1, 3);
      const cw = Math.round(W * k), ch = Math.round(H * k);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      let st = staticRef.current;
      if (!st || st.k !== k || st.maze !== m) st = staticRef.current = { k, maze: m, cv: renderStatic(m, k) };
      drawFrame(ctx, k, st.cv, m, s, now, phaseRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pad = (d: Dir, label: string) => (
    <button
      aria-label={{ up: "hoch", down: "runter", left: "links", right: "rechts" }[d]}
      onPointerDown={(e) => {
        e.preventDefault();
        steer(d);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );

  return (
    <main className="card rohr" ref={cardRef}>
      <div className="rohr-top" ref={topRef}>
        <Link to="/" className="rohr-home">🏠 Alle Spiele</Link>
        <span className="rohr-title">💩 Rohr-Flitzer</span>
        <span className="rohr-time" aria-live="off">⏱ {elapsed.toFixed(1)} s</span>
      </div>
      <div className="rohr-wrap" ref={wrapRef}>
        <div className="rohr-stage" ref={stageRef} style={{ width: W * scale, height: H * scale }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (touch.current = null)}
          />
          {phase === "ready" && (
            <div className="rohr-overlay">
              <div className="rohr-box">
                <p className="rohr-presents">Die Fisser-Flitzer präsentieren</p>
                <h2>💩 Rohr-Flitzer</h2>
                <p>Hilf der Kackwurst durch die Rohre von <b>Haus Buchhammer</b> bis in die Kanalisation!</p>
                <ul>
                  <li>👆 <b>Wischen</b> oder <b>tippen</b> – oder Pfeiltasten</li>
                  <li>🚫 Verstopfte Rohre musst du umgehen</li>
                  <li>⏱ Sei so schnell wie möglich!</li>
                </ul>
                <button className="rohr-btn" onClick={start}>🚽 Spülen!</button>
              </div>
            </div>
          )}
          {phase === "won" && showWin && (
            <div className="rohr-overlay">
              <div className="rohr-box">
                <div className="rohr-trophy">🎉</div>
                <h2>Platsch!</h2>
                <p>Die Wurst ist in der Kanalisation.</p>
                <p className="rohr-result">⏱ {elapsed.toFixed(1)} Sekunden</p>
                {saveMsg && <p className="rohr-small">{saveMsg}</p>}
                <button className="rohr-btn" onClick={start}>🔄 Nochmal spielen</button>
                <Link to="/" className="rohr-home">🏠 Alle Spiele</Link>
              </div>
            </div>
          )}
          {phase === "won" && !showWin && <div className="rohr-splash-text">Platsch!</div>}
        </div>
      </div>
      <div className="rohr-pad" ref={padRef}>
        {pad("left", "◀")}
        {pad("up", "▲")}
        {pad("down", "▼")}
        {pad("right", "▶")}
      </div>
    </main>
  );
}
