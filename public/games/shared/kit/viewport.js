/* Sichtbarer Bereich, scharfe Canvas, Spielbrett mit festem Seitenverhältnis.

   createViewport()        misst den sichtbaren Bereich (visualViewport – iOS blendet Leisten ein und aus)
                           und setzt die CSS-Variable --gt-vh. onResize(fn) meldet Größe und Drehung,
                           höchstens einmal pro Bild.
   fitCanvas(canvas, o)    Canvas-Pixel = CSS-Größe × Pixeldichte (gedeckelt, Standard 2) → scharf auf
                           iPad/iPhone, ohne dass ein 3-fach-Display unnötig viel rechnen muss.
                           Gibt { width, height, dpr } zurück; zeichnen in CSS-Pixeln mit ctx.setTransform(dpr,…).
   board(aspect, o)        größtes Rechteck mit Seitenverhältnis aspect (Breite/Höhe), mittig im Bereich –
                           für Spielbretter (Labyrinth, Raster). Die Szene darum herum füllt den Bildschirm,
                           es gibt keine schwarzen Balken (Letterboxing in der Szene). */

export function createViewport() {
  const vv = window.visualViewport;
  const listeners = new Set();
  const state = { width: 0, height: 0, dpr: 1, landscape: true, touch: false };
  const touch = matchMedia('(pointer: coarse)');

  function measure() {
    state.width = Math.round(vv ? vv.width * vv.scale : innerWidth) || innerWidth;
    state.height = Math.round(vv ? vv.height * vv.scale : innerHeight) || innerHeight;
    state.dpr = window.devicePixelRatio || 1;
    state.landscape = state.width >= state.height;
    state.touch = touch.matches || navigator.maxTouchPoints > 0;
    document.documentElement.style.setProperty('--gt-vh', `${state.height}px`);
  }

  let pending = 0;
  function schedule() {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      measure();
      listeners.forEach((fn) => fn(state));
    });
  }
  addEventListener('resize', schedule);
  addEventListener('orientationchange', schedule);
  if (vv) vv.addEventListener('resize', schedule);
  measure();

  return {
    get width() { return state.width; },
    get height() { return state.height; },
    get landscape() { return state.landscape; },
    get touch() { return state.touch; },
    /* fn(state) bei jeder Änderung; wird sofort einmal aufgerufen. Rückgabe: abmelden */
    onResize(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
  };
}

export function fitCanvas(canvas, { maxDpr = 2, width, height } = {}) {
  const rect = canvas.getBoundingClientRect();
  const w = width ?? rect.width;
  const h = height ?? rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  return { width: w, height: h, dpr };
}

export function board(aspect, { top = 0, right = 0, bottom = 0, left = 0, width = innerWidth, height = innerHeight } = {}) {
  const aw = Math.max(1, width - left - right);
  const ah = Math.max(1, height - top - bottom);
  let w = aw;
  let h = aw / aspect;
  if (h > ah) { h = ah; w = ah * aspect; }
  return { x: left + (aw - w) / 2, y: top + (ah - h) / 2, width: w, height: h };
}
