# Die Wortmonster

Deutsch, 3. Klasse. Übung für den Sprachkundetest. Drei Monster haben Hunger, aber jedes frisst nur eine
Wortart: **Nomi** (Nomen), **Flitz** (Verben) und **Ada** (Adjektive). Richtige Wörter fliegen ins Maul,
das Monster kaut, rülpst nach drei richtigen Antworten hintereinander und wird mit jedem Happen größer.
Falsche Wörter spuckt es aus – dann kommt ein Tipp und ein neuer Versuch.

Inhalte von vier Arbeitsblättern (wörtlich übernommen) plus weitere Wörter aus dem Grundwortschatz:
- **Nomi – Nomen & Artikel**: bestimmter und unbestimmter Artikel (der/die/das, ein/eine), Nomen in die
  Einzahl setzen (die Fußspuren → die Fußspur – eine Fußspur), Nomen in den Sätzen der Geschichte
  „Das Abenteuer“ antippen, Merksatz zu den Artikeln.
- **Flitz – Verben**: Lückentext (Grundform, Personalform, sechs Personalformen, „wer“), die sechs
  Personalformen der Reihe nach, die Tabelle vom Blatt (spielen → wir spielen, ich backe → backen …),
  weitere Verben, Verben im Satz antippen.
- **Ada – Adjektive**: Lückentext mit den Lösungswörtern vom Blatt, Vergleichsstufen auf dem Siegerpodest
  (alle 13 Wörter vom Blatt, z. B. groß – größer – am größten), Vergleiche im Satz, Adjektive antippen.
- **Monster-Buffet**: Wörterschlange vom Blatt „Wir üben für den Sprachkundetest“ zerschneiden und die
  Wörter verfüttern, Wörter sortieren, Wortgruppen mit sommerlich, kühl, langweilig, blau, hell.
- **Probetest**: 15 gemischte Aufgaben wie im Test (4 Nomen, 4 Verben, 4 Adjektive, 3 gemischt), je ein
  Versuch, keine Tipps. Jeder Probetest ist anders: Aufgabenarten, Reihenfolge und Wörter werden jedes Mal neu
  gezogen (Vorrat `TEST_POOL`, je Bereich eine Kernaufgabe wie Artikel, Personalform oder Siegerpodest plus
  zufällige weitere). Danach Punkte und Auswertung pro Bereich mit Knopf „Üben ▶“ für die Bereiche mit Fehlern.
- **Neue Aufgabenarten** (auch in den Übungsrunden): Mehrzahl bilden (das Bild → die Bilder), passendes Fürwort
  zur Personalform (… hörst → du), Vergleichsstufe erkennen (am längsten → 2. Vergleichsstufe), „Welches Wort
  passt nicht?“ (drei Wörter einer Wortart, eins von einer anderen). Mehr Wortgruppen und Vergleiche.

**Belohnung „Snack-Regen“**: Nach jeder fertigen Runde (10 Happen oder Probetest) gibt es einmal ein kurzes
Fang-Spiel. Snacks fallen vom Himmel (1 Punkt), goldene Sterne bringen 5 Punkte, Stinkesocken kosten 3.
Die Spielzeit hängt von den Sternen der Runde ab (15 / 17 / 20 Sekunden) und wird vorher nicht angezeigt.
Nach dem Monster-Buffet und dem Probetest sucht sich das Kind sein Monster aus. Danach gibt es den
Snack-Regen erst wieder nach der nächsten fertigen Runde. Steuerung: Finger oder Maus, Antippen, Pfeiltasten.

Jeder Bereich hat 10 Happen, die Aufgaben werden jedes Mal neu gemischt. Sterne: 3 ab 9 von 10 beim
ersten Versuch, 2 ab 6. Im Probetest 3 Sterne ab 13 von 15, 2 ab 9.

Fachliche Hinweise: „Alex“ wird als Nomen (Name) erkannt, kommt aber in Artikel-Aufgaben nicht vor.
„glatt“ wird mit glatter – am glattesten abgefragt. Bei backen werden „du“ und „er“ nicht abgefragt,
weil zwei Formen erlaubt sind (backst/bäckst).

Steuerung: Antwortkarten anklicken oder antippen (Computer auch Tasten 1–9). Wörter zum Monster ziehen
oder erst das Wort und dann das Monster antippen. Wörterschlange: auf den ersten Buchstaben jedes neuen
Wortes tippen. Läuft im Hoch- und Querformat.

Hinweise:
- Spielstand im Browser unter `deutsch_wortmonster_v1`: beste Sterne pro Bereich (`best`), beste Punktzahl
  im Probetest (`test`), Rekord im Snack-Regen (`snack`), Ton aus (`mute`).
- Monster, Grafik und Töne entstehen im Code, es werden keine Bilder oder fremden Dateien geladen.
- Neue Wörter kommen in die Tabellen `NOMEN`, `VERBEN`, `ADJ`, `SAETZE`, `WORTGRUPPEN`, neue Aufgabenarten
  in `GEN` und in die Runden in `ROUNDS` bzw. in den Vorrat für den Probetest `TEST_POOL`.
- Durchspiel-Test: `node tools/spieltest.js deutsch-wortmonster` (Datei `tools/spieltests/deutsch-wortmonster.js`).
  Mit `?test` in der Adresse ist der Spielzustand als `window.WORTMONSTER` erreichbar.

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/deutsch-wortmonster/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich meldet das Spiel am Ende jeder Runde mit `GameTest.reportScore`, wie viele Aufgaben gleich beim ersten Versuch richtig waren,
dazu die Zeit. Jeder Bereich hat eine eigene Bestenliste (Varianten `nomen`, `verben`, `adjektive`, `mix`, `test`).
Highscore: mehr ist besser, bei Gleichstand die kürzere Zeit. Die Zeit steht auf dem Gewinn-Bildschirm.

Durchspiel-Test: `node tools/spieltest.js deutsch-wortmonster`
