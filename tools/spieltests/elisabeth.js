/* Durchspiel-Test für „Elisabeth von Thüringen“. Aufruf: node tools/spieltest.js elisabeth
   Das Spiel bietet einen Zugang window.ELISABETH (stations, goTo(index)).
   Geprüft wird: Fragen sind vollständig, alle Stationen der Reihe nach (mit einer falschen Antwort),
   Gewinn-Bildschirm mit Fehlversuchen und Zeit, Ergebnis wird gespeichert, Link zurück zur Übersicht,
   Bestenliste, Handy-Ansicht.
   Nach jeder Station schließt das Spiel das Fenster erst nach 2,6 s; die Test-Uhr (page.clock) springt
   über diese Wartezeit, statt sie abzuwarten (20 Stationen × 2 Größen = 1:44 min gespart). */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.clock.install();
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.ELISABETH && ELISABETH.stations.length > 0);
    t.check(`${size}: läuft eingebettet in der App`, await game.evaluate(() => GameTest.embedded));

    if (size === 'computer') {
      const bad = await game.evaluate(() => ELISABETH.stations.flatMap((s) => s.steps
        .filter((q) => !q.question || !q.explanation || q.options.length < 2 || !(q.correct >= 0 && q.correct < q.options.length) || new Set(q.options).size !== q.options.length)
        .map(() => s.title)));
      t.check('jede Frage hat Text, Erklärung und genau eine gültige richtige Antwort', bad.length === 0, bad.join(', '));
    }

    await game.click('#start-modal .action-btn');
    const n = await game.evaluate(() => ELISABETH.stations.length);
    t.check(`${size}: 20 Stationen`, n === 20, n);
    let wrong = false;
    for (let i = 0; i < n; i++) {
      await game.evaluate((i) => ELISABETH.goTo(i), i);
      await game.waitForFunction(() => document.getElementById('quiz-modal').style.display === 'block', null, { timeout: 5000 });
      const steps = await game.evaluate((i) => ELISABETH.stations[i].steps.map((q) => q.correct), i);
      for (let k = 0; k < steps.length; k++) {
        const buttons = await game.$$('#options-container button');
        if (!wrong) {
          await buttons[steps[k] === 0 ? 1 : 0].click();
          t.check(`${size}: falsche Antwort → freundliches Feedback`, (await game.textContent('#feedback')).includes('Nicht ganz'));
          wrong = true;
        }
        await buttons[steps[k]].click();
        if (k < steps.length - 1) await game.click('#next-btn');
      }
      await page.clock.fastForward(2600);
      await game.waitForFunction(() => document.getElementById('quiz-modal').style.display === 'none', null, { timeout: 6000 });
    }

    await game.waitForSelector('#end-modal', { state: 'visible' });
    t.check(`${size}: Gewinn-Bildschirm zeigt 1 Fehlversuch`, (await game.textContent('#final-result-text')).includes('Fehlversuche: 1'));
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'elisabeth' && page.scores[0].points === 1 && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    t.check(`${size}: Hinweis „gespeichert“`, (await page.textContent('.html-game-toast')).includes('gespeichert'));
    await t.shot(page, `ende-${size}`);

    await game.click('#end-modal a.action-btn');
    await page.waitForSelector('.game-tile');
    t.check(`${size}: „🏠 Alle Spiele“ führt zur Übersicht`, !(await page.$('iframe')));
  }

  const page = await t.newPage(t.PHONE, {
    highscores: [{ id: 1, game_key: 'elisabeth', variant: '', group_id: 1, rank: 1, username: 'testkind', points: 1, max_points: null, seconds: 300, created_at: '2026-11-21T08:00:00Z' }],
  });
  await page.goto(t.url.replace(/#.*/, '#/highscores'), { waitUntil: 'load' });
  await page.click('main .tabs button:has-text("Elisabeth")');
  await page.waitForSelector('table');
  t.check('Bestenliste zeigt Fehlversuche und Zeit', /Fehlversuche[\s\S]*Zeit/.test(await page.textContent('thead')) && (await page.textContent('tbody')).includes('5:00 min'));
  await t.shot(page, 'bestenliste-handy');
}
