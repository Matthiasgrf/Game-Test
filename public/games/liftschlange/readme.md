# Liftschlange

Ab 18 Jahren · Après-Ski-Humor für die vier Skifahrer **Matze, Dani, Alex und Gabor** – bewusst für keine
Kinder-Gruppe freigegeben (Freigabe im Tab Admin). Snake in der Warteschlange vor dem Sessellift, von oben
gesehen: Absperrgitter bilden Gänge wie beim Anstehen, oben ist der Lift-Einstieg.

Der Spieler drängelt sich als Skifahrer durch die Schlange und sammelt andere Skifahrer und seine Kumpels ein.
Jeder hängt sich hinten an. Gegen Absperrgitter oder in die eigene Schlange laufen = Game Over.

**Liftwart** (Schnauzer, Warnweste, Funkgerät): patrouilliert in Schlangenlinie durch alle Gänge. Sein roter
Sichtkegel wird von Gittern verdeckt. Ist der Kopf der Schlange darin, füllt sich der Verdachts-Balken (näher =
schneller). Voll → „ERWISCHT! Ab ans Ende der Schlange!“. Ab Level 3 dreht er sich zufällig um, ab Level 4
kommt ein zweiter Liftwart. Pro 5 eingesammelte Leute ein Level (schneller, Liftwart schneller).

Items: 🍺 Jagertee (8 s doppelte Punkte, Bild wackelt, manche Eingaben kommen verspätet an) · 🥃 Williams
(3 s Turbo) · 🥞 Kaiserschmarrn (+50) · 💨 Gondel-Furz (selten, Liftwart 4 s betäubt) · 🏂 Snowboard-Kid
ab Level 2 (fährt quer durch einen Gang, Berührung kostet 3 Glieder). Kumpels (einer der anderen drei,
mit Namen) bringen 25 statt 10 Punkte.

Steuerung: Pfeiltasten oder WASD, P/Leertaste/Esc = Pause, M = Ton · Tablet/Handy: Steuerkreuz oder Wischen.

Bildschirm: Die Schneelandschaft füllt den ganzen Bildschirm, hoch und quer. Das umzäunte Feld (Raster und
Anzahl der Gänge) wird zu Beginn jeder Runde an den Bildschirm angepasst – ein Feld ist etwa 28–46 px groß
(`FELD_PX_MIN`, `FELD_PX_MAX`, `GANG_HOEHE`). Kopfzeile und Steuerkreuz liegen über der Landschaft, nicht über
dem Feld (hoch: Steuerkreuz unten, quer: rechts).

Highscore: Punkte (mehr ist besser, bei Gleichstand die kürzere Zeit). Jedes Ergebnis geht per
`GameTest.reportScore` auf die gemeinsame Seite „Highscores“ der App – das Spiel hat keine eigene Bestenliste.
Start- und Game-Over-Bildschirm verlinken dorthin. „Score teilen“ kopiert einen Text in die Zwischenablage
(für die WhatsApp-Gruppe).

Anpassen: alle Einstellungen stehen oben im Skript unter „EINSTELLUNGEN“ – Urlaubsdatum `URLAUB_START`,
Freunde und Farben, Spieltempo, Liftwart (Tempo, Sichtweite, Verdacht), Power-ups, Rang-Titel und alle
Sprüche (`SPRUECHE`).

Hinweise:
- Eigenes Gesichtsfoto als Kopf: wird im Browser auf 128×128 verkleinert und nur im `localStorage`
  gespeichert (`liftschlange_foto_v1_<Name>`), nie hochgeladen.
- `localStorage`: `liftschlange_spieler_v1`, `liftschlange_ton_v1`,
  `liftschlange_tutorial_v1`, `liftschlange_foto_v1_<Name>`.
- Töne synthetisch per Web Audio API (Plopp, Rülpser, Trillerpfeife, Furz …), keine Dateien.
- Für Tests: `window.SPIEL` (`timeScale`, `state()`, `step()`, `advance()`, `place()`, `kid()`, `holdWarden()`).

Durchspiel-Test: `node tools/spieltest.js liftschlange`
