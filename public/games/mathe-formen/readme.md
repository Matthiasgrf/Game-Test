# Die Formen-Werkstatt

Mathe, 3. Klasse. Geometrie-Spiel zum Bildungsplan 2016 Baden-Württemberg, Klassen 3/4, Bereich 3.2.2
„Raum und Form“ – den das Spiel „Robi in der Zahlenfabrik“ nicht abdeckt. Füchsin Tilda baut in ihrer
Werkstatt eine Rakete. Für jeden der 10 Aufträge gibt es ein Bauteil, am Ende ist die Rakete fertig.

Themen (am Start wählbar):
- Ebene Figuren: Quadrat, Rechteck, Dreieck, Kreis benennen (auch gedreht), Ecken und Seiten zählen,
  Formen im Alltag (Münze, Schild, Tür …), Figuren in einem Bild zählen, Eigenschaften,
  parallel / senkrecht (3.2.2.2)
- Körper: Würfel, Quader, Kugel, Zylinder (Stufe 3 auch Pyramide und Kegel) in 3D zum Drehen,
  Ecken/Kanten/Flächen zählen, Gegenstände aus dem Alltag zuordnen, Eigenschaften (3.2.2.2)
- Würfelnetze: „Kann man daraus einen Würfel falten?“, das richtige Netz auswählen, gegenüberliegende
  Fläche finden. Nach der richtigen Antwort faltet sich das Netz in 3D zum Würfel (3.2.2.2, 3.2.2.1)
- Würfelbauten: Würfel zählen, Ansicht von oben und von vorne, passenden Bauplan finden – das Gebäude
  lässt sich drehen (3.2.2.1)
- Spiegeln: achsensymmetrische Buchstaben, „Ist die Figur symmetrisch?“, Spiegelachse finden,
  Figur im Gitter durch Antippen spiegeln (3.2.2.3)
- Fläche und Umfang: Kästchen zählen, Umfang in Kästchenseiten, Flächen vergleichen, gleicher Inhalt
  mit verschiedenem Umfang, Quader aus Einheitswürfeln (3.2.2.4)
- Bunt gemischt: aus allen Themen

Die Aufgaben werden bei jedem Spiel neu erzeugt. Die Würfelnetze stammen aus allen 35 Formen aus sechs
Quadraten; ob eine Form ein Würfelnetz ist und welche Flächen gegenüberliegen, rechnet das Spiel aus,
indem es einen Würfel über das Netz rollt.

Lernen:
- Drei Stufen pro Thema. Richtig beim ersten Versuch hebt die Stufe um eine halbe, ein Fehler senkt sie
  um eine. Das Spiel merkt sich die Stufe und beginnt das nächste Mal eine halbe Stufe darunter.
- Bei einer falschen Antwort erscheint ein Tipp, dann ein neuer Versuch. Bei der richtigen Antwort eine
  kurze Erklärung, oft mit Hilfe im Bild (Ecken nummeriert, Spiegelachse, Rand hervorgehoben).
- Beim Spiegeln zeigt das Spiel nach dem zweiten Fehlversuch, welche Kästchen noch falsch sind.
- Am Ende: Rakete, Sterne (3 ab 9 von 10 beim ersten Versuch, 2 ab 6) und „Nochmal spielen“.
- Fachlich: Ein Quadrat ist auch ein Rechteck, ein Würfel auch ein Quader – deshalb wird nie
  „Rechteck“ als falsche Antwort zum Quadrat (oder „Quader“ zum Würfel) angeboten.

Steuerung: Antworten anklicken oder antippen (Computer auch Tasten 1–4). 3D-Körper mit Maus oder Finger
drehen. Beim Spiegeln Kästchen antippen und „Fertig – prüfen“ wählen. Läuft im Hoch- und Querformat.

Hinweise:
- Spielstand im Browser unter `mathe_formen_v1`: beste Sterne pro Thema (`best`), Stufe pro Thema (`lvl`),
  Ton aus (`mute`).
- 3D mit Three.js r128 aus `public/games/shared/vendor/`. Ohne WebGL fehlen die Würfelbauten und die Quader-Aufgaben,
  Körper erscheinen dann als Bild, Würfelnetze ohne Falt-Animation.
- Grafik und Töne entstehen im Code, es werden keine Bilder oder fremden Dateien geladen.
- Neue Aufgabenarten kommen in die Tabellen `FIGT`, `KT`, `NT`, `BT`, `ST` oder `AT` und in die Auswahl in `GEN`.
- Durchspiel-Test: `node tools/spieltest.js mathe-formen` (Datei `tools/spieltests/mathe-formen.js`).
  Mit `?test` in der Adresse ist der Spielzustand als `window.FORMEN` erreichbar.
- Noch nicht enthalten aus 3.2.2: Wege und Lagebeziehungen auf Plänen, Bandornamente/Parkette,
  Vergrößern und Verkleinern im Gitter.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/mathe-formen/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, Three.js aus `../shared/vendor/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich zählt das Spiel Fehlversuche und Zeit und meldet sie am Ende mit `GameTest.reportScore` für die Bestenliste.
Highscore: Punkte = Fehlversuche (weniger ist besser), bei Gleichstand die kürzere Zeit. Fehlversuche und Zeit stehen auf dem Gewinn-Bildschirm.

Durchspiel-Test: `node tools/spieltest.js mathe-formen`
