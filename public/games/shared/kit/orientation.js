/* „Bitte Gerät drehen“ – statt das Spiel zu verzerren oder winzig zu zeigen.
   orientation aus games.json: "landscape" (quer), "portrait" (hoch) oder "any" (beides, Standard).
   Der Hinweis erscheint nur auf Touch-Geräten (Handy, Tablet); am Computer passt sich das Spiel dem Fenster an.
   Solange er zu sehen ist, ist das Spiel pausiert (onChange(true)). */

export function watchOrientation(viewport, orientation, onChange) {
  if (!orientation || orientation === 'any') return { get wrong() { return false; } };
  let el = null;
  let wrong = false;
  viewport.onResize((v) => {
    const now = v.touch && (orientation === 'landscape' ? !v.landscape : v.landscape);
    if (now === wrong) return;
    wrong = now;
    if (wrong && !el) {
      el = document.createElement('div');
      el.className = 'gt-turn';
      el.setAttribute('role', 'alert');
      el.innerHTML = `<div class="gt-phone" aria-hidden="true">📱</div>
        <div>Bitte dreh dein Gerät ${orientation === 'landscape' ? 'quer' : 'hochkant'}.</div>
        <div style="font-size:16px;font-weight:600;opacity:.85">So hast du mehr Platz zum Spielen.</div>`;
      document.body.appendChild(el);
    }
    if (el) el.hidden = !wrong;
    onChange(wrong);
  });
  return { get wrong() { return wrong; } };
}
