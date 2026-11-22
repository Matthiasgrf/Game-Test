# Ski-Flitzer

Ab 6 Jahren · Gruppe **Fisser-Flitzer**. Die Kackwurst ist auf Skiurlaub in **Serfaus-Fiss-Ladis** und saust
40 Sekunden lang die Piste hinunter. Unterwegs sammelt sie ein, was so herumliegt: Aperol Spritz, Bier,
Hot Dogs, Klopapier, Verbände, Skistöcke und österreichische Gerichte (Wiener Schnitzel, Kaiserschmarrn,
Germknödel, Apfelstrudel, Tiroler Gröstl, Sachertorte) – und den **Zirbenschnaps** 🥃 (25 Punkte):
Er löst den **Zirben-Turbo** aus, 3 Sekunden lang schneller, doppelte Punkte und Hindernisse bremsen nicht.

Steuerung: Computer: Pfeiltasten ← → (oder A/D) · Tablet/Handy: große Knöpfe ◀ ▶ unten oder links/rechts auf
den Bildschirm tippen. **🔄 Neustart** oben in der Anzeige (oder Taste R, oder im Pause-Fenster
„🔄 Neu starten“) bricht den Lauf ab und beginnt sofort neu – ein abgebrochener Lauf zählt nicht für die Bestenliste. Die Wurst fährt die Kurven der Piste von selbst mit, Lenken verschiebt sie nur nach
links oder rechts (so wie man es auf dem Bildschirm sieht).

Highscore: Punkte (mehr ist besser). Jedes Ding hat einen eigenen Wert (Klopapier 5 bis Sachertorte 30).
Schneemänner und Strohballen bringen die Wurst zu Fall und kosten Zeit, im Tiefschnee neben der Piste wird
sie langsamer. Die Spielzeit ist immer 40 Sekunden.

Hinweise:
- 3D-Grafik mit Three.js r128 (wie das Spiel „Bauer Franz“ in 3c-Sachunterricht), lokal als
  `three.min.js` abgelegt (MIT-Lizenz), alles andere aus einfachen Formen gebaut – keine Bilddateien.
- Hütten und Schilder: Möseralm, Schönjoch, Lazid, Komperdell, Hög, Gondelbahn neben der Piste.
- Persönlicher Rekord und Ton an/aus im `localStorage` (`ski-flitzer_rekord_v1`, `ski-flitzer_ton_v1`).
- Handy hochkant: Kamera etwas höher, die Wurst fährt im unteren Drittel, oben sieht man die Strecke.
- Für Tests: `window.SPIEL` mit `timeScale` (Zeitraffer), `autopilot`, `state()`, `view()` (Bildgröße,
  Position der Wurst auf dem Bildschirm), `restart()` und `place(id)` (Ding direkt vor die Wurst legen). Der Test prüft Computer, iPad (quer) und iPhone mit hoher Pixeldichte.

Durchspiel-Test: `node tools/spieltest.js ski-flitzer`
