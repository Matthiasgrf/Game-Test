/* Durchspiel-Test für „Bauer Franz und die Getreideernte“. Aufruf: node tools/spieltest.js sachunterricht-getreideernte
   Das Spiel wird mit ?test geladen und bietet dann window.BAUER (Zustand, Versetzen, Eingaben, Zeitraffer).
   Geprüft wird: alle 10 Stationen (die erste zuerst falsch), Gewinn-Bildschirm mit Fehlversuchen und Zeit,
   gespeichertes Ergebnis, nach dem Neuladen keine zweite Meldung, Link zurück zur Übersicht. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    let game = await t.frame(page);
    const base = game.url().split('?')[0];
    await game.goto(`${base}?test`, { waitUntil: 'load' });
    await game.waitForFunction(() => window.BAUER);
    const mode = (m) => game.waitForFunction((m) => BAUER.state().mode === m, m, { timeout: 20000 });
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#start-screen a[href="../../#/"][target="_top"]').isVisible());
    await game.click('#startBtn');
    await mode('play');
    t.check(`${size}: „🏠 Alle Spiele“ während des Spiels`, await game.locator('#hud a[href="../../#/"][target="_top"]').isVisible());

    for (let i = 0; i < 10; i++) {
      await game.evaluate((i) => {
        const s = BAUER.stations()[i], l = Math.hypot(s.x, s.z), d = s.r + 3;
        const x = s.x - s.x / l * d, z = s.z - s.z / l * d;
        BAUER.teleport(x, z, Math.atan2(s.x - x, s.z - z));
        BAUER.speed(12);
        BAUER.input({ fwd: 1 });
      }, i);
      await mode('quiz');
      await game.evaluate(() => { BAUER.input(null); BAUER.speed(1); });
      if (i === 0) {
        await game.click('#check-btn');
        t.check(`${size}: falsche Antwort → freundlicher Hinweis`, /Fast!/.test(await game.textContent('#feedback')));
      }
      await game.evaluate(() => document.querySelectorAll('#q-body .ans-field').forEach((f) => {
        if (f.tagName === 'INPUT') f.value = f.dataset.answer; else f.dataset.value = f.dataset.answer;
      }));
      await game.click('#check-btn');
      t.check(`${size}: Station ${i + 1} gelöst`, await game.locator('#next-btn').isVisible());
      await game.click('#next-btn');
    }

    await mode('win');
    t.check(`${size}: Gewinn-Bildschirm zeigt 1 Fehlversuch und Zeit`, /Fehlversuche: 1 · Zeit: \d+/.test(await game.textContent('#win-result')));
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'sachunterricht-getreideernte' && page.scores[0].points === 1 && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);

    // Neu laden: Spielstand bleibt, das Ergebnis wird nicht noch einmal gemeldet
    await game.goto(`${base}?test`, { waitUntil: 'load' });
    await game.waitForFunction(() => window.BAUER);
    await game.click('#startBtn');
    await mode('win');
    t.check(`${size}: nach dem Neuladen gleiches Ergebnis`, /Fehlversuche: 1/.test(await game.textContent('#win-result')));
    await game.waitForTimeout(500);
    t.check(`${size}: keine zweite Meldung`, page.scores.length === 1, page.scores.length);

    await game.click('#win-screen a[href="../../#/"]');
    await page.waitForSelector('.game-tile');
    t.check(`${size}: „🏠 Alle Spiele“ führt zur Übersicht`, !(await page.$('iframe')));
  }
}
