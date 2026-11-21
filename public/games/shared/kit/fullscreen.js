/* Vollbild – nur, wo der Browser es kann. iPhone-Safari kann es nicht, auf dem Home-Bildschirm
   (PWA) ist das Spiel ohnehin schon ohne Leisten: dort gibt es keinen Knopf.
   Das Spiel läuft in der App in einem iframe; die App erlaubt das mit allow="fullscreen". */

const doc = document;

export const fullscreen = {
  get available() {
    const enabled = doc.fullscreenEnabled || doc.webkitFullscreenEnabled;
    const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
    return !!enabled && !standalone;
  },
  get active() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); },
  async toggle() {
    try {
      if (this.active) await (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else {
        const el = doc.documentElement;
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      }
    } catch { /* abgelehnt – nichts tun */ }
  },
  onChange(fn) {
    doc.addEventListener('fullscreenchange', fn);
    doc.addEventListener('webkitfullscreenchange', fn);
  },
};
