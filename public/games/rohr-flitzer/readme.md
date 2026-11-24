# Rohr-Flitzer

Ein Spiel der **Fisser-Flitzer**, ab 6 Jahren (Zielgruppe „Erwachsene · Spaß“). HTML-Spiel mit dem Kit:
`index.html`, `game.js` (Spiel), `draw.js` (Zeichnen), `maze.js` (Rohrsystem).

Die Kackwurst 💩 wird auf dem Dachboden von **Haus Buchhammer** heruntergespült und muss durch die
Abflussrohre bis unten in die Kanalisation finden. Manche Rohre sind verstopft (Klopapier mit 🚫) –
dann heißt es: Umweg suchen!

- Das ganze Rohrsystem ist von Anfang an zu sehen: 6 × 9 Knoten über 3 Stockwerke
  (Badezimmer, Küche, Keller). Jede Runde gibt es ein neues (`maze.js`).
- 5 Verstopfungen, bevorzugt auf dem kürzesten Weg – es gibt aber immer einen Weg.
- Die Wurst bewegt sich nur, solange eine Richtung gedrückt ist: kurz drücken = ein Feld,
  gedrückt halten = weiterflitzen. Von selbst läuft sie nie, auch nicht um Kurven.
- Die Szene füllt den Bildschirm: das Haus steht so groß wie möglich in der Mitte, drumherum Himmel mit
  Wolken, Hügel, Gärten mit Bäumen und Büschen, Erde mit Steinen und die Kanalisation über die ganze Breite.
  Hochkant liegen die Pfeil-Knöpfe in einer Reihe unten, quer ◀ ▶ links und ▲ ▼ rechts.
- Grafik (`draw.js`): Haus mit Ziegeldach, Zimmer mit Einrichtung, Metallrohre, Wolken, Rauch,
  Kanalisation mit Wasser und Ratte, Spritzer beim Platsch.
- Gleich schwer für alle: Jedes Rohrsystem wird so gewählt, dass der schnellste Weg perfekt gespielt
  etwa 5,15 Sekunden dauert (`bestTime` / `TARGET_TIME` in `maze.js`, erlaubt 5,1–5,3 s). Sehr gute Spieler
  schaffen damit etwa 5,5 s, gute etwa 6 s; Kinder brauchen etwa 15–25 Sekunden. Vorher schwankte die Bestzeit
  je nach Rohrplan zwischen etwa 5,5 und 7,6 Sekunden.
- Die Zeit hängt nicht von der Bildrate ab: Was in einem Bild über ein Feld hinaus gelaufen wird, zählt fürs
  nächste Feld (gleich schnell bei 60 und 120 Hz).

Steuerung: Computer: Pfeiltasten oder WASD gedrückt halten, Leertaste startet · Tablet/Handy: Pfeil-Knöpfe
gedrückt halten, auf der Szene wischen und den Finger liegen lassen, oder in die gewünschte Richtung tippen
(ein Feld). Pause über die Leiste oder P/Esc.

Highscore: Punkte = Sekunden bis in die Kanalisation (weniger ist besser). Die Zeit läuft nur im Spiel,
Pausen zählen nicht mit.

Durchspiel-Test: `node tools/spieltest.js rohr-flitzer` (`tools/spieltests/rohr-flitzer.js`, nutzt `window.SPIEL`).

Geschichte: bis November 2026 ein React-Spiel (`src/games/rohr-flitzer/`), dann ohne Änderung der
Spielregeln auf den HTML-Standard umgestellt. Neu dabei: Leiste und Pause-Fenster des Kits, Szene über den
ganzen Bildschirm (vorher ein Spielfeld mit Rand, quer sehr klein), Zeit ohne Pausen und mit Komma.
