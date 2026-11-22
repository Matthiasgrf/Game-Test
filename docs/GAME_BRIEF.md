# Spiel-Briefing

Vorlage für ein neues Spiel: Datei kopieren (z. B. als Text in den Chat oder als Issue), Felder ausfüllen,
dann baut Claude das Spiel nach [`docs/GAME_STANDARD.md`](GAME_STANDARD.md). Felder, die leer bleiben, entscheidet
Claude nach dem Standard und nennt die Entscheidung im Pull Request.

```
Titel:            z. B. „Einmaleins-Rakete“
key:              z. B. einmaleins-rakete   (kurz, a-z 0-9 -, steht in Adresse und Datenbank)

Idee:             Worum geht es, in 2–3 Sätzen? Was macht das Spiel besonders?
Zielgruppe:       kinder | erwachsene         (Bereich „Kinder · Lernen“ oder „Erwachsene · Spaß“)
Alter / Klasse:   z. B. „3. Klasse“, „ab 6 Jahren“, „ab 18 Jahren“
Fach / Kategorie: Mathe | Deutsch | Sachkunde | Erdkunde | Religion | Freizeit | …
Freigabe:         Gruppen, die das Spiel sehen sollen, z. B. Klasse-3c

Ausrichtung:      beide | quer | hoch         (beste Ausrichtung fürs Gameplay; sonst „Bitte Gerät drehen“)
Steuerung:        Computer: …   Tablet/Handy: …   (z. B. Pfeiltasten / Steuerkreuz links, Aktion rechts, Tippen aufs Ziel)
Spielziel:        Wann ist das Spiel gewonnen? Wie lange dauert eine Runde (Richtwert 3–10 Minuten)?
Punkte / Level:   Was zählt für die Bestenliste? Mehr ist besser (Punkte, Sterne) oder weniger (Fehlversuche, Zeit)?
                  Stufen oder Varianten mit eigener Bestenliste? Oder ohne Bestenliste?
Aufgabentypen:    z. B. Auswahl (3 Antworten), Zahl eintippen, Zuordnen/Ziehen, Lücke füllen, Bild antippen –
                  mit Beispielen und Quelle der Inhalte (Schulbuch, Lehrplan, Arbeitsblatt)
Ton / Stil:       Figur, Welt, Stimmung (z. B. „Rakete im Weltall, freundlich, bunt“); 2D oder 3D;
                  Klänge (Treffer, Fehler, Gewinn), Musik ja/nein
Spielstand:       Muss etwas über Runden hinweg bleiben (gesammelte Dinge, Stufen)? → saveKey
Besonderheiten:   z. B. Vorlesen, Zeitlimit (nur Erwachsene), eigene Bilder (bitte mitschicken), Datenschutz
```

## Was Claude daraus macht

1. `node tools/neues-spiel.js <key> "<Titel>" --zielgruppe … --ausrichtung … --kategorie … --gruppe …`
2. Spiel in `public/games/<key>/game.js` und `index.html` bauen (Vorlage ersetzen), Durchspiel-Test anpassen
3. Vorschaubild, readme.md, Migration; `npm run test:schnell`, Screenshots der laufenden Szene ansehen
4. Definition of Done (`docs/GAME_STANDARD.md`, Abschnitt 10) abhaken, Pull Request mit Briefing und Entscheidungen

## Beispiel

```
Titel:            Einmaleins-Rakete
key:              einmaleins-rakete
Idee:             Eine Rakete fliegt durchs Weltall und sammelt Planeten. Auf jedem Planeten wartet eine
                  Einmaleins-Aufgabe; richtig gelöst → Treibstoff für den nächsten Planeten.
Zielgruppe:       kinder
Alter / Klasse:   3. Klasse
Fach / Kategorie: Mathe
Freigabe:         Klasse-3c
Ausrichtung:      beide
Steuerung:        Computer: Pfeiltasten · Tablet/Handy: Steuerkreuz links oder Planet antippen
Spielziel:        8 Planeten besuchen, eine Runde ca. 5 Minuten
Punkte / Level:   Fehlversuche (weniger ist besser), bei Gleichstand die Zeit; Varianten: 2er–5er, 6er–9er, gemischt
Aufgabentypen:    Ergebnis aus 3 Antworten wählen; ab Stufe 2 Zahl eintippen
Ton / Stil:       3D-Weltall, freundliche Rakete mit Gesicht, sanfte Klänge, keine Musik
Spielstand:       freigeschaltete Varianten bleiben → saveKey einmaleins_rakete_v1
Besonderheiten:   –
```
