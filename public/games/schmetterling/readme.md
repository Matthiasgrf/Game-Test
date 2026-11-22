# Flatter, der Schmetterling

5–7 Jahre, Kategorie Kindergarten. Flatter, ein bunter Schmetterling, fliegt über eine 3D-Blumenwiese.
Er sammelt Münzen, fliegt durch Herzen und schnappt fliegende Quallen. Findet er ein Einhorn, kommt der Fuchs
als Helfer: Er läuft vor Flatter her und frisst die Quallen. In 4 Zauberblumen warten Aufgaben:
zweimal Tier-Memory (5 × 4 Karten, 10 Tier-Paare) und zweimal ein Labyrinth (7 × 7 und 9 × 9 Felder).
Die Kinder üben Merkfähigkeit, räumliches Denken und Orientierung (Pfeil zur nächsten Zauberblume).

## Steuerung

- **Computer:** Pfeiltasten ↑ vor, ↓ zurück, ← → drehen · Leertaste: schnappen · P = Pause, M = Ton
- **Tablet/Handy:** Steuerknüppel unten links (nach oben schieben = vorwärts, zur Seite = drehen) · Knopf
  „Schnapp!“ unten rechts
- **Memory:** Karten antippen bzw. anklicken (auch mit Tab + Enter)
- **Labyrinth:** Pfeiltasten, Steuerkreuz (Touch), Wischen oder ein Feld in derselben Reihe/Spalte antippen –
  Flatter fliegt bis dorthin, solange keine Hecke im Weg ist. Taste gedrückt halten = weiterfliegen.

Ausrichtung: hoch und quer (`any`). Im Hochformat zeigt die Kamera mehr von oben, das Memory hat 4 × 5 Karten.

## Punkte (Highscore)

Mehr ist besser, bei Gleichstand zählt die kürzere Zeit. Höchstens 1 610 Punkte.

| | Punkte |
|---|---|
| Münze (40 Stück) | 10 |
| Herz durchfliegen (8 Stück) | 20 – und ein Herz dazu (höchstens 5) |
| Qualle schnappen oder vom Fuchs fressen lassen (12 Stück) | 25 |
| Einhorn (3 Stück) – der Fuchs hilft 60 Sekunden | 50 |
| Tier-Memory | 150, ab dem 11. Zug 5 weniger je Zug, mindestens 50 |
| Labyrinth | 100, + 50 bei kurzem Weg (höchstens 4 Schritte mehr als nötig), + 25 bis zum doppelten Weg |

Das Spiel endet, wenn alle 4 Zauberblumen gelöst sind. Dann wird das Ergebnis gespeichert.

## Kindgerecht

- Kein Zeitdruck, kein „Game over“: Berührt eine Qualle Flatter, ohne geschnappt zu werden, geht ein Herz
  verloren. Sind alle Herzen weg, ruht Flatter kurz aus und hat wieder 3 Herzen. Punkte gehen nie verloren.
- Falsches Memory-Paar: „Nicht gleich – merk dir die Tiere!“, die Karten drehen sich zurück.
- Labyrinth: gegen die Hecke fliegen wackelt nur kurz. Die Spur zeigt, wo Flatter schon war.

## Aufbau

`index.html` (Gerüst, Fenster: Start, Memory, Labyrinth, Geschafft, Ende), `game.js` (3D-Welt mit Three.js r128
aus `../shared/vendor/`, Spiellogik, Memory, Labyrinth). Keine Bilder- oder Ton-Dateien: Flügel, Symbole und
Glitzer werden als Canvas-Texturen gemalt, Klänge kommen aus dem Kit (Web Audio). Tiere im Memory sind Emojis.
Leiste, Pause, Ton, Vollbild, Drehen-Hinweis und Speicher kommen aus `../shared/kit/` (docs/GAME_STANDARD.md).

Ladegröße: Three.js (ca. 600 KB, gemeinsam mit den anderen 3D-Spielen) plus ca. 50 KB Spiel.
Leistung: Bäume, Blumen, Gras und Wolken sind zu wenigen Geometrien verschmolzen, Münzen sind ein `InstancedMesh`,
Schatten sind weiche Texturen statt Schattenberechnung. `createQuality` senkt bei Bedarf die Pixeldichte.

Test-Zugang: `window.SPIEL` (Zustand, Dinge der Welt, Versetzen, Memory-Karten, Labyrinth-Weg, Zeitraffer).
Durchspiel-Test: `node tools/spieltest.js schmetterling`
