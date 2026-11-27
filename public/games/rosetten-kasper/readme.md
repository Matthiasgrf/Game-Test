# Der Rosetten-Kasper

ab 12 Jahren · für die Fisser-Flitzer. Ein Abfahrts-Runner mit Notfall: Kasper hatte auf der Hütte am Schönjoch
drei Kaspressknödel, eine Gulaschsuppe und zwei Jagertee. Jetzt grummelt's gewaltig, und das einzige freie Klo ist
unten an der Talstation in Fiss. Man muss ihn rechtzeitig runterbringen (2000 m, etwa 1½–2 Minuten).

## Ablauf

Kasper fährt von selbst bergab. Das **Klemm-O-Meter** (links) steigt ständig, bei hohem Tempo schneller.
Ist es bei 100 %, gibt es ein Malheur: brauner Fleck im Schnee, „Kasper hat's nicht gepackt“, das Spiel ist vorbei.
Auch dann gibt es Punkte für die Bestenliste, aber ohne Ankunft, Zeit- und 99-%-Bonus (siehe Punkte).

- **Zusammenkneifen** (gedrückt halten): Druck sinkt um etwa 12 % pro Sekunde, Kasper bremst stark auf 6 m/s
  (normal 21 m/s). Das ist der Kern: Tempo gegen Kontrolle.
- **Rückstoß-Boost**: −14 % Druck, gut eine Sekunde Schub auf 34 m/s, danach 2 s Pause. Risiko 8 %
  (über 80 % Druck: 25 %), dass es „nicht nur Luft“ war: −250 Punkte und ein kleiner Fleck auf der Piste.
- **Buckelpiste** (zwei Abschnitte, mit Schild): Druck steigt deutlich schneller, das Bild wackelt.
- **Schanzen** (2): Sprung +50 Punkte, über Hindernisse hinweg; die Landung gibt +14 % Druck.

**Sammeldinge** – je wertvoller, desto seltener und heikler liegen sie (zusammen 6375 Punkte):

| Sammelding | Anzahl | Punkte | Druck | Wo |
|---|---|---|---|---|
| 🥨 Brezel | 23 | 50 | +2 % | in Reihen auf der Piste |
| 🌼 Edelweiß | 5 | 75 | ± 0 | ganz am Pistenrand |
| 🥟 Kaspressknödel | 26 | 100 | +5 % | überall, manche an heiklen Stellen |
| 🥞 Kaiserschmarrn | 5 | 150 | +8 % | knapp vor oder hinter Hindernissen (Dani, Matze, Alex), in der Buckelpiste |
| 🍚 Germknödel | 3 | 200 | +10 % | im Sprung hinter den Schanzen, neben der Pistenraupe |
| 🧻 Goldene Klopapierrolle | 3 | 300 | −10 % | im Nebel der Schneekanone, neben dem Dixi-Klo, kurz vor dem Ziel |

Oben links steht, wie viele Punkte man schon gesammelt hat (⭐).

| Hindernis / Pick-up | Wirkung |
|---|---|
| 🥃 Zirbenschnaps (3) | −20 % Druck, 4 s wackelige Steuerung |
| 🚽 Dixi-Klo am Pistenrand (2) | Besetzt, drinnen sitzt Gabor: kurzer Halt, +8 % Druck |
| Dani liegt quer im Schnee | Sturz |
| Alex macht mitten auf der Piste ein Selfie | Sturz |
| Matze an der Engstelle: „Gemma no oane?“ | Sturz |
| Pistenraupe (kommt entgegen) | Sturz |
| Skischulgruppen in Schlangenformation (2) | Sturz |
| Schneekanone am Rand (2) | Kälteschock im Nebel: Druck steigt schnell |

Ein Sturz kostet 1,4 s und +10 % Druck. Neben der Piste (Tiefschnee) ist Kasper langsam.
Die Strecke ist für alle gleich (fester Zufalls-Startwert), damit die Bestenliste fair ist.

## Punkte

| | Punkte |
|---|---|
| Angekommen | 500 |
| Zeit | (140 s − Fahrzeit) × 30 |
| Sammeldinge | 50 bis 300 je Stück (Tabelle oben), eine Zeile je Sorte |
| Sprünge | je 50 |
| Mit 99 % ins Ziel / 95 % / 90 % | 1500 / 600 / 300 |
| „nicht nur Luft“ | je −250 |
| Malheur statt Ankunft | gefahrene Meter ÷ 5 (höchstens 400) + Sammeldinge + Sprünge − Pannen, kein Ankunfts-, Zeit- oder 99-%-Bonus |

Mit gleich vielen Sammeldingen, Sprüngen und Pannen liegt eine Ankunft immer vor einem Malheur (mindestens 500 statt
höchstens 400).

Titel: ab 7000 „Anwärter auf die Goldene Rosette“, ab 5000 „Silberne Rosette“, ab 3000 „Bronzene Rosette“,
sonst „Notfall-Lehrling“. Die **Goldene Rosette** trägt, wer in der Bestenliste der Fisser-Flitzer vorn liegt.

## Steuerung

- Computer: ← → (A D) lenken, Leertaste halten = zusammenkneifen, ↑ (W) = Boost. P = Pause, M = Ton.
- Tablet/Handy: unten links ◀ ▶, unten rechts 💨 Boost und 🍑 Kneifen (halten).

Ausrichtung: hoch und quer (`any`). Hochkant sitzt die Kamera höher und weiter hinten, damit man genug von der
Piste sieht.

## Highscore

Gesamtpunkte (mehr ist besser), bei Gleichstand zählt die kürzere Zeit. Jede Fahrt kommt in die Bestenliste,
auch eine mit Malheur (dann mit weniger Punkten).

## Aufbau

`index.html` (Gerüst, Klemm-O-Meter, Fenster) und `game.js` (Spiellogik und Zeichnen mit Canvas 2D, keine
Bilddateien). Die Piste ist Pseudo-3D: Abschnitte von 2,5 m werden perspektivisch projiziert, Kuppen verdecken,
was dahinter liegt; Bäume, Freunde und Pick-ups sind gezeichnete Sprites mit Licht, Schatten und Nebel in der Ferne.
Rechts zeigt ein Balken, wie weit es noch zur Talstation ist. Töne mit Web Audio aus dem Kit (Grummeln, Pffft,
Knödel, Sturz). Leiste, Pause, Ton, Vollbild, Drehen-Hinweis und Speicher kommen aus `../shared/kit/`
(docs/GAME_STANDARD.md).

Durchspiel-Test: `node tools/spieltest.js rosetten-kasper`
