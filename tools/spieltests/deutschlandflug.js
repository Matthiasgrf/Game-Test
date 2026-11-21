/* Durchspiel-Test für „Flug über Deutschland“. Aufruf: node tools/spieltest.js deutschlandflug
   Ablauf siehe tools/flugtest.js: letztes Ziel anfliegen, Fragen beantworten (eine falsch),
   gemeldete Punkte, Gewinn-Bildschirm und Rückweg zur Übersicht – auf Computer und Handy. */
import flugTest from '../flugtest.js';

export default (t) => flugTest(t, { win: 'Deutschland-Profi' });
