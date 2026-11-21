# Flug über die Welt

Flugspiel nach dem Vorbild von Flug über Europa, aber für die ganze Welt: Mit dem Flugzeug zu allen
193 Mitgliedsstaaten der Vereinten Nationen fliegen, dem orangen Pfeil zum Ziel-Land folgen und bei der
gelben Kugel (Hauptstadt) landen. Nach der Landung gibt es die gleichen Fragen wie bei Flug über Europa:

1. Welche Flagge gehört zum Land?
2. Wie heißt die Hauptstadt?
3. Welche Sehenswürdigkeit gibt es dort?
4. Wie viele Menschen leben ungefähr im Land?

**Berühmte Bauwerke:** Unterwegs stehen 10 berühmte Bauwerke als 3D-Modell an ihrem echten Ort:
Pyramiden von Gizeh, Chinesische Mauer, Kolosseum, Hagia Sophia, Angkor Wat, Taj Mahal, Eiffelturm,
Sagrada Família, Empire State Building und Burj Khalifa. Neben jedem Bauwerk liegt ein goldener Ring mit
schwebendem Edelstein – dort kann man landen und bekommt den Ort, die Bauzeit und zwei kurze Infos.
Der erste Besuch gibt 5 Punkte, die Anzeige oben zeigt 🏛️ 3/10. Besuchte Bauwerke haben einen grünen Ring.

Wer alle Länder besucht hat, wird „Welt-Meister“. Der Spielstand wird im Browser gespeichert (`weltflug_v1`).

Steuerung: Pfeiltasten oder A/D zum Lenken, W schneller, S langsamer, Leertaste landen.
Auf Tablet/Handy: ◀ ▶ gedrückt halten, 🚀 schneller, Landen-Button antippen.

Unterschiede zu Flug über Europa:
- Die Welt hat keinen Rand nach Osten und Westen: Man kann rund um die Erde fliegen (z. B. über den Pazifik).
- Das nächste Ziel ist immer eines der sechs nächstgelegenen Länder, damit die Flüge kurz bleiben.
  „🎲 Anderes Ziel“ wählt ein beliebiges Land irgendwo auf der Welt.
- Liegen mehrere Hauptstädte dicht beieinander, hat beim Landen das Ziel-Land Vorrang.
- Unter dem Ziel stehen der Kontinent und die Entfernung in Kilometern (auf der Erdkugel gemessen).
- Kann eine Flagge nicht geladen werden, wird die Flaggen-Frage übersprungen.

Hinweise zu den Inhalten:
- Länder: die 193 UN-Mitgliedsstaaten. Nicht dabei sind deshalb z. B. Vatikanstadt und Palästina
  (Beobachter bei der UN), Kosovo und Taiwan. Solche Gebiete und abhängige Gebiete (z. B. Grönland)
  sind auf der Karte hellgrau und haben kein Ziel.
- Grenzen nach Sicht der UN: Die Krim gehört zur Ukraine, Nordzypern zu Zypern, Somaliland zu Somalia.
- Hauptstädte bei Ländern mit mehreren: Bolivien = Sucre, Südafrika = Pretoria, Sri Lanka =
  Sri Jayewardenepura Kotte, Burundi = Gitega, Tansania = Dodoma, Elfenbeinküste = Yamoussoukro,
  Niederlande = Amsterdam. Nauru hat offiziell keine Hauptstadt, hier steht der Regierungssitz Yaren.
- Einwohnerzahlen sind gerundete Schätzungen (Stand etwa 2024).
- Die Pins von Kinshasa und Brazzaville sind leicht auseinandergerückt, damit man sie unterscheiden kann.
- Bahamas, Kiribati und Tuvalu sind für die Karte zu klein – dort ist eine kleine Insel eingezeichnet.
- Flaggen, die fast gleich aussehen (Indonesien/Monaco, Tschad/Rumänien, Niederlande/Luxemburg),
  stehen nie zusammen zur Auswahl.

Technik und Quellen:
- Grenzen: [Natural Earth](https://www.naturalearthdata.com/) 1:50 Mio. (gemeinfrei), über das npm-Paket
  `world-atlas@2.0.2`, mit `mapshaper` vereinfacht und direkt in `index.html` eingebettet.
  Die Karte wird als Flächen (Dreiecke) gezeichnet und dreimal nebeneinander gelegt.
- Flaggen: `flag-icons@7.6.0` (MIT-Lizenz), lokal in `public/games/shared/vendor/flag-icons-7.6.0/` – nur die 193 benötigten.
- Three.js wird aus `public/games/shared/vendor/` geladen, das Spiel braucht keine fremden Server.

Zu den Bauwerken:
- Die Höhen sind nicht maßstabsgetreu, aber die Reihenfolge stimmt: Der Burj Khalifa ist am höchsten, dann
  Empire State Building, Eiffelturm, Sagrada Família. Flache Bauwerke sind etwas vergrößert, damit man sie gut sieht.
  Über hohen Bauwerken steigt das Flugzeug von selbst nach oben.
- Eiffelturm, Kolosseum und die Pyramiden stehen fast genau auf der Stecknadel ihrer Hauptstadt. Damit man
  beides unterscheiden kann, sind sie in ihre echte Richtung etwas zur Seite gerückt (Gizeh liegt westlich von Kairo).
- Die Chinesische Mauer folgt grob dem Verlauf der Mauer aus der Ming-Zeit von Shanhaiguan am Meer bis Jiayuguan.
  Gelandet wird an einem Wachturm nördlich von Peking.
- Kleine Details: Beim Kolosseum fehlt wie in echt ein Teil der Außenmauer, an der Sagrada Família steht ein Baukran
  (sie ist noch nicht fertig), Angkor Wat hat Wassergraben und Urwald, der Taj Mahal Garten und Wasserbecken.
- Durchspiel-Test: `node tools/spieltest.js weltflug` (das Spiel bietet dafür mit `?test` den Zugang `window.WELTFLUG`).

## In Game-Test

Übernommen aus dem Repository 3c-Lernspiele (Ordner `games/weltflug/`). Läuft in der App im iframe (`src/games/HtmlGame.tsx`).
Angepasst: Zoom-Schutz und `game-test.js` aus `../shared/`, Three.js und die Flaggen (flag-icons) aus `../shared/vendor/`, die Links „🏠 Alle Spiele“ führen zur App-Übersicht (`../../#/`, `target="_top"`).
Zusätzlich meldet das Spiel nach jedem neu besuchten Ziel (und jedem neuen Bauwerk) den Punktestand mit `GameTest.reportScore` an die Bestenliste.
Highscore: Punkte (mehr ist besser) – es zählt der beste gemeldete Punktestand. Für den Durchspiel-Test bietet das Spiel mit `?test` den Zugang `window.FLUGTEST` (`tools/flugtest.js`).
Hinweis: Der Spielstand liegt im Browser (`localStorage`), nicht beim Login. Spielen zwei Kinder auf demselben Gerät, teilen sie sich den Spielstand.

Durchspiel-Test: `node tools/spieltest.js weltflug`
