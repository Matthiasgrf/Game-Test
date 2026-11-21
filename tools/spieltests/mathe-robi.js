/* Durchspiel-Test für „Robi in der Zahlenfabrik“. Aufruf: node tools/spieltest.js mathe-robi
   Das Spiel wird mit ?test geladen und bietet dann window.ROBI (Spielzustand, Eingaben, Zeitraffer).
   Ein kleiner Bot (wie im Test von 3c-Lernspiele) läuft durch das Level, antwortet an Station 1 einmal
   falsch und sonst richtig. Geprüft wird: Gewinn-Bildschirm mit 1 Fehlversuch und Zeit, gespeichertes
   Ergebnis, Link zurück zur Übersicht, gespeicherter Spielstand (Zahnräder) und dass ein Spielstand
   vom Server beim nächsten Start in der Werkstatt ankommt. */
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

  /* Spielstand: Die App speichert ihn gesammelt nach etwa 1 Sekunde in game_states. */
  const bank = await game.evaluate(() => JSON.parse(localStorage.getItem('mathe_robi_v1')).bank);
  for (let i = 0; i < 30 && !page.states.some((r) => r.data && r.data.bank === bank); i++) await page.waitForTimeout(100);
  const last = page.states[page.states.length - 1];
  t.check('Spielstand mit Zahnrädern gespeichert', bank > 0 && last && last.game_key === 'mathe-robi' && last.data.bank === bank, JSON.stringify(last && { game_key: last.game_key, bank: last.data.bank, lokal: bank }));

  /* Anderes Gerät: Stand kommt vom Server (500 Zahnräder, Stern-Antenne gekauft und getragen). */
  const page2 = await t.newPage(t.DESK, { states: { 'mathe-robi': { bank: 500, own: ['stern'], wear: { antenne: 'stern' } } } });
  await page2.goto(t.url, { waitUntil: 'load' });
  const game2 = await t.frame(page2);
  await game2.waitForSelector('#shopBank');
  t.check('Spielstand vom Server: Werkstatt zeigt 500 Zahnräder', /500/.test(await game2.textContent('#shopBank')), await game2.textContent('#shopBank'));

  /* Gleiches Gerät, anderes Kind: Ein lokaler Stand, der einem anderen Kind gehört, wird nicht übernommen,
     ein alter Stand ohne Besitzer schon (einmalig, beim ersten Spielen nach dem Umstieg). */
  const local = async (owner) => {
    const p = await t.newPage(t.DESK);
    await p.context().addInitScript((o) => {
      if (sessionStorage.getItem('vorbereitet')) return;
      sessionStorage.setItem('vorbereitet', '1');
      localStorage.setItem('mathe_robi_v1', JSON.stringify({ bank: 999 }));
      if (o) localStorage.setItem('game-test-owner:mathe-robi', o);
    }, owner);
    await p.goto(t.url, { waitUntil: 'load' });
    const g = await t.frame(p);
    await g.waitForSelector('#shopBank');
    return g.textContent('#shopBank');
  };
  const fremd = await local('anderes-kind');
  t.check('Stand eines anderen Kinds wird nicht übernommen', /⚙️ 0\b/.test(fremd), fremd);
  const alt = await local(null);
  t.check('Alter Stand ohne Besitzer wird übernommen', /999/.test(alt), alt);
}
