/* Durchspiel-Test für „Flug über die Welt“. Aufruf: node tools/spieltest.js weltflug
   Ablauf siehe tools/flugtest.js: letztes Ziel anfliegen, Fragen beantworten (eine falsch),
   gemeldete Punkte, Gewinn-Bildschirm und Rückweg zur Übersicht – auf Computer und Handy. */
import flugTest from '../flugtest.js';

export default (t) => flugTest(t, { win: 'Welt-Meister' });
