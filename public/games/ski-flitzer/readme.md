# Ski-Flitzer

Ab 6 Jahren · Gruppe **Fisser-Flitzer**. Die Kackwurst ist auf Skiurlaub in **Serfaus-Fiss-Ladis** und saust
40 Sekunden lang die Piste hinunter. Unterwegs sammelt sie ein, was so herumliegt: Aperol Spritz, Bier,
Hot Dogs, Klopapier, Verbände, Skistöcke und österreichische Gerichte (Wiener Schnitzel, Kaiserschmarrn,
Germknödel, Apfelstrudel, Tiroler Gröstl, Sachertorte).

Steuerung: Computer: Pfeiltasten ← → (oder A/D) · Tablet/Handy: große Knöpfe ◀ ▶ unten oder links/rechts auf
den Bildschirm tippen. Die Wurst fährt die Kurven der Piste von selbst mit, Lenken verschiebt sie nur nach
links oder rechts (so wie man es auf dem Bildschirm sieht).

Highscore: Punkte (mehr ist besser). Jedes Ding hat einen eigenen Wert (Klopapier 5 bis Sachertorte 30).
Schneemänner und Strohballen bringen die Wurst zu Fall und kosten Zeit, im Tiefschnee neben der Piste wird
sie langsamer. Die Spielzeit ist immer 40 Sekunden.

Hinweise:
- 3D-Grafik mit Three.js r128 (wie das Spiel „Bauer Franz“ in 3c-Sachunterricht), lokal als
  `three.min.js` abgelegt (MIT-Lizenz), alles andere aus einfachen Formen gebaut – keine Bilddateien.
- Hütten und Schilder: Möseralm, Schönjoch, Lazid, Komperdell, Hög, Gondelbahn neben der Piste.
- Persönlicher Rekord und Ton an/aus im `localStorage` (`ski-flitzer_rekord_v1`, `ski-flitzer_ton_v1`).
- Für Tests: `window.SPIEL` mit `timeScale` (Zeitraffer), `autopilot`, `state()` und `view()` (Bildgröße,
  Position der Wurst auf dem Bildschirm). Der Test prüft Computer, iPad (quer) und iPhone mit hoher Pixeldichte.

Durchspiel-Test: `node tools/spieltest.js ski-flitzer`
