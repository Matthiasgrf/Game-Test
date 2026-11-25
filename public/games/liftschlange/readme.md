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

**Lift-Einstieg** 🚡: Oben in der Lift-Station geht ab und zu (erstes Mal nach 12–20 s, danach alle 18–32 s) und
bei jedem neuen Level ein Drehkreuz auf – grün leuchtend mit Pfeil und Restzeit-Schild, dazu 🚡-Anzeige im HUD.
Es bleibt 12 s offen (`LIFT_OFFEN`). Wer von unten hineinfährt, bekommt 30 Punkte + 5 je Skifahrer in der Schlange
(×2 mit Jagertee), der Verdacht wird gelöscht, und die Schlange kommt im untersten Gang auf der anderen Seite
wieder heraus (freie Bahn, kein Liftwart direkt daneben). Die Glieder folgen nach und nach durch das Tor.
Einstellungen: `LIFT_OFFEN`, `LIFT_PAUSE`, `LIFT_ERSTES`, `LIFT_PUNKTE`, `LIFT_PRO_MITFAHRER`.

Startbildschirm: Kasten „So gibt’s Punkte“ mit allen Punktequellen (aus den Einstellungen erzeugt) und
den Game-Over-Gefahren.

Steuerung: Pfeiltasten oder WASD, P/Leertaste/Esc = Pause, M = Ton · Tablet/Handy: großes Steuerrad (dunkle Scheibe,
hoch unten in der Mitte, quer rechts) oder Wischen auf dem Feld. Am Steuerrad muss man keinen Knopf genau treffen: die
Richtung ergibt sich aus der Lage des Fingers zur Mitte, Daumen draufhalten und gleiten lenkt weiter. Das gelbe Feld
zeigt die aktuelle Richtung, ein oranger Pfeil vor dem Kopf ebenso. Die Schlange wird zum nächsten Feld hin gezeichnet
(nicht hinterher), deshalb dreht sich der Kopf im selben Bild, in dem die Taste gedrückt wird. Jagertee verzögert nur
noch 30 % der Eingaben um 0,14 s.

Bildschirm: Die Schneelandschaft füllt den ganzen Bildschirm, hoch und quer. Das umzäunte Feld (Raster und
Anzahl der Gänge) wird zu Beginn jeder Runde an den Bildschirm angepasst – ein Feld ist etwa 28–46 px groß
(`FELD_PX_MIN`, `FELD_PX_MAX`, `GANG_HOEHE`). Kopfzeile und Steuerrad liegen über der Landschaft, nicht über
dem Feld (hoch: Steuerrad unten, quer: rechts).

Highscore: Punkte (mehr ist besser, bei Gleichstand die kürzere Zeit). Jedes Ergebnis geht per
`GameTest.reportScore` auf die gemeinsame Seite „Highscores“ der App – das Spiel hat keine eigene Bestenliste.
Im Spiel gibt es keinen Link dorthin. „Score teilen“ kopiert einen Text in die Zwischenablage
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
- Für Tests: `window.SPIEL` (`timeScale`, `state()`, `step()`, `advance()`, `place()`, `kid()`, `holdWarden()`, `liftAuf()`, `vorLift()`).

Durchspiel-Test: `node tools/spieltest.js liftschlange`
