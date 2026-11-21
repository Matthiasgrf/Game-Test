# Labyrinth-Abenteuer

React-Spiel für Kinder ab ca. 5 Jahren. Code: `src/games/labyrinth/`.

- Challenge aus **5 Labyrinthen** hintereinander, jedes Level ein anderes Tier
  (Maus → Käse, Hase → Karotte, Hund → Knochen, Biene → Blume, Pinguin → Fisch).
- Drei Stufen: *Leicht* (4×4 bis 6×6), *Mittel* (5×5 bis 8×8), *Knifflig* (7×7 bis 11×11).
- In jedem Labyrinth liegen 3 ⭐ Sterne, bevorzugt in Sackgassen versteckt.
- Labyrinthe werden jedes Mal neu erzeugt (`maze.ts`, Recursive Backtracker mit ein paar
  Extra-Durchgängen, damit es weniger frustrierend ist).
- Soundeffekte per WebAudio (abschaltbar, Einstellung unter `labyrinth-muted` im Browser), Konfetti.

Steuerung: Pfeiltasten oder WASD (Computer). Auf dem Handy die Figur mit dem Finger durch die Gänge
ziehen oder das Steuerkreuz antippen (gedrückt halten = weiterlaufen).

Highscore: jede abgeschlossene Challenge, Variante = Stufe, Punkte = Sterne (`max_points` = mögliche Sterne).
Bestenliste je Stufe: meiste Sterne, dann schnellste Zeit.
