/* Game-Test Kit – gemeinsame Bausteine, damit alle Spiele gleich aussehen und sich gleich bedienen lassen.
   Regeln: docs/GAME_STANDARD.md · lauffähiges Beispiel: tools/vorlage/html/

   Einbinden:
     <link rel="stylesheet" href="../shared/kit/theme.css">
     <script type="module">
       import { startKit, createLoop } from '../shared/kit/kit.js';
       const kit = startKit({ key: 'mein-spiel', orientation: 'any', pause: () => loop.pause(), resume: () => loop.resume() });
       …
       kit.show('start');            // Bildschirm mit data-screen="start" zeigen, die anderen verstecken
       kit.setState('play');         // Spiel läuft: Pause-Knopf sichtbar, Auto-Pause aktiv
       kit.storage.saveScore({ points: 3, seconds: 95 });  kit.setState('end'); kit.show('end');
     </script>

   startKit() übernimmt:
     - <html class="gt">: Seite gesperrt (kein Scrollen, kein Gummiband), Schrift, Hintergrund
     - --gt-vh = sichtbare Höhe (iOS-Leisten), Hinweis „Bitte Gerät drehen“ bei falscher Ausrichtung
     - Leiste oben rechts: ⏸ Pause (nur im Spiel) · 🔊 Ton · ⛶ Vollbild (wo möglich) · 🏠 Alle Spiele
     - Pause-Fenster (Weiter, Ton, Alle Spiele), Taste P/Esc = Pause, M = Ton
     - automatische Pause, wenn der Tab oder die App in den Hintergrund geht
     - Ton-Einstellung für alle Spiele gemeinsam, Speicher-Schicht (storage.js)

   Optionen:
     key            games.json-key (Pflicht)
     orientation    "landscape" | "portrait" | "any" (wie in games.json)
     saveKey        localStorage-Schlüssel des Spielstands (wie in games.json)
     pause, resume  Funktionen, die das Spiel anhalten/fortsetzen (Schleife, Musik, Timer)
     sound          nur für Spiele mit eigener Ton-Logik: { setMuted(m) } – wird beim Start und bei jedem
                    Umschalten mit der gemeinsamen Einstellung aufgerufen
     bar            false = keine Leiste; ein Element = Knöpfe dort hinein statt oben rechts
     home           false = kein 🏠 in der Leiste (wenn das Spiel einen eigenen Link zeigt)
     pauseScreen    false = das Spiel zeigt in pause() ein eigenes Pause-Fenster (z. B. mit „Aufgeben“);
                    dessen „Weiter“-Knopf ruft kit.resume() auf */

import { createViewport, fitCanvas, board } from './viewport.js';
import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { createSound } from './sound.js';
import { createStorage } from './storage.js';
import { watchOrientation } from './orientation.js';
import { fullscreen } from './fullscreen.js';
import { createQuality } from './quality.js';

export { createViewport, fitCanvas, board, createLoop, createInput, createSound, createStorage, watchOrientation, fullscreen, createQuality };

export const HOME_URL = '../../#/';

/* Symbole als SVG: ⏸ und ⛶ fehlen in manchen Schriften (Android, Windows) */
const ICON = {
  pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.5" fill="currentColor"/></svg>',
  full: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>',
};

const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
};

