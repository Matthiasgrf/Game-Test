/* Durchspiel-Test für „Die Formen-Werkstatt“. Aufruf: node tools/spieltest.js mathe-formen
   Das Spiel wird mit ?test geladen und bietet dann window.FORMEN (aktuelle Aufgabe, richtige Antwort, Spiegel-Gitter).
   Geprüft wird: Thema „Spiegeln“ mit einer falschen Antwort bis zur Rakete, Fehlversuche und Zeit auf dem
   Gewinn-Bildschirm, gespeichertes Ergebnis, Link zurück zur Übersicht – auf Computer und Handy. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.goto(`${game.url().split('?')[0]}?test`, { waitUntil: 'load' });
    await game.waitForFunction(() => window.FORMEN && FORMEN.state() === 'start');
    const visibleHome = () => game.evaluate(() => [...document.querySelectorAll('a[href="../../#/"][target="_top"]')].some((a) => a.offsetParent !== null));

    t.check(`${size}: Start mit „🏠 Alle Spiele“`, await visibleHome());
    await game.click('[data-topic="spiegel"]');
    t.check(`${size}: „🏠 Alle Spiele“ während des Spiels`, await visibleHome());
    for (let i = 0; i < 10; i++) {
      const task = await game.evaluate(() => ({ grid: !!FORMEN.task().grid, r: FORMEN.right(), n: FORMEN.task().opts ? FORMEN.task().opts.length : 0 }));
      if (i === 0) {
        if (task.grid) { await game.evaluate(() => FORMEN.fillGrid(false)); await game.click('#opts .opt'); }
        else await game.click(`#opts .opt:nth-child(${((task.r + 1) % task.n) + 1})`);
        t.check(`${size}: falsche Antwort → Hinweis mit Tipp`, (await game.textContent('#fb')).includes('Tipp:'));
      }
      if (task.grid) { await game.evaluate(() => FORMEN.fillGrid(true)); await game.click('#opts .opt'); }
      else await game.click(`#opts .opt:nth-child(${task.r + 1})`);
      await game.waitForSelector('#nextBtn:not([hidden])');
      await game.click('#nextBtn');
    }
    await game.waitForSelector('#win:not([hidden])');
    t.check(`${size}: Gewinn-Bildschirm zeigt 1 Fehlversuch und Zeit`, /Fehlversuche: 1 · Zeit: \d+/.test(await game.textContent('#winResult')));
    t.check(`${size}: Gewinn mit „🏠 Alle Spiele“`, await visibleHome());
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'mathe-formen' && page.scores[0].points === 1 && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);
    await game.click('#againBtn');
    t.check(`${size}: „Nochmal spielen“ beginnt bei Auftrag 1`, (await game.textContent('#progress')) === 'Auftrag 1 / 10');
  }
}
