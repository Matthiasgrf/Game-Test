# Rohr-Flitzer

Ein Spiel für die Gruppe **Fisser-Flitzer**, ab 6 Jahren. Code: `src/games/rohr-flitzer/`.

Die Kackwurst 💩 wird auf dem Dachboden von **Haus Buchhammer** heruntergespült und muss durch die
Abflussrohre bis unten in die Kanalisation finden. Manche Rohre sind verstopft (Klopapier mit 🚫) –
dann heißt es: Umweg suchen!

- Das ganze Rohrsystem ist von Anfang an zu sehen: 6 × 9 Knoten über 3 Stockwerke
  (Badezimmer, Küche, Keller). Jede Runde gibt es ein neues (`maze.ts`).
- 5 Verstopfungen, bevorzugt auf dem kürzesten Weg – es gibt aber immer einen Weg.
- Die Wurst flitzt nach einem Wisch von selbst weiter, auch um Kurven, und hält an jeder
  Abzweigung. Eine Richtung kann man schon vorher wählen, sie gilt an der nächsten passenden Stelle.
- Das Spielfeld passt sich an den Bildschirm an (Handy, Tablet, Computer).
- Grafik (`draw.ts`): Haus mit Ziegeldach, Zimmer mit Einrichtung, Metallrohre, Wolken, Rauch,
  Kanalisation mit Wasser und Ratte, Spritzer beim Platsch.
- Eine Runde dauert für Kinder etwa 20–30 Sekunden (perfekt gespielt etwa 8 Sekunden).

Steuerung: Computer: Pfeiltasten oder WASD, Leertaste startet · Tablet/Handy: auf dem Spielfeld wischen,
in die gewünschte Richtung tippen oder die Pfeil-Knöpfe unter dem Spielfeld.

Highscore: Punkte = Sekunden bis in die Kanalisation (weniger ist besser).

Durchspiel-Test: `node tools/spieltest.js rohr-flitzer`
