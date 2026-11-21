# Robi in der Zahlenfabrik

Mathe, 3. Klasse. Jump-&-Run-Spiel: Roboter Robi läuft und hüpft durch eine Fabrik und bringt an
10 Stationen die Maschinen wieder zum Laufen. Dazu springt er von unten gegen den Block mit dem
richtigen Ergebnis. Am Ende wartet der Schrott-Roboter als Endgegner mit 3 weiteren Aufgaben.

Themen (am Start wählbar, in drei Gruppen, passend zum Bildungsplan 2016 Baden-Württemberg, Klassen 3/4):
- Rechnen: Einmaleins, Teilen, Plus bis 1000, Minus bis 1000, Zehner-Einmaleins (6 · 70, 420 : 6)
- Zahlen: Doppelt und Hälfte, Nachbarn und Runden (Vorgänger, Nachfolger, auf Zehner und Hunderter runden),
  Zahlenfolgen
- Größen: Größen umwandeln (Längen, Gewichte, Geld, Rauminhalt, Zeit)
- Alles: Bunt gemischt aus allen neun Themen

Die Aufgaben werden bei jedem Spiel neu gewürfelt, die falschen Antworten sind typische Rechenfehler.

Auch das Level wird bei jedem Spiel neu gewürfelt: Zwischen den Stationen liegen 9 Lauf-Abschnitte,
gezogen aus einem Vorrat von 18 (erst 3 leichte, dann 4 mittlere, dann 2 schwere). Darin gibt es Gruben,
Förderbänder, Rampen zum Hinauflaufen, Treppen-Berge, Aufzüge und fahrende Plattformen (beide orange).

Lernen:
- Fünf Stufen pro Thema. Jede richtige Antwort beim ersten Versuch hebt die Schwierigkeit um eine halbe
  Stufe, ein Fehler senkt sie um eine. Stufe 3 ist der Kern-Stoff der 3. Klasse, Stufe 1 und 2 sind leichter,
  4 und 5 schwerer (z. B. 345 + 278, Platzhalter-Aufgaben, Kommaschreibweise bei Geld und Längen).
  Das Spiel merkt sich pro Thema die erreichte Stufe und beginnt das nächste Mal eine darunter.
- Nach einem Fehler erscheint ein Tipp zur Aufgabe, der die Lösung nicht verrät.
- Aufgaben, die nicht beim ersten Versuch klappten, kommen beim Endgegner noch einmal. Außerdem merkt sich
  das Spiel bis zu 6 davon pro Thema und stellt im nächsten Spiel 2 davon wieder (Stationen 2 und 4).
  Wer sie dann gleich löst, hat sie abgehakt.
- Der Gewinn-Bildschirm zeigt die kniffligen Aufgaben mit Lösung und die erreichte Stufe.

Belohnungen:
- Robis Werkstatt: Die gesammelten Zahnräder kommen nach jedem geschafften Level aufs Konto. Damit kaufen
  die Kinder neue Farben, Hüte und Antennen für Robi (Knopf „🔧 Werkstatt“ auf Start- und Gewinn-Bildschirm).
- Serien-Bonus: Drei Aufgaben in Folge beim ersten Versuch richtig geben eine Extra-Kraft, der Reihe nach
  Schutzschild (fängt einen Gegner-Treffer ab), Zahnrad-Magnet und Doppelsprung. Magnet und Doppelsprung
  halten bis zur nächsten gelösten Station, der Schild, bis er gebraucht wird. Die Serie steht oben rechts.
- Farbwelten: Jedes Spiel würfelt eine von vier Welten (Tagschicht, Nachtschicht, Kesselraum, Dach).
- Musik: einfache Melodie im Hintergrund. Der Ton-Knopf hat drei Zustände: 🔊 alles an, 🔉 nur Geräusche, 🔇 aus.

Steuerung: Computer: Pfeiltasten oder A/D zum Laufen, Leertaste (auch Pfeil hoch oder W) zum Springen ·
Tablet/Handy: Knöpfe ◀ ▶ links unten und Sprung-Knopf rechts unten. Läuft im Quer- und Hochformat.

Hinweise:
- Kein Zeitdruck beim Rechnen: An den Stationen gibt es keine Gegner. Bei einer falschen Antwort
  darf man es noch einmal versuchen, bei der richtigen erscheint der Rechenweg.
- Keine Leben: Nach einem Gegner oder einer Grube geht es am letzten Fähnchen weiter.
- Sterne am Ende: 3 Sterne ab 12 von 13 Aufgaben beim ersten Versuch, 2 Sterne ab 8, sonst 1.
- Spielstand im Browser unter `mathe_robi_v1`: beste Sterne pro Thema (`best`), Ton an/aus (`mute`),
  Zahnräder auf dem Konto (`bank`), gekaufte Teile (`own`), was Robi trägt (`wear`), Musik an/aus (`music`),
  Stufe pro Thema (`lvl`) und Aufgaben zum Wiederholen pro Thema (`again`).
- Neue Teile für die Werkstatt kommen in die Tabelle `SHOP`, neue Farbwelten in `THEMES`
  (zum Ansehen: `?test&welt=<nr>`).
- Grafik und Töne entstehen im Code, es werden keine Bilder oder fremden Dateien geladen.
- Neue Abschnitte kommen in `buildLevel` in die Listen `EASY`, `MID` oder `HARD`. Mit `?test&alle` enthält
  das Level alle Abschnitte hintereinander, so lässt sich prüfen, ob jeder schaffbar ist.
- Durchspiel-Test: `node tools/spieltest.js mathe-robi` (Datei `tools/spieltests/mathe-robi.js`). Bei Änderungen
  am Spiel den Test mit anpassen.
- Für automatische Tests: Mit `?test` in der Adresse ist der Spielzustand als `window.ROBI` erreichbar.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/mathe-robi/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich zählt das Spiel Fehlversuche (Sprung gegen einen falschen Block) und Zeit und meldet sie am Ende mit `GameTest.reportScore` für die Bestenliste.
Spielstand pro Spieler: `persist()` meldet den Stand zusätzlich mit `GameTest.saveState(store)`. Die App speichert ihn in
der Tabelle `game_states` und legt ihn vor dem nächsten Start wieder unter `mathe_robi_v1` ab (`"saveKey"` in games.json).
So hat jedes Kind seine eigenen Zahnräder, Werkstatt-Teile, Stufen und Wiederholungs-Aufgaben – auf jedem Gerät.
Highscore: Punkte = Fehlversuche (weniger ist besser), bei Gleichstand die kürzere Zeit. Fehlversuche und Zeit stehen auf dem Gewinn-Bildschirm.

Durchspiel-Test: `node tools/spieltest.js mathe-robi`
