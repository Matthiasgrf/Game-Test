/* Durchspiel-Test für „Getreide-Abenteuer“. Aufruf: node tools/spieltest.js sachunterricht-getreide
   Das Spiel hat keinen eigenen Test-Zugang; seine Funktionen und Konstanten sind global
   (stations, openQuiz). Geprüft wird: alle 10 Stationen (die erste zuerst mit falscher Antwort),
   Gewinn-Bildschirm mit Fehlversuchen und Zeit, gespeichertes Ergebnis, Link zurück zur Übersicht.
   Nach jeder gelösten Station schließt das Spiel das Fenster erst nach 1,6 s; die Test-Uhr (page.clock)
   springt darüber. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.clock.install();
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => typeof stations !== 'undefined' && stations.length === 10);
    t.check(`${size}: „🏠 Alle Spiele“ während des Spiels`, await game.locator('#hud a[href="../../#/"][target="_top"]').isVisible());

    for (let i = 0; i < 10; i++) {
      await game.evaluate((i) => openQuiz(stations[i]), i);
      if (i === 0) {
        await game.click('#check-btn');
        t.check(`${size}: falsche Antwort → freundlicher Hinweis`, /noch einmal/.test(await game.textContent('#feedback')));
      }
      await game.evaluate(() => document.querySelectorAll('#q-body .ans-field').forEach((f) => {
        if (f.tagName === 'INPUT') f.value = f.dataset.answer; else f.dataset.value = f.dataset.answer;
      }));
      await game.click('#check-btn');
      t.check(`${size}: Station ${i + 1} gelöst`, /Alles richtig/.test(await game.textContent('#feedback')));
      await page.clock.fastForward(1600);
      await game.waitForFunction(() => document.getElementById('quiz-modal').style.display === 'none', null, { timeout: 5000 });
    }

    await game.waitForSelector('#win-screen', { state: 'visible' });
    t.check(`${size}: Gewinn-Bildschirm zeigt 1 Fehlversuch`, (await game.textContent('#win-stats')).includes('Fehlversuche: 1'));
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'sachunterricht-getreide' && page.scores[0].points === 1 && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);
    await game.click('#win-screen a[href="../../#/"]');
    await page.waitForSelector('.game-tile');
    t.check(`${size}: „🏠 Alle Spiele“ führt zur Übersicht`, !(await page.$('iframe')));
  }
}
