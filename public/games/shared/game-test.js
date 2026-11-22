/* Verbindung zwischen einem eigenständigen HTML-Spiel und der Game-Test-App.
   Die App zeigt HTML-Spiele in einem iframe (src/games/HtmlGame.tsx) und speichert
   gemeldete Ergebnisse für den eingeloggten Spieler in Supabase.

   Einbinden im <head> des Spiels:   <script src="../shared/game-test.js"></script>
   Am Ende des Spiels:               GameTest.reportScore({ points: 3, maxPoints: 5, seconds: 95, variant: "leicht" })
     points     Punkte (Pflicht, ganze Zahl ≥ 0). Ob mehr oder weniger besser ist, steht in der Tabelle games.
     maxPoints  höchstmögliche Punkte (optional)
     seconds    Spieldauer in Sekunden (optional, entscheidet bei Gleichstand)
     variant    Spielvariante, z. B. Schwierigkeitsstufe (optional)
   Spielstand pro Spieler (nur mit "saveKey" in games.json):
                                     GameTest.saveState(store)   bei jedem Speichern, zusätzlich zu localStorage
     Die App lädt den Stand des Spielers vor dem Start aus Supabase und legt ihn unter saveKey in
     localStorage ab – das Spiel liest ihn also wie gewohnt beim Start von dort.
   Eigene Ergebnisse (z. B. für „Dein Rekord“):  GameTest.getScores().then(function (liste) { … })
     liste: [{ points, maxPoints, seconds, variant }] des eingeloggten Spielers; außerhalb der App [].
   Spiele ohne Highscore rufen reportScore einfach nicht auf (die App ignoriert es ohnehin).
   Neue Spiele nutzen statt dieser Datei die Speicher-Schicht kit/storage.js (sie ruft GameTest auf).
   Außerhalb der App geöffnet (ohne iframe) passiert nichts – das Spiel läuft normal. */
(function () {
  'use strict';
  var embedded = window.parent !== window;
  var waiting = {};
  var nextId = 1;
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== window.parent || e.origin !== window.location.origin || !d || d.source !== 'game-test-app') return;
    if (d.type === 'scores' && waiting[d.id]) { waiting[d.id](Array.isArray(d.scores) ? d.scores : []); delete waiting[d.id]; }
  });
  window.GameTest = {
    embedded: embedded,
    reportScore: function (result) {
      if (!embedded || !result) return;
      window.parent.postMessage({
        source: 'game-test',
        type: 'score',
        points: result.points,
        maxPoints: result.maxPoints,
        seconds: result.seconds,
        variant: result.variant
      }, window.location.origin);
    },
    getScores: function () {
      if (!embedded || typeof Promise === 'undefined') return typeof Promise === 'undefined' ? null : Promise.resolve([]);
      return new Promise(function (resolve) {
        var id = nextId++;
        waiting[id] = resolve;
        /* Antwortet die App nicht (ältere Version, offline), geht es ohne Ergebnisse weiter */
        setTimeout(function () { if (waiting[id]) { waiting[id]([]); delete waiting[id]; } }, 4000);
        window.parent.postMessage({ source: 'game-test', type: 'getScores', id: id }, window.location.origin);
      });
    },
    saveState: function (data) {
      if (!embedded || !data || typeof data !== 'object') return;
      try {
        window.parent.postMessage({ source: 'game-test', type: 'state', data: JSON.parse(JSON.stringify(data)) }, window.location.origin);
      } catch (e) { /* nicht als JSON speicherbar */ }
    }
  };
})();
