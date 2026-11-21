# Flug über Europa

3D-Flugspiel: Mit dem Flugzeug über Europa fliegen, dem orangen Pfeil zum Ziel-Land folgen und bei der
roten Kugel (Hauptstadt) landen. Nach der Landung gibt es Fragen zum Land:

1. Welche Flagge gehört zum Land?
2. Wie heißt die Hauptstadt?
3. Welche Sehenswürdigkeit gibt es dort?
4. Wie viele Menschen leben ungefähr im Land?

Wer alle Länder besucht hat, wird „Europa-Meister“. Der Spielstand wird im Browser gespeichert (`europaflug_v1`).

Steuerung: Pfeiltasten oder A/D zum Lenken, W schneller, Leertaste landen.
Auf Tablet/Handy: ◀ ▶ gedrückt halten, 🚀 schneller, Landen-Button antippen.

Hinweise:
- Die Flaggen werden im Spiel selbst gezeichnet.
- Three.js wird aus `public/games/shared/vendor/` geladen, das Spiel braucht keine fremden Server.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/europaflug/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, Three.js aus `../shared/vendor/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich meldet das Spiel nach jedem neu besuchten Ziel den Punktestand mit `GameTest.reportScore` an die Bestenliste.
Highscore: Punkte (mehr ist besser) – es zählt der beste gemeldete Punktestand. Für den Durchspiel-Test bietet das Spiel mit `?test` den Zugang `window.FLUGTEST` (`tools/flugtest.js`).
Hinweis: Der Spielstand liegt im Browser (`localStorage`), nicht beim Login. Spielen zwei Kinder auf demselben Gerät, teilen sie sich den Spielstand.

Durchspiel-Test: `node tools/spieltest.js europaflug`
