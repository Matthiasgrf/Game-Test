/* Zoom-Schutz für die Spiele (Handy und Tablet).
   Kinder zoomen beim Spielen leicht aus Versehen (Doppeltipp, zwei Finger). Weil die Spiele
   Wischgesten selbst nutzen (touch-action:none), kommt man danach oft nicht mehr auf 100 % zurück.
   Dieses Skript
   - verhindert Doppeltipp-Zoom (touch-action:manipulation), schnelles Tippen bleibt möglich,
   - verhindert Zwei-Finger-Zoom auch auf iPhone/iPad (Safari ignoriert user-scalable=no),
   - setzt den Zoom automatisch auf 100 % zurück, falls es doch einmal passiert ist.
   Einbinden im <head> jedes Spiels:  <script src="../../assets/zoom-schutz.js"></script>
   Zoom am Computer (Strg + Mausrad / Strg + Plus) bleibt unberührt. */
(function () {
  'use strict';
  var doc = document;

  /* Doppeltipp-Zoom aus. touch-action wirkt als Schnittmenge mit den Vorfahren,
     vorhandene touch-action:none in den Spielen bleiben also gültig. */
  var style = doc.createElement('style');
  style.textContent = 'html{touch-action:manipulation}';
  (doc.head || doc.documentElement).appendChild(style);

  /* Zwei-Finger-Zoom aus. */
  var stop = function (e) { if (e.cancelable) e.preventDefault(); };
  doc.addEventListener('gesturestart', stop, { passive: false });   // iOS Safari
  doc.addEventListener('gesturechange', stop, { passive: false });
  doc.addEventListener('gestureend', stop, { passive: false });
  doc.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) stop(e);
  }, { passive: false });

  /* Notfall: doch gezoomt -> zurück auf 100 %. Kurz maximum-scale=1 setzen bringt
     auch iOS Safari dazu, den Zoom zurückzunehmen; danach Originalwert wiederherstellen. */
  var vv = window.visualViewport;
  if (!vv) return;
  var busy = false;
  function reset() {
    if (busy || vv.scale <= 1.01) return;
    busy = true;
    var meta = doc.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = doc.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width,initial-scale=1';
      doc.head.appendChild(meta);
    }
    var original = meta.getAttribute('content') || '';
    var forced = original
      .replace(/,?\s*(?:maximum-scale|minimum-scale|initial-scale|user-scalable)\s*=\s*[^,]*/gi, '')
      .replace(/^\s*,/, '') + ',initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no';
    meta.setAttribute('content', forced);
    setTimeout(function () {
      meta.setAttribute('content', original);
      window.scrollTo(0, 0);
      busy = false;
    }, 300);
  }
  var timer = 0;
  function later() { clearTimeout(timer); timer = setTimeout(reset, 250); }
  vv.addEventListener('resize', later);
  doc.addEventListener('touchend', later, { passive: true });
})();
