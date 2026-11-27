# Katzen-Darts

ab 12 Jahren · für die Fisser-Flitzer. Après-Ski in einer Hütte in Fiss: An der Holzwand hängt eine Dartscheibe,
drumherum laufen Katzen über Regal, Fensterbank und Theke. Man wirft auf die Scheibe oder auf die Katzen.
Manchmal fliegt Bier statt Pfeil, und je höher die Promille stehen, desto stärker wackelt das Fadenkreuz.

## Ablauf

5 Runden mit je 3 Würfen, also 15 Würfe (etwa 2–3 Minuten). Das Fadenkreuz schwankt leicht.
**Halten** lädt die Kraft (Ring ums Fadenkreuz), **Loslassen** wirft. Im grünen Bereich (60–80 %) landet der Wurf
genau im Fadenkreuz. Mit zu wenig Kraft landet er tiefer, mit zu viel höher. Der Pfeil fliegt 0,4 s, deshalb muss
man auf laufende Katzen vorhalten.

**Zeitlimit:** Jeder Wurf hat 5 Sekunden. Der äußere Ring ums Fadenkreuz läuft ab und wird von Grün über Gelb zu
Rot. Ab 3 Sekunden steht die Zahl daneben, in der letzten Sekunde tickt es und der Ring pulsiert. Das Halten zum
Kraftaufbau zählt mit. Ist die Zeit um, verfällt der Wurf mit 0 Punkten und ist verbraucht (ein ×2 der Ski-Katze
und das Pech der schwarzen Katze zählen ihn mit, ein verfallener Bierwurf hebt die Promille nicht).
Während der Anzeige „Runde X von 5“ läuft die Zeit noch nicht.

| Treffer | Punkte |
|---|---|
| Segment 1–20 / Double / Triple | Zahl × 1 / × 2 / × 3 |
| Bull (außen) / Bullseye | 25 / 50 |
| Daneben (Wand) | 0, „Plonk“ |

| Katze | Verhalten | Punkte / Effekt |
|---|---|---|
| Tiger-Kater | normales Tempo, Regal und Theke | +30 |
| Pummel | sehr langsam, groß | +10 |
| Ski-Katze (Skibrille, Schal) | flitzt über die Theke | +40, nächster Wurf ×2 |
| Goldene Glückskatze | selten (alle 14–22 s), sehr schnell | +100 |
| Schwarze Katze | schleicht, halb durchsichtig | −25, 3 Würfe lang wackelt es stärker |
| Omas Perserkatze | schläft auf der Fensterbank | 0, Oma schimpft |
| Hüttenwirts-Katze (Tirolerhut) | sitzt am Zapfhahn | −50, „Hausverbot!“ |

Getroffene Katzen machen „Plopp“, sträuben das Fell, fauchen und flüchten. Bald kommt eine neue Katze.

**Bier statt Pfeil:** In 2 bis 5 der 15 Würfe kommt Bier, zufällig verteilt (der erste Wurf ist immer ein Pfeil).
Was als Nächstes fliegt, steht unten in der Mitte.
- Maßkrug: langsam, Spritz-Radius. Er trifft alle Katzen in der Nähe und die Scheibe zur Hälfte.
- Bierflasche: fliegt im hohen Bogen und landet etwas daneben. Im Bullseye gibt es den Prost-Bonus: 100.
- Jeder Bierwurf: +0,3 ‰. Das Fadenkreuz wackelt danach stärker.

**Abrechnung:** Punkte von der Scheibe, Punkte von Katzen, Abzüge, Bierwürfe und Promille. Dazu ein Titel:
„Katzen-König von Fiss“, „Thekenkönig“, „Tierschutz-Albtraum“, „Phil Taylor vom Hüttenabend“ oder bei
wenig Punkten „Hütten-Lehrling“.

## Steuerung

- Computer: Maus zielt, Maustaste halten und loslassen. Alternativ Pfeiltasten und Leertaste. P = Pause, M = Ton.
- Tablet/Handy: Finger aufsetzen und halten. Das Fadenkreuz erscheint etwas über dem Finger, damit man es sieht.
  Ziehen zielt, Loslassen wirft.

Ausrichtung: hoch und quer (`any`). Die Szene ordnet sich neu an: Quer liegen Regal links und Fenster rechts
neben der Scheibe. Hoch liegt das Regal darüber und das Fenster darunter.

## Highscore

Gesamtpunkte (mehr ist besser), bei Gleichstand zählt die kürzere Spielzeit. Gespeichert werden höchstens 0 Punkte
nach unten (die Bestenliste kennt keine Minuspunkte, die Abrechnung zeigt den echten Wert).
Statt eines Namensfelds gilt die gemeinsame Bestenliste der App: Jede Person ist angemeldet. Wer das Spiel
sieht, regelt die Gruppe (Fisser-Flitzer), dort sieht man die besten Ergebnisse aller.

## Aufbau

`index.html` (Gerüst und Fenster) und `game.js` (Spiellogik und Zeichnen mit Canvas 2D, keine Bilddateien).
Hintergrund und Scheibe werden nur bei Größenänderungen neu gemalen. Töne mit Web Audio aus dem Kit:
„Plonk“, „Tock“, Miau, Fauchen, Glasklirren, Brummen des Wirts. Leiste, Pause, Ton, Vollbild, Drehen-Hinweis
und Speicher kommen aus `../shared/kit/` (docs/GAME_STANDARD.md).

Durchspiel-Test: `node tools/spieltest.js katzen-darts`
