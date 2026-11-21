# Getreide-Abenteuer (Sachunterricht)

3D-Spiel für die 3. Klasse: Mit dem Traktor über das Getreidefeld fahren und an 10 Stationen
Aufgaben lösen (Getreidekorn und Mähdrescher beschriften, Getreidepflanze, Lückentext, Rätsel,
Wachstum im Jahreslauf, Arbeit früher und heute, Inhaltsstoffe).

Steuerung: Pfeiltasten am Computer, Pfeil-Buttons auf Tablet/Handy.
Three.js wird aus `public/games/shared/vendor/` geladen, das Spiel braucht keine fremden Server.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/Sachunterricht-Getreide/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, Three.js aus `../shared/vendor/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich zählt das Spiel Fehlversuche (Prüfen mit falschen Feldern) und Zeit und meldet sie am Ende mit `GameTest.reportScore` für die Bestenliste.
Highscore: Punkte = Fehlversuche (weniger ist besser), bei Gleichstand die kürzere Zeit. Fehlversuche und Zeit stehen auf dem Gewinn-Bildschirm.

Durchspiel-Test: `node tools/spieltest.js sachunterricht-getreide`
