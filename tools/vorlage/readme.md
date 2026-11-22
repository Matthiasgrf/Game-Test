# SPIEL_TITEL

SPIEL_ALTER. TODO: zwei bis drei Sätze, worum es geht und was die Kinder lernen.

Steuerung: Computer: Pfeiltasten (P = Pause, M = Ton) · Tablet/Handy: Knöpfe unten oder auf das Ziel tippen.
TODO: an das eigene Spiel anpassen.

Ausrichtung: SPIEL_AUSRICHTUNG (wie in games.json; „any“ = hoch und quer).

Highscore: SPIEL_HIGHSCORE

Aufbau: `index.html` (Gerüst und Fenster), `game.js` (Spiellogik), `assets/` (Bilder als WebP/JPEG, Töne als MP3).
Leiste, Pause, Ton, Vollbild, Drehen-Hinweis und Speicher kommen aus `../shared/kit/` (docs/GAME_STANDARD.md).

Hinweise:
- TODO: Besonderheiten, Quellen für Bilder oder Daten.

Durchspiel-Test: `node tools/spieltest.js SPIEL_KEY`
