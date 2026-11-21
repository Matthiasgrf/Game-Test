# Zahlenraten

React-Spiel ab ca. 8 Jahren. Code: `src/games/zahlenraten/`.

Das Spiel denkt sich eine Zahl zwischen 1 und 100. Nach jedem Tipp kommt „zu klein“ oder „zu groß“,
bis die Zahl gefunden ist. Danach „Nochmal spielen“.

Steuerung: Zahl eintippen und „Raten“ (oder Enter).

Highscore: Punkte = Anzahl der Versuche, weniger ist besser. Mit geschicktem Halbieren reichen 7 Versuche.

Durchspiel-Test: `node tools/spieltest.js zahlenraten`
