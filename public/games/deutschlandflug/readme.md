# Flug über Deutschland

Flugspiel nach dem Vorbild von Flug über Europa: Mit dem Flugzeug über Deutschland zu allen 16 Bundesländern fliegen,
in der jeweiligen Hauptstadt landen und zwei Fragen beantworten:

1. Welche Flagge gehört zum Bundesland?
2. Wie heißt die Hauptstadt? (Bei den Stadtstaaten Berlin, Hamburg und Bremen wird erklärt, dass Stadt und Bundesland zusammenfallen.)

Danach gibt es einen kurzen Wissens-Satz zum Bundesland. Der Spielstand wird im Browser gespeichert (`deutschlandflug_v1`).

Steuerung: Pfeiltasten oder A/D zum Lenken, W schneller, S langsamer, Leertaste landen.
Auf Tablet/Handy: ◀ ▶ gedrückt halten, 🚀 schneller, Landen-Button antippen.

Hinweise:
- Grenzen der Bundesländer und Nachbarländer: [Natural Earth](https://www.naturalearthdata.com/) (gemeinfrei), vereinfacht.
- Die Landesflaggen werden im Spiel selbst gezeichnet. Wappen sind dabei stark vereinfacht.
- Die Pins von Mainz/Wiesbaden und Berlin/Potsdam sind leicht auseinandergerückt, damit man sie beim Fliegen unterscheiden kann.
- Three.js wird aus `public/games/shared/vendor/` geladen, das Spiel braucht keine fremden Server.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/deutschlandflug/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, Three.js aus `../shared/vendor/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich meldet das Spiel nach jedem neu besuchten Ziel den Punktestand mit `GameTest.reportScore` an die Bestenliste.
Highscore: Punkte (mehr ist besser) – es zählt der beste gemeldete Punktestand. Für den Durchspiel-Test bietet das Spiel mit `?test` den Zugang `window.FLUGTEST` (`tools/flugtest.js`).
Hinweis: Der Spielstand liegt im Browser (`localStorage`), nicht beim Login. Spielen zwei Kinder auf demselben Gerät, teilen sie sich den Spielstand.

Durchspiel-Test: `node tools/spieltest.js deutschlandflug`