export function startKit(options = {}) {
  const { key, orientation = 'any', saveKey, pause: onPause = () => {}, resume: onResume = () => {}, sound: gameSound, bar = true, home = true, pauseScreen: ownPauseScreen = true } = options;
  if (!key) throw new Error('startKit: key fehlt');
  const root = document.documentElement;
  root.classList.add('gt');

  const viewport = createViewport();
  const input = createInput();
  const sound = createSound();
  const storage = createStorage(key, { saveKey });
  if (gameSound) { gameSound.setMuted(sound.muted); sound.onChange((m) => gameSound.setMuted(m)); }

  let state = 'menu';       // menu | play | end
  let paused = false;

  /* ---------- Leiste ---------- */
  const buttons = {};
  if (bar) {
    const holder = bar instanceof Element ? bar : document.body.appendChild(el('nav', { class: 'gt-bar', 'aria-label': 'Spiel' }));
    buttons.pause = holder.appendChild(el('button', { type: 'button', class: 'gt-icon', 'aria-label': 'Pause', title: 'Pause (P)' }, ICON.pause));
    buttons.sound = holder.appendChild(el('button', { type: 'button', class: 'gt-icon', title: 'Ton an/aus (M)' }));
    if (fullscreen.available) buttons.full = holder.appendChild(el('button', { type: 'button', class: 'gt-icon gt-full', 'aria-label': 'Vollbild', title: 'Vollbild' }, ICON.full));
    if (home) holder.appendChild(el('a', { class: 'gt-icon', href: HOME_URL, target: '_top', 'aria-label': 'Alle Spiele', title: 'Alle Spiele' }, '🏠'));
    buttons.pause.addEventListener('click', () => api.pause());
    buttons.sound.addEventListener('click', () => sound.toggle());
    buttons.full?.addEventListener('click', () => fullscreen.toggle());
  }

  /* ---------- Pause-Fenster ---------- */
  const pauseScreen = el('section', { class: 'gt-screen', 'data-gt': 'pause', role: 'dialog', 'aria-label': 'Pause', hidden: '' }, `
    <div class="gt-card">
      <div class="gt-emoji" aria-hidden="true">⏸️</div>
      <h1>Pause</h1>
      <p>Das Spiel wartet auf dich.</p>
      <div class="gt-row">
        <button type="button" class="gt-btn" data-gt="weiter">▶ Weiter</button>
      </div>
      <div class="gt-row">
        <button type="button" class="gt-btn gt-alt" data-gt="ton"></button>
        ${fullscreen.available ? `<button type="button" class="gt-btn gt-alt" data-gt="vollbild">${ICON.full} Vollbild</button>` : ''}
        <a class="gt-btn gt-alt" href="${HOME_URL}" target="_top">🏠 Alle Spiele</a>
      </div>
    </div>`);
  document.body.appendChild(pauseScreen);
  pauseScreen.querySelector('[data-gt="weiter"]').addEventListener('click', () => api.resume());
  pauseScreen.querySelector('[data-gt="ton"]').addEventListener('click', () => sound.toggle());
  pauseScreen.querySelector('[data-gt="vollbild"]')?.addEventListener('click', () => fullscreen.toggle());

  function updateSoundLabels() {
    const label = sound.muted ? '🔇' : '🔊';
    if (buttons.sound) { buttons.sound.textContent = label; buttons.sound.setAttribute('aria-label', sound.muted ? 'Ton ist aus – einschalten' : 'Ton ist an – ausschalten'); }
    pauseScreen.querySelector('[data-gt="ton"]').textContent = sound.muted ? '🔇 Ton ist aus' : '🔊 Ton ist an';
  }
  sound.onChange(updateSoundLabels);
  updateSoundLabels();

  function updateBar() {
    if (buttons.pause) buttons.pause.hidden = state !== 'play' || paused;
  }

  /* ---------- Toast ---------- */
  const toastEl = document.body.appendChild(el('div', { class: 'gt-toast', role: 'status', 'aria-live': 'polite' }));
  let toastTimer = 0;

  const api = {
    viewport, input, sound, storage, fullscreen,
    get state() { return state; },
    get paused() { return paused; },
    /* 'menu' (Start, Auswahl), 'play' (Spiel läuft), 'end' (Ergebnis) */
    setState(s) {
      state = s;
      if (s !== 'play' && paused) { paused = false; pauseScreen.hidden = true; }
      updateBar();
    },
    pause() {
      if (state !== 'play' || paused) return;
      paused = true;
      sound.suspend();
      onPause();
      updateBar();
      if (ownPauseScreen) {
        pauseScreen.hidden = false;
        pauseScreen.querySelector('[data-gt="weiter"]').focus({ preventScroll: true, focusVisible: false });
      }
    },
    resume() {
      if (!paused || orient.wrong) return;
      paused = false;
      pauseScreen.hidden = true;
      sound.resume();
      onResume();
      updateBar();
    },
    /* Bildschirme: Elemente mit data-screen="name"; show(null) versteckt alle */
    show(name) {
      document.querySelectorAll('[data-screen]').forEach((s) => { s.hidden = s.dataset.screen !== name; });
      const first = name && document.querySelector(`[data-screen="${name}"] [autofocus], [data-screen="${name}"] .gt-btn`);
      /* Fokus für die Tastatur, ohne sichtbaren Ring bei Maus/Touch */
      if (first) first.focus({ preventScroll: true, focusVisible: false });
    },
    toast(text, ms = 1800) {
      toastEl.textContent = text;
      toastEl.classList.add('gt-show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('gt-show'), ms);
    },
  };

  /* ---------- automatisch pausieren ---------- */
  document.addEventListener('visibilitychange', () => { if (document.hidden) api.pause(); });
  addEventListener('pagehide', () => api.pause());
  input.on('pause', () => (paused ? api.resume() : api.pause()));
  input.on('ton', () => sound.toggle());
  const orient = watchOrientation(viewport, orientation, (wrong) => { if (wrong) api.pause(); });

  updateBar();
  return api;
}
