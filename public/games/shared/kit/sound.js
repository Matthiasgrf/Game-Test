/* Ton – eine Einstellung für alle Spiele: wer in einem Spiel den Ton ausschaltet, hat ihn in allen aus
   (localStorage „game-test:ton“). Klänge werden mit Web Audio erzeugt, ohne Dateien.

   const sound = createSound();
   sound.beep(660, 0.12)                  Ton: Frequenz (Hz), Dauer (s), Form ('sine'|'square'|'triangle'|'sawtooth'), Lautstärke
   sound.melody([[523, .1], [659, .1], [784, .2]])   mehrere Töne nacheinander
   sound.richtig(), sound.falsch(), sound.gewonnen() fertige Klänge, in allen Spielen gleich
   sound.muted, sound.toggle(), sound.setMuted(true), sound.onChange(fn)
   sound.suspend() / sound.resume()       in der Pause still

   Der AudioContext entsteht erst bei der ersten Berührung oder Taste (iPhone/iPad verlangen das).
   Spiele müssen ohne Ton vollständig bedienbar bleiben (Barrierefreiheit). */

const KEY = 'game-test:ton';

function readMuted() {
  try { return localStorage.getItem(KEY) === 'aus'; } catch { return false; }
}

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = readMuted();
  const listeners = new Set();

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    return ctx;
  }
  const unlock = () => { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock);

  function beep(freq, dur = 0.12, type = 'sine', vol = 0.18, delay = 0) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function melody(notes, type = 'triangle', vol = 0.16) {
    let at = 0;
    for (const [freq, dur] of notes) { if (freq) beep(freq, dur, type, vol, at); at += dur; }
  }

  const api = {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? 'aus' : 'an'); } catch { /* privates Fenster */ }
      if (master) master.gain.value = muted ? 0 : 1;
      listeners.forEach((fn) => fn(muted));
    },
    toggle() { api.setMuted(!muted); return muted; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    beep, melody,
    richtig: () => melody([[660, 0.09], [880, 0.14]]),
    falsch: () => melody([[330, 0.12], [262, 0.18]], 'sine', 0.12),
    gewonnen: () => melody([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3]]),
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  };
  /* Andere Spiele (oder ein anderer Tab) haben den Ton umgestellt */
  addEventListener('storage', (e) => { if (e.key === KEY) { muted = readMuted(); if (master) master.gain.value = muted ? 0 : 1; listeners.forEach((fn) => fn(muted)); } });
  return api;
}
