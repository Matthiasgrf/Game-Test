# Elisabeth von Thüringen

3D-Religions-Abenteuer für die 3. Klasse: Elisabeth läuft über eine Wiese zu 20 Stationen
und beantwortet dort Quizfragen zu ihrem Leben – in der Reihenfolge ihres Lebens:

- Von Ungarn auf die Wartburg: Eltern Andreas und Gertrud, Ritter des Landgrafen, Heirat verbindet
  die Länder, Reise mit Ritter Walter und Brautschatz, Landgräfin Sophie
- Ohne Eltern verreisen: Was denkt und fühlt die 4-jährige Elisabeth?
- Elisabeth heiratet Ludwig: Herrmann stirbt, Hochzeitsfest, die Armen nicht vergessen
- Krone, Hilfe für die Armen, Rosenwunder, Hospital
- Die Werke der Barmherzigkeit: sechs Satzanfänge mit dem passenden Satzende verbinden,
  dazu gute Werke im Alltag (trösten, aufhelfen, nicht auslachen, teilen)
- Abschied von der Wartburg, Marburg, Heilige, Elisabeth-Tag (19. November)

Manche Stationen haben mehrere Fragen nacheinander („Frage 2 / 6“, Knopf „Weiter“).

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
