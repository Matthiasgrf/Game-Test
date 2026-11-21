/* Durchspiel-Test für „Robi in der Zahlenfabrik“. Aufruf: node tools/spieltest.js mathe-robi
   Das Spiel wird mit ?test geladen und bietet dann window.ROBI (Spielzustand, Eingaben, Zeitraffer).
   Ein kleiner Bot (wie im Test von 3c-Lernspiele) läuft durch das Level, antwortet an Station 1 einmal
   falsch und sonst richtig. Geprüft wird: Gewinn-Bildschirm mit 1 Fehlversuch und Zeit, gespeichertes
   Ergebnis, Link zurück zur Übersicht. */
export default async function (t) {
  const page = await t.newPage(t.DESK);
  await page.goto(t.url, { waitUntil: 'load' });
  const game = await t.frame(page);
  await game.goto(`${game.url().split('?')[0]}?test`, { waitUntil: 'load' });
  await game.waitForFunction(() => window.ROBI);
  const visibleHome = () => game.evaluate(() => [...document.querySelectorAll('a[href="../../#/"][target="_top"]')].some((a) => a.offsetParent !== null));
  t.check('Start mit „🏠 Alle Spiele“', await visibleHome());
  await game.click('[data-topic="mal"]');
  t.check('„🏠 Alle Spiele“ während des Spiels', await visibleHome());
    await game.evaluate(() => {
      const R = window.ROBI, bot = window.BOT = { deaths: 0, wrongDone: false, lastFade: 0 };
      R.speed = 8;
      R.step = function () {
        const G = R.game(), p = G.p, L = G.L, inp = R.input;
        if (G.mode !== 'play') { inp.left = inp.right = false; return; }
        if (G.fade > 0.9 && bot.lastFade < 0.5) bot.deaths++;
        bot.lastFade = G.fade;
        const cx = p.x + p.w / 2, cur = G.cur;
        inp.left = inp.right = false;
        if (cur && !cur.solved && !cur.dead) {               /* Aufgabe: unter den richtigen Block laufen und springen */
          if (cur.locked || !cur.q) return;
          let b = cur.blocks.find(b => b.value === cur.q.ans && b.state === 'open');
          if (cur.idx === 0 && !bot.wrongDone) b = cur.blocks.find(b => b.value !== cur.q.ans && b.state === 'open') || b;
          if (!b) return;
          const bx = b.x + b.w / 2;
          if (Math.abs(cx - bx) > 6) inp[cx < bx ? 'right' : 'left'] = true;
          else if (p.onGround && Math.abs(p.vx) < 5) { inp.jumpPressed = true; if (b.value !== cur.q.ans) bot.wrongDone = true; }
          return;
        }
        if (!p.onGround) { inp.right = true; return; }
        const fx = p.x + p.w + 12, feet = p.y + p.h;
        const floor = L.solids.some(s => !s.off && s.kind !== 'gate' && s.kind !== 'wall' && fx >= s.x && fx <= s.x + s.w && s.y >= feet - 22 && s.y <= feet + 45);
        const foe = L.enemies.some(e => e.alive && e.x - (p.x + p.w) > 0 && e.x - (p.x + p.w) < 60 && Math.abs(e.y + e.h - feet) < 30);
        const onMover = p.floor && p.floor.move;
        const moverAhead = L.movers.some(m => {
          const lo = m.move.x0 + Math.min(0, m.move.dx), hi = m.move.x0 + Math.max(0, m.move.dx) + m.w;
          return fx >= lo - 5 && fx <= hi + 5;
        });
        if (floor) { inp.right = true; if (foe) inp.jumpPressed = true; }
        else if (!onMover && !moverAhead) { inp.right = true; inp.jumpPressed = true; }
        /* sonst: warten, bis die Plattform da ist */
      };
    });
  const start = Date.now();
  let s, lastX = -1, lastMove = Date.now(), why = '';
  for (;;) {
    s = await game.evaluate(() => { const G = ROBI.game(); return { mode: G.mode, x: Math.round(G.p.x / 40), solved: G.solved }; });
    if (s.mode === 'win') break;
    if (s.x !== lastX) { lastX = s.x; lastMove = Date.now(); }
    if (Date.now() - lastMove > 12000) { why = `steckt fest bei Feld ${s.x} nach Station ${s.solved}`; break; }
    if (Date.now() - start > 180000) { why = `zu langsam, Feld ${s.x}`; break; }
    await game.waitForTimeout(200);
  }
  t.check('Level bis zum Gewinn-Bildschirm durchgespielt', s.mode === 'win', why);
  if (s.mode !== 'win') { await t.shot(page, 'haengt'); return; }
  await game.waitForSelector('#winResult', { state: 'visible' });
  t.check('Gewinn-Bildschirm zeigt 1 Fehlversuch und Zeit', /Fehlversuche: 1 · Zeit: \d+/.test(await game.textContent('#winResult')));
  t.check('Gewinn mit „Nochmal spielen“ und „🏠 Alle Spiele“', (await game.isVisible('#againBtn')) && (await visibleHome()));
  await page.waitForSelector('.html-game-toast');
  t.check('Ergebnis gespeichert', page.scores.length === 1 && page.scores[0].game_key === 'mathe-robi' && page.scores[0].points === 1 && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
  await t.shot(page, 'ende-computer');
}
