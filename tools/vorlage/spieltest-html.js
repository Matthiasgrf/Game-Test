/* Durchspiel-Test für „SPIEL_TITEL“. Aufruf: node tools/spieltest.js SPIEL_KEY
   Passt zur Vorlage (Sterne-Quiz mit dem Kit). Wer das Spiel umbaut, passt diesen Test mit an.
   Das Spiel bietet einen Zugang window.SPIEL (fragen, state(), zuStern(i)).
   Geprüft wird auf Computer, Handy hoch und quer: Start-Bildschirm, Leiste des Kits (Pause, Ton,
   Alle Spiele), Pause-Fenster, Steuerung (Tasten bzw. Touch-Knöpfe ≥ 48 px), alle Fragen (eine zuerst falsch),
   Gewinn-Bildschirm, gespeichertes Ergebnis, „Nochmal spielen“ – und die laufende Szene als Screenshot. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL);
    const fragen = await game.evaluate(() => SPIEL.fragen);
    if (size === 'computer') {
      const bad = fragen.filter((q) => !q.q || !q.e || q.a.length < 2 || !(q.r >= 0 && q.r < q.a.length) || new Set(q.a).size !== q.a.length);
      t.check('jede Frage hat Text, Erklärung und genau eine gültige richtige Antwort', bad.length === 0, bad.map((q) => q.q).join(' | '));
    }
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="start"] a[href="../../#/"][target="_top"]').isVisible());
    await game.click('[data-action="start"]');
    await game.waitForFunction(() => SPIEL.state().phase === 'play');

    /* Leiste und Pause aus dem Kit */
    t.check(`${size}: Leiste mit Pause, Ton und Alle Spiele`,
      await game.locator('.gt-bar [aria-label="Pause"]').isVisible() && await game.locator('.gt-bar a[href="../../#/"][target="_top"]').isVisible());
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    await game.click('[data-gt="weiter"]');
    t.check(`${size}: weiter nach der Pause`, await game.locator('[data-gt="pause"]').isHidden());

    /* Steuerung: am Computer Pfeiltaste, auf dem Handy Touch-Knopf */
    const x0 = await game.evaluate(() => SPIEL.state().x);
    if (touch) {
      const btn = game.locator('#steuerung-links .gt-ctl').nth(1);
      const box = await btn.boundingBox();
      t.check(`${size}: Steuerknöpfe groß genug`, box && box.width >= 48 && box.height >= 48, box && `${Math.round(box.width)}×${Math.round(box.height)}`);
      await btn.dispatchEvent('pointerdown');
      await game.waitForFunction((x) => SPIEL.state().x > x + 0.05, x0);
      await btn.dispatchEvent('pointerup');
    } else {
      await page.keyboard.down('ArrowRight');
      await game.waitForFunction((x) => SPIEL.state().x > x + 0.05, x0);
      await page.keyboard.up('ArrowRight');
    }
    t.check(`${size}: Figur lässt sich lenken`, true);
    await t.shot(page, `spiel-${size}`);

    /* Alle Sterne: Figur hinsetzen, Frage beantworten (die erste zuerst falsch) */
    for (let i = 0; i < fragen.length; i++) {
      await game.evaluate((n) => SPIEL.zuStern(n), i);
      await game.waitForSelector('[data-screen="frage"]', { state: 'visible' });
      const options = game.locator('#antworten .gt-option');
      if (i === 0) {
        await options.nth(fragen[0].r === 0 ? 1 : 0).click();
        t.check(`${size}: falsche Antwort → freundlicher Hinweis`, (await game.textContent('#rueckmeldung')).includes('Versuch es noch einmal'));
      }
      await options.nth(fragen[i].r).click();
      t.check(`${size}: Frage ${i + 1} richtig → Erklärung`, (await game.textContent('#rueckmeldung')).includes(fragen[i].e));
      await game.click('[data-action="weiter"]');
    }

    await game.waitForSelector('[data-screen="ende"]', { state: 'visible' });
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="ende"] a[href="../../#/"]').isVisible());
    t.check(`${size}: Ergebnis angezeigt`, /Fehlversuche: 1 · Zeit: \d+ s/.test(await game.textContent('#ergebnis')));
    if (t.game.highscore) {
      await page.waitForSelector('.html-game-toast');
      t.check(`${size}: Ergebnis gespeichert (1 Fehlversuch)`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === 1, JSON.stringify(page.scores));
    } else {
      t.check(`${size}: kein Ergebnis gespeichert (Spiel ohne Highscore)`, page.scores.length === 0);
    }
    await t.shot(page, `ende-${size}`);

    await game.click('[data-action="nochmal"]');
    t.check(`${size}: „Nochmal spielen“ startet neu`, await game.evaluate(() => SPIEL.state().phase === 'play' && SPIEL.state().gesammelt === 0));
  }
}
