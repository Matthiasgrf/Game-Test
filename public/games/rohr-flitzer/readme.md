# Rohr-Flitzer

Ein Spiel für die Gruppe **Fisser-Flitzer**, ab 6 Jahren. Code: `src/games/rohr-flitzer/`.

Die Kackwurst 💩 wird auf dem Dachboden von **Haus Buchhammer** heruntergespült und muss durch die
Abflussrohre bis unten in die Kanalisation finden. Manche Rohre sind verstopft (Klopapier mit 🚫) –
dann heißt es: Umweg suchen!

- Das ganze Rohrsystem ist von Anfang an zu sehen: 6 × 9 Knoten über 3 Stockwerke
  (Badezimmer, Küche, Keller). Jede Runde gibt es ein neues (`maze.ts`).
- 5 Verstopfungen, bevorzugt auf dem kürzesten Weg – es gibt aber immer einen Weg.
- Die Wurst bewegt sich nur, solange eine Richtung gedrückt ist: kurz drücken = ein Feld,
  gedrückt halten = weiterflitzen. Von selbst läuft sie nie, auch nicht um Kurven.
- Das Spielfeld passt sich an den Bildschirm an (Handy, Tablet, Computer).
- Grafik (`draw.ts`): Haus mit Ziegeldach, Zimmer mit Einrichtung, Metallrohre, Wolken, Rauch,
  Kanalisation mit Wasser und Ratte, Spritzer beim Platsch.
- Eine Runde dauert für Kinder etwa 20–30 Sekunden (perfekt gespielt etwa 8 Sekunden).

Steuerung: Computer: Pfeiltasten oder WASD gedrückt halten, Leertaste startet · Tablet/Handy: Pfeil-Knöpfe
unter dem Spielfeld gedrückt halten, auf dem Spielfeld wischen und den Finger liegen lassen, oder in die
gewünschte Richtung tippen (ein Feld).

Highscore: Punkte = Sekunden bis in die Kanalisation (weniger ist besser).

Durchspiel-Test: `node tools/spieltest.js rohr-flitzer`
