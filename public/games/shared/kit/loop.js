/* Spielschleife.

   const loop = createLoop({ update(dt) { … }, render() { … } });
   loop.start();  loop.pause();  loop.resume();  loop.stop();

   - update(dt) bekommt Sekunden. Bewegungen IMMER mit dt rechnen, nie „pro Bild“ – sonst laufen
     iPads/iPhones mit 120 Hz doppelt so schnell.
   - dt ist gedeckelt (maxDt, Standard 0,05 s): nach einer Pause oder einem Ruckler springt nichts.
   - In der Pause läuft kein requestAnimationFrame: nichts wird gezeichnet, das Gerät bleibt kühl.
   - setMaxFps(20) z. B. im Menü, wenn die Szene nur leicht im Hintergrund lebt; setMaxFps(0) = so oft wie möglich.
   - timeScale: Zeitraffer für Durchspiel-Tests (große dt werden in Häppchen ≤ maxDt aufgeteilt).
   - renderOnce(): einmal zeichnen, z. B. nach einer Größenänderung in der Pause. */

export function createLoop({ update = () => {}, render = () => {}, maxDt = 0.05 } = {}) {
  let raf = 0;
  let last = 0;
  let running = false;
  let paused = false;
  let minFrameMs = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (minFrameMs && last && now - last < minFrameMs - 1) return;
    const dt = last ? Math.min(maxDt, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    let rest = dt * api.timeScale;
    while (rest > 1e-6) {
      const d = Math.min(rest, maxDt);
      update(d);
      rest -= d;
    }
    render();
  }

  const api = {
    timeScale: 1,
    get running() { return running; },
    get paused() { return paused; },
    start() {
      if (running && !paused) return;
      running = true;
      paused = false;
      last = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      paused = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    pause() {
      if (!running || paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (!running || !paused) return;
      paused = false;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    setMaxFps(fps) { minFrameMs = fps > 0 ? 1000 / fps : 0; },
    renderOnce() { render(); },
  };
  return api;
}
