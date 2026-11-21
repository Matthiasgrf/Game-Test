/* Durchspiel-Test für „SPIEL_TITEL“. Aufruf: node tools/spieltest.js SPIEL_KEY
   Passt zur Vorlage (Quiz). Wer das Spiel umbaut, passt diesen Test mit an.
   Das Spiel bietet einen Zugang window.SPIEL (questions). */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    const questions = await game.evaluate(() => window.SPIEL.questions);
    if (size === 'computer') {
      const bad = questions.filter((q) => !q.q || !q.e || q.a.length < 2 || !(q.r >= 0 && q.r < q.a.length) || new Set(q.a).size !== q.a.length);
      t.check('jede Frage hat Text, Erklärung und genau eine gültige richtige Antwort', bad.length === 0, bad.map((q) => q.q).join(' | '));
    }
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#start a[href="../../#/"]').isVisible());
    await game.click('#startBtn');
    t.check(`${size}: während des Spiels „🏠 Alle Spiele“`, await game.locator('#bar a[href="../../#/"]').isVisible());

    for (let i = 0; i < questions.length; i++) {
      t.check(`${size}: Fortschritt Frage ${i + 1} / ${questions.length}`, (await game.textContent('#progress')) === `Frage ${i + 1} / ${questions.length}`);
      const buttons = game.locator('#answers button');
      if (i === 0) {
        await buttons.nth(questions[0].r === 0 ? 1 : 0).click();
        t.check(`${size}: falsche Antwort → freundliches Feedback`, (await game.textContent('#feedback')).includes('Versuch es noch einmal'));
      }
      await buttons.nth(questions[i].r).click();
      t.check(`${size}: richtige Antwort → Erklärung`, (await game.textContent('#feedback')).includes(questions[i].e));
      await game.click('#nextBtn');
    }

    await game.waitForSelector('#win', { state: 'visible' });
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#win a[href="../../#/"]').isVisible());
    if (t.game.highscore) {
      await page.waitForSelector('.html-game-toast');
      t.check(`${size}: Ergebnis gespeichert (1 Fehlversuch)`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === 1, JSON.stringify(page.scores));
    } else {
      t.check(`${size}: kein Ergebnis gespeichert (Spiel ohne Highscore)`, page.scores.length === 0);
    }
    await t.shot(page, `gewonnen-${size}`);

    await game.click('#againBtn');
    t.check(`${size}: „Nochmal spielen“ startet bei Frage 1`, (await game.textContent('#progress')) === `Frage 1 / ${questions.length}`);
  }
}
