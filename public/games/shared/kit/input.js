/* Eingaben: Tastatur, Maus und Touch über dieselben Aktionen.

   const input = createInput();
   input.down('links')            ist die Aktion gerade gedrückt? (Taste oder Touch-Knopf)
   input.on('aktion', fn)         bei jedem neuen Drücken (Tastendruck, Antippen)
   input.touchButtons(el, defs)   große runde Knöpfe für Touch, z. B.
                                  [{ action: 'links', label: '◀' }, { action: 'rechts', label: '▶' }]
   input.swipe(el, fn)            Wischen: fn('links'|'rechts'|'hoch'|'runter')

   Aktionen und Tasten (gleich in allen Spielen):
     links  ← A · rechts → D · hoch ↑ W · runter ↓ S · aktion Leertaste/Enter · pause P/Esc · ton M
   Gedrückte Tasten werden losgelassen, wenn das Fenster den Fokus verliert (sonst „klemmt“ die Figur). */

const KEYS = {
  ArrowLeft: 'links', KeyA: 'links',
  ArrowRight: 'rechts', KeyD: 'rechts',
  ArrowUp: 'hoch', KeyW: 'hoch',
  ArrowDown: 'runter', KeyS: 'runter',
  Space: 'aktion', Enter: 'aktion', NumpadEnter: 'aktion',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'ton',
};
const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

export function createInput({ keys = KEYS } = {}) {
  const held = new Map();      // Aktion → Menge der Quellen (Tasten, Knöpfe), die sie halten
  const handlers = new Map();  // Aktion → Set(fn)

  const emit = (action, source) => (handlers.get(action) || []).forEach((fn) => fn(action, source));
  function press(action, source = 'code') {
    if (!held.has(action)) held.set(action, new Set());
    const sources = held.get(action);
    const fresh = sources.size === 0;
    sources.add(source);
    if (fresh) emit(action, source);
  }
  function release(action, source = 'code') {
    const sources = held.get(action);
    if (!sources) return;
    sources.delete(source);
    if (!sources.size) held.delete(action);
  }
  const clear = () => held.clear();

  addEventListener('keydown', (e) => {
    const action = keys[e.code];
    if (!action || TYPING.test(document.activeElement?.tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return;
    /* Leertaste/Enter auf einem Knopf: der Knopf soll klicken, nicht das Spiel */
    if (action === 'aktion' && document.activeElement?.closest?.('button, a')) return;
    e.preventDefault();
    if (e.repeat) return;
    press(action, `key:${e.code}`);
  });
  addEventListener('keyup', (e) => { const a = keys[e.code]; if (a) release(a, `key:${e.code}`); });
  addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });

  return {
    down: (action) => held.has(action),
    on(action, fn) {
      if (!handlers.has(action)) handlers.set(action, new Set());
      handlers.get(action).add(fn);
      return () => handlers.get(action).delete(fn);
    },
    press, release, clear,

    touchButtons(parent, defs) {
      return defs.map(({ action, label, title }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gt-ctl';
        b.textContent = label;
        b.setAttribute('aria-label', title || action);
        const src = `touch:${action}:${Math.random()}`;
        const down = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); b.classList.add('gt-on'); press(action, src); };
        const up = () => { b.classList.remove('gt-on'); release(action, src); };
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('lostpointercapture', up);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
        parent.appendChild(b);
        return b;
      });
    },

    swipe(el, fn, { min = 30 } = {}) {
      let start = null;
      el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
      el.addEventListener('pointerup', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
        fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts' : 'links') : (dy > 0 ? 'runter' : 'hoch'));
      });
      el.addEventListener('pointercancel', () => { start = null; });
    },
  };
}
