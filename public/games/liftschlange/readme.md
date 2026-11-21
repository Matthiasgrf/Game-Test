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

Highscore: Punkte (mehr ist besser), gemeldet an die Bestenliste der App. Zusätzlich lokale Bestenliste
(Rekord pro Freund mit Länge und Datum, Letzter „Zahlt die erste Runde 🍻“) und „Score teilen“ (Text in die
Zwischenablage für die WhatsApp-Gruppe). Die lokale Bestenliste steckt im Objekt `Bestenliste`
(`laden`/`speichern`, Promises) – für ein eigenes Online-Leaderboard nur diese ersetzen.

Anpassen: alle Einstellungen stehen oben im Skript unter „EINSTELLUNGEN“ – Urlaubsdatum `URLAUB_START`,
Freunde und Farben, Spieltempo, Liftwart (Tempo, Sichtweite, Verdacht), Power-ups, Rang-Titel und alle
Sprüche (`SPRUECHE`).

Hinweise:
- Eigenes Gesichtsfoto als Kopf: wird im Browser auf 128×128 verkleinert und nur im `localStorage`
  gespeichert (`liftschlange_foto_v1_<Name>`), nie hochgeladen.
- `localStorage`: `liftschlange_bestenliste_v1`, `liftschlange_spieler_v1`, `liftschlange_ton_v1`,
  `liftschlange_tutorial_v1`, `liftschlange_foto_v1_<Name>`.
- Töne synthetisch per Web Audio API (Plopp, Rülpser, Trillerpfeife, Furz …), keine Dateien.
- Für Tests: `window.SPIEL` (`timeScale`, `state()`, `step()`, `advance()`, `place()`, `kid()`, `holdWarden()`).

Durchspiel-Test: `node tools/spieltest.js liftschlange`
