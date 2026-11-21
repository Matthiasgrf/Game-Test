/* Detailstufe automatisch anpassen – vor allem für 3D-Spiele auf schwächeren Tablets und Handys.

   const quality = createQuality({ renderer, onChange(stufe) { … } });
   in der Spielschleife (nur während des Spiels):  quality.frame(dt);

   Misst die Bildrate in Fenstern von 3 Sekunden. Liegt sie unter 45 Bildern/s, geht es eine Stufe
   herunter: zuerst weniger Pixel (Pixeldichte 2 → 1,5 → 1), dann meldet onChange die Stufe, damit das
   Spiel selbst Details weglässt (Schatten, Partikel, Sichtweite). Hoch geht es nicht automatisch –
   ständiges Hin und Her wäre schlimmer als eine etwas einfachere Grafik.
   Stufen: 0 = volle Qualität … 2 = einfachste. Die erreichte Stufe gilt für die ganze Sitzung. */

export function createQuality({ renderer = null, onChange = () => {}, minFps = 45, windowSeconds = 3, maxPixelRatio = 2 } = {}) {
  const RATIOS = [maxPixelRatio, Math.max(1, maxPixelRatio * 0.75), 1];
  let stufe = 0;
  let frames = 0;
  let time = 0;
  const apply = () => {
    if (renderer && renderer.setPixelRatio) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RATIOS[stufe]));
    onChange(stufe);
  };
  if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RATIOS[0]));
  return {
    get stufe() { return stufe; },
    /* einmal pro Bild mit der echten Bildzeit (Sekunden) aufrufen */
    frame(dt) {
      if (stufe >= RATIOS.length - 1 || dt <= 0 || dt > 0.25) return; // Pausen/Ruckler beim Laden nicht mitzählen
      frames++;
      time += dt;
      if (time < windowSeconds) return;
      const fps = frames / time;
      frames = 0;
      time = 0;
      if (fps < minFps) { stufe++; apply(); }
    },
    /* für Tests und Einstellungen */
    set(s) { stufe = Math.max(0, Math.min(RATIOS.length - 1, s)); apply(); },
  };
}
