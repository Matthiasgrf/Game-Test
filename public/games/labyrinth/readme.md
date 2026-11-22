# Labyrinth-Abenteuer

HTML-Spiel mit dem Kit (`index.html`, `game.js`, `maze.js`) für Kinder ab ca. 5 Jahren.

- Challenge aus **5 Labyrinthen** hintereinander, jedes Level ein anderes Tier
  (Maus → Käse, Hase → Karotte, Hund → Knochen, Biene → Blume, Pinguin → Fisch).
- Drei Stufen: *Leicht* (4×4 bis 6×6), *Mittel* (5×5 bis 8×8), *Knifflig* (7×7 bis 11×11).
- In jedem Labyrinth liegen 3 ⭐ Sterne, bevorzugt in Sackgassen versteckt.
- Labyrinthe werden jedes Mal neu erzeugt (`maze.js`, Recursive Backtracker mit ein paar
  Extra-Durchgängen, damit es weniger frustrierend ist).
- Kein Zeitdruck: die Zeit zählt nur für die Bestenliste, Pausen zählen nicht mit.
- Klänge über das Kit (Ton-Einstellung gilt für alle Spiele), Konfetti nach jedem Labyrinth.

Steuerung: Pfeiltasten oder WASD (gedrückt halten = weiterlaufen). Mit Finger oder Maus die Figur durch die
Gänge ziehen oder das Steuerkreuz antippen (gedrückt halten = weiterlaufen). Pause über die Leiste oder P/Esc;
im Pause-Fenster „↩ Andere Stufe“ führt zurück zur Stufen-Auswahl.

Darstellung: Die Szene füllt den Bildschirm. Das Labyrinth ist quadratisch und liegt so groß wie möglich darin –
hochkant mit Anzeigen oben und Steuerkreuz unten, quer mit Anzeigen links und Steuerkreuz rechts
(`layout()` in `game.js` nimmt die Aufteilung mit dem größeren Labyrinth).

Highscore: jede abgeschlossene Challenge, Variante = Stufe, Punkte = Sterne (`maxPoints` = mögliche Sterne),
dazu die Zeit. Bestenliste je Stufe: meiste Sterne, dann schnellste Zeit. Auf dem Start-Bildschirm steht der
eigene Rekord je Stufe (`kit.storage.getScores()`).

Test: `node tools/spieltest.js labyrinth` (`tools/spieltests/labyrinth.js`, nutzt `window.SPIEL`).

Geschichte: bis November 2026 ein React-Spiel (`src/games/labyrinth/`), dann ohne Änderung der Spielregeln
auf den HTML-Standard umgestellt. Neu dabei: Leiste und Pause-Fenster des Kits, bildschirmfüllende Szene,
Schatten und Glanz an den Wänden, Zeit ohne Pausen.
