/* Durchspiel-Test für „Die Wortmonster“. Aufruf: node tools/spieltest.js deutsch-wortmonster
   Das Spiel wird mit ?test geladen und bietet dann window.WORTMONSTER (aktuelle Aufgabe, solution()).
   Geprüft wird: Bereich „Nomen“ mit einer falschen Antwort bis zum Gewinn-Bildschirm, gemeldetes Ergebnis
   (9 von 10 beim ersten Versuch, Bestenliste „nomen“), Link zurück zur Übersicht – auf Computer und Handy. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.goto(`${game.url().split('?')[0]}?test`, { waitUntil: 'load' });
    await game.waitForFunction(() => window.WORTMONSTER && WORTMONSTER.state() === 'start');
    const sol = () => game.evaluate(() => WORTMONSTER.solution());
    const visibleHome = () => game.evaluate(() => [...document.querySelectorAll('a[href="../../#/"][target="_top"]')].some((a) => a.offsetParent !== null));

    async function solve() {
      for (let n = 0; n < 80; n++) {
        const s = await sol();
        if (s.type === 'done') return;
        if (s.type === 'wait') { await game.waitForTimeout(150); continue; }
        if (s.type === 'gaps') await game.click(`#opts .co[data-t="${s.ok[0]}"]:not(.wrong)`);
        else if (s.type === 'tap') await game.click(`#task .tw[data-i="${s.targets[0]}"]`);
        else if (s.type === 'cut') await game.click(`#task .sl[data-i="${s.starts[0]}"]`);
        else if (s.type === 'sort') {
          await game.click(`#task .chip[data-i="${s.chips[0].i}"]`);
          await game.click(`#stage .mon[data-m="${s.chips[0].m}"]`);
        }
        await game.waitForTimeout(30);
      }
      throw new Error(`Aufgabe ließ sich nicht lösen: ${JSON.stringify(await sol())}`);
    }
    async function wrong() {
      const s = await sol();
      if (s.type === 'gaps') await game.click(`#opts .co[data-t="${s.opts.find((o) => !s.ok.includes(o))}"]`);
      else if (s.type === 'tap') await game.click(`#task .tw[data-i="${s.others[0]}"]`);
      else if (s.type === 'cut') await game.click(`#task .sl[data-i="${s.others[1]}"]`);
      else if (s.type === 'sort') {
        await game.click(`#task .chip[data-i="${s.chips[0].i}"]`);
        await game.click(`#stage .mon[data-m="${s.chips[0].m === 'n' ? 'v' : 'n'}"]`);
      }
    }

    t.check(`${size}: Start mit „🏠 Alle Spiele“`, await visibleHome());
    await game.click('[data-area="nomen"]');
    t.check(`${size}: „🏠 Alle Spiele“ während des Spiels`, await visibleHome());
    for (let i = 0; i < 10; i++) {
      if (i === 0) {
        await wrong();
        t.check(`${size}: falsche Antwort → freundlicher Hinweis`, (await game.textContent('#fb')).includes('🤔'));
      }
      await solve();
      await game.waitForSelector('#nextBtn:not([hidden])');
      await game.click('#nextBtn');
    }
    await game.waitForSelector('#win:not([hidden])');
    const text = await game.textContent('#win');
    t.check(`${size}: Gewinn-Bildschirm mit 9 von 10, Zeit und „Nochmal spielen“`, text.includes('9 von 10') && text.includes('Zeit:') && text.includes('Nochmal spielen'), text.slice(0, 160));
    t.check(`${size}: Gewinn mit „🏠 Alle Spiele“`, await visibleHome());
    await page.waitForSelector('.html-game-toast');
    const s = page.scores[0] || {};
    t.check(`${size}: Ergebnis gespeichert (9 von 10, Bestenliste Nomen)`, page.scores.length === 1 && s.game_key === 'deutsch-wortmonster' && s.points === 9 && s.max_points === 10 && s.variant === 'nomen' && s.seconds >= 0, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);
  }
}
