/* Gemeinsamer Durchspiel-Test für die Flugspiele aus 3c-Lernspiele
   (europaflug, deutschlandflug, weltflug). Wird von tools/spieltests/<key>.js aufgerufen.

   Das Spiel wird mit ?test geladen und bietet dann window.FLUGTEST (C, state(), score(),
   letztesZiel(), landen(c), qs = Fragen der letzten Landung). Der Test
   - startet das Spiel und prüft „🏠 Alle Spiele“ auf dem Start-Bildschirm,
   - markiert alle Ziele bis auf eines als besucht und landet beim letzten,
   - beantwortet die Fragen (erste Frage zuerst falsch → freundlicher Hinweis),
   - prüft das an die App gemeldete Ergebnis (Punkte = Punktestand des Spiels),
   - öffnet den Gewinn-Bildschirm („Nochmal spielen“, „🏠 Alle Spiele“) und kehrt zur Übersicht zurück. */
export default async function flugTest(t, { win }) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.goto(`${game.url().split('?')[0]}?test`, { waitUntil: 'load' });
    await game.waitForFunction(() => window.FLUGTEST && document.querySelector('#ov .btn'), null, { timeout: 30000 });
    t.check(`${size}: läuft eingebettet in der App`, await game.evaluate(() => GameTest.embedded));
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#ov a[href="../../#/"][target="_top"]').isVisible());
    await game.click('#ov button.btn');
    await game.waitForFunction(() => FLUGTEST.state() === 'fly', null, { timeout: 30000 });

    // Alle Ziele außer dem letzten gelten als besucht, Punktestand 0 → nach der Landung kommt der Gewinn-Bildschirm
    const n = await game.evaluate(() => { FLUGTEST.landen(FLUGTEST.letztesZiel()); return FLUGTEST.C.length; });
    t.check(`${size}: ${n} Ziele`, n > 0);

    let wrongDone = false, answered = 0;
    for (let guard = 0; guard < 10; guard++) {
      await game.waitForFunction(() => document.querySelector('#ov .card .opt:not([disabled])') || /Geschafft/.test(document.querySelector('#ov').textContent), null, { timeout: 15000 });
      if (await game.evaluate(() => /Geschafft/.test(document.querySelector('#ov').textContent))) break;
      const idx = await game.evaluate(() => {
        const title = document.querySelector('#ov .card h2').textContent;
        const q = FLUGTEST.qs.find((x) => x.t === title);
        return q.flags ? q.flags.findIndex((f) => f.id === q.ans) : q.opts.indexOf(q.ans);
      });
      const buttons = await game.$$('#ov .card .opt');
      if (!wrongDone) {
        await buttons[idx === 0 ? 1 : 0].click();
        t.check(`${size}: falsche Antwort → freundlicher Hinweis`, (await game.textContent('#ov .fb')).includes('nochmal'));
        wrongDone = true;
      }
      await buttons[idx].click();
      answered++;
      await game.waitForFunction(() => !document.querySelector('#ov .card .opt.good'), null, { timeout: 5000 });
    }
    t.check(`${size}: alle Fragen beantwortet`, answered >= 2, answered);

    await page.waitForSelector('.html-game-toast');
    const expected = await game.evaluate(() => FLUGTEST.score());
    t.check(`${size}: Punkte gemeldet und gespeichert`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === expected && expected === 10 * answered - 5,
      `${JSON.stringify(page.scores)} / Spiel: ${expected}`);

    await game.click('#ov button.btn');
    await game.waitForFunction(() => FLUGTEST.state() === 'win');
    const text = await game.textContent('#ov');
    t.check(`${size}: Gewinn-Bildschirm „${win}“ mit „Nochmal spielen“`, text.includes(win) && text.includes('Nochmal spielen'), text.slice(0, 100));
    await t.shot(page, `ende-${size}`);
    await game.click('#ov a[href="../../#/"][target="_top"]');
    await page.waitForSelector('.game-tile');
    t.check(`${size}: „🏠 Alle Spiele“ führt zur Übersicht`, !(await page.$('iframe')));
  }
}
