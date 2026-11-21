# Rohr-Flitzer

Ein Spiel für die Gruppe **Fisser-Flitzer**, ab 6 Jahren. Code: `src/games/rohr-flitzer/`.

Die Kackwurst 💩 wird im Dachgeschoss von **Haus Buchhammer** heruntergespült und muss durch ein
Labyrinth aus Abflussrohren bis unten in die Kanalisation finden. Manche Rohre sind verstopft
(Klopapier-Pfropfen mit ❌) – dann heißt es: Umweg suchen!

- Jede Runde ein neues Rohrsystem (`maze.ts`): 9 × 16 Knoten über 4 Stockwerke
  (Bad, Gäste-WC, Küche, Waschküche), Tiefensuche plus Extra-Rohre für Schleifen.
- Bis zu 16 Verstopfungen, bevorzugt auf dem kürzesten Weg – aber immer so, dass es einen Weg gibt.
- Im Rohr ist es dunkel: sichtbar ist nur die Umgebung der Wurst, Erkundetes bleibt sichtbar.
  Der Ausgang in die Kanalisation ist immer zu sehen.
- Schwerkraft: die Wurst rutscht von allein nach unten, nach oben geht es nur langsam.
- Eine Runde dauert etwa 20–30 Sekunden. Nach 60 Sekunden ist das Rohr „eingetrocknet“.

Steuerung: Computer: Pfeiltasten oder WASD, Leertaste startet · Tablet/Handy: auf dem Spielfeld wischen
oder das Steuerkreuz antippen (gedrückt halten = weiterflitzen).

Highscore: Punkte = Sekunden bis in die Kanalisation (weniger ist besser).

Durchspiel-Test: `node tools/spieltest.js rohr-flitzer`
