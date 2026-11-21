/* Durchspiel-Test für „SPIEL_TITEL“. Aufruf: node tools/spieltest.js SPIEL_KEY
   Passt zur Vorlage (Quiz). Wer das Spiel umbaut, passt diesen Test mit an.
   Spielt das Quiz durch, indem es nacheinander die Antworten probiert. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const home = page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' });
    await home.waitFor({ timeout: 10000 }).catch(() => {}); // Spiel wird nachgeladen
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    await page.click('text=Los geht');

    let mistakes = 0, questions = 0;
    while (await page.locator('main', { hasText: /Frage \d+ \/ \d+/ }).count()) {
      questions++;
      const buttons = page.locator('main .quiz-btn:not(.main)');
      for (let i = 0; i < await buttons.count(); i++) {
        if (await buttons.nth(i).isDisabled()) continue;
        await buttons.nth(i).click();
        if (await page.locator('text=Richtig!').count()) break;
        mistakes++;
        t.check(`${size}: falsche Antwort → freundliches Feedback`, await page.locator('text=Versuch es noch einmal').isVisible());
      }
      await page.click('text=Weiter');
      if (questions > 100) throw new Error('Quiz endet nicht');
    }

    await page.waitForSelector('text=Geschafft!');
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    if (t.game.highscore) {
      await page.waitForSelector('text=gespeichert');
      t.check(`${size}: Ergebnis gespeichert (${mistakes} Fehlversuche)`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === mistakes, JSON.stringify(page.scores));
    } else {
      t.check(`${size}: kein Ergebnis gespeichert (Spiel ohne Highscore)`, page.scores.length === 0);
    }
    await t.shot(page, `gewonnen-${size}`);

    await page.click('text=Nochmal spielen');
    t.check(`${size}: „Nochmal spielen“ startet bei Frage 1`, await page.locator('text=Frage 1 /').isVisible());
  }
}
