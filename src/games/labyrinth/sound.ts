// Kleine Soundeffekte per WebAudio – keine Audiodateien noetig.

let ctx: AudioContext | null = null;
let muted = (() => {
  try { return localStorage.getItem("labyrinth-muted") === "1"; } catch { return false; }
})();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("labyrinth-muted", m ? "1" : "0"); } catch { /* egal */ }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* kein Audio verfuegbar */ }
}

export const sounds = {
  step: () => tone(520, 0, 0.06, "triangle", 0.05),
  bump: () => tone(140, 0, 0.12, "square", 0.06),
  star: () => { tone(880, 0, 0.12); tone(1320, 0.08, 0.2); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle", 0.12)),
  trophy: () =>
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, 0.35, "triangle", 0.12)),
};
