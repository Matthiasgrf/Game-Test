# Elisabeth von Thüringen

3D-Religions-Abenteuer für die 3. Klasse: Elisabeth läuft über eine Wiese zu 20 Stationen
und löst dort Aufgaben zu ihrem Leben – in der Reihenfolge ihres Lebens:

- Herkunft (Ungarn, König Andreas, Mutter Gertrud), Besuch der Ritter, warum die Heirat die Länder verbindet
- Ohne Eltern in ein fremdes Land: was fremd ist, welches Gefühl Elisabeth hat
- Reise mit Ritter Walter und Brautschatz, Kindheit auf der Wartburg bei Eisenach, Landgräfin Sophie
- Herrmann stirbt, Ludwig heiratet Elisabeth, Hochzeitsfest, Ludwig erlaubt ihr zu helfen
- Krone in der Kirche, Hilfe für die Armen (Hungersnot), Rosenwunder, der Kranke im Bett, Hospital
- Die Werke der Barmherzigkeit (Paare verbinden) und gute Werke heute
- Ludwigs Tod, Abschied von der Wartburg, Marburg, Heilige, Elisabeth-Tag (19. November)

Aufgabenarten (seit November 2026, damit Auswendiglernen nicht mehr hilft und die Kinder genau lesen):

| Art | so |
|---|---|
| eine Antwort | Antworten werden bei jedem Spiel gemischt |
| Stimmt / stimmt nicht | je Aufgabe gibt es einen wahren und einen falschen Satz, das Spiel zeigt zufällig einen |
| Fehler finden | falsches Wort im Text antippen, dann das richtige auswählen |
| Reihenfolge | Sätze einer Geschichte der Reihe nach antippen |
| mehrere Antworten | alle richtigen antippen, dann „Prüfen“ |
| Paare | Satzanfang links mit dem Satzende rechts verbinden |

Manche „Fehler finden“-Aufgaben haben zwei Varianten, das Spiel wählt zufällig. Jede Station hat eine oder mehrere
Aufgaben („Aufgabe 2 / 3“, Knopf „Weiter“). Jeder falsche Tipp (bei „mehrere Antworten“: jedes falsche Prüfen) ist
ein Fehlversuch. Die Aufgaben stehen in `index.html` (`stationsData`), die Art steht im Kommentar darüber.

Steuerung: Pfeiltasten / WASD, Klick bzw. Tippen auf die Wiese oder Steuerkreuz auf dem Handy.

Grafik (`scene.js`, Three.js aus `../shared/vendor/`): Wiese mit Sandweg, sanfte Hügel und Wald rundherum, die
Wartburg auf ihrem Berg im Hintergrund, Himmel mit ziehenden Wolken, Blumen. Jede Station hat einen Steinsockel
mit goldenem Ring, eine Lichtsäule, eine schwebende Rose und ihre Nummer (erledigt: grüner Ring und ✓).
Elisabeth trägt ein blaues Kleid, einen roten Mantel, eine Krone und einen Korb mit Brot und Rosen. Die Kamera
folgt ihr schräg von hinten; hochkant steht sie weiter weg und zeigt mehr Wiese vor Elisabeth. Auf schwachen
Geräten schaltet die Detailstufe des Kits erst die Schatten, dann Blumen und Wolken ab.
Bis November 2026 zeichnete das Spiel mit einer eigenen 2D-Projektion (flache Formen, ohne Himmel).


## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele. Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Zusätzlich zählt das Spiel Fehlversuche und Zeit und meldet sie am Ende mit `GameTest.reportScore`
(`../shared/game-test.js`) für die Bestenliste. Die Links „🏠 Alle Spiele“ führen zur App-Übersicht.
Highscore: Punkte = Fehlversuche (weniger ist besser), bei Gleichstand die kürzere Zeit.

Durchspiel-Test: `node tools/spieltest.js elisabeth`
