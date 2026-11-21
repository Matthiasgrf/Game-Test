/* Durchspiel-Test für „Ski-Flitzer“. Aufruf: node tools/spieltest.js ski-flitzer
   Das Spiel bietet einen Zugang window.SPIEL (items, duration, timeScale, autopilot, state()).
   Geprüft wird: Start-Bildschirm, Steuerung (Computer: Pfeiltasten, Handy: Knöpfe ◀ ▶),
   ein ganzer Lauf über 40 Spielsekunden (im Test beschleunigt, Autopilot sammelt ein),
   Gewinn-Bildschirm, gespeichertes Ergebnis und „Nochmal spielen“. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL && SPIEL.items.length > 0);

    if (size === 'computer') {
      const items = await game.evaluate(() => SPIEL.items.map((i) => i.name));
      const wanted = ['Aperol Spritz', 'Verband', 'Skistöcke', 'Klopapier', 'Hot Dog', 'Bier', 'Wiener Schnitzel'];
      t.check('alle gewünschten Dinge zum Einsammeln vorhanden', wanted.every((w) => items.includes(w)), items.join(', '));
      t.check('Spieldauer 40 Sekunden', (await game.evaluate(() => SPIEL.duration)) === 40);
    }
    const startText = await game.textContent('#start');
    t.check(`${size}: Serfaus-Fiss-Ladis und Fisser-Flitzer genannt`, startText.includes('Serfaus-Fiss-Ladis') && startText.includes('Fisser-Flitzer'));
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#start a[href="../../#/"]').isVisible());

    await game.click('#startBtn');
    t.check(`${size}: während des Spiels „🏠 Alle Spiele“`, await game.locator('#hud a[href="../../#/"]').isVisible());
    await game.evaluate(() => { SPIEL.timeScale = 4; });
    await game.waitForFunction(() => SPIEL.state().phase === 'play', null, { timeout: 60000 });

    // Steuerung: nach links bzw. rechts lenken
    const x0 = await game.evaluate(() => SPIEL.state().x);
    if (size === 'computer') {
      await page.keyboard.down('ArrowLeft');
      await game.waitForFunction((x0) => SPIEL.state().x < x0 - 1, x0, { timeout: 30000 }).catch(() => {});
      await page.keyboard.up('ArrowLeft');
      t.check('computer: Pfeiltaste ← lenkt nach links', (await game.evaluate(() => SPIEL.state().x)) < x0 - 1);
    } else {
      t.check('handy: Steuerknöpfe sichtbar', await game.locator('#btnRight').isVisible());
      const box = await game.locator('#btnRight').boundingBox();
      t.check('handy: Steuerknöpfe groß genug', box.width >= 60 && box.height >= 60, `${box.width}×${box.height}`);
      await game.dispatchEvent('#btnRight', 'pointerdown');
      await game.waitForFunction((x0) => SPIEL.state().x > x0 + 1, x0, { timeout: 30000 }).catch(() => {});
      await game.dispatchEvent('#btnRight', 'pointerup');
      t.check('handy: Knopf ▶ lenkt nach rechts', (await game.evaluate(() => SPIEL.state().x)) > x0 + 1);
    }

    // Rest des Laufs beschleunigt mit Autopilot
    await game.evaluate(() => { SPIEL.autopilot = true; SPIEL.timeScale = 25; });
    await game.waitForSelector('#win', { state: 'visible', timeout: 180000 });
    const st = await game.evaluate(() => SPIEL.state());
    t.check(`${size}: Dinge eingesammelt`, st.collected > 0 && st.points > 0, JSON.stringify(st));
    t.check(`${size}: Punkte auf dem Gewinn-Bildschirm`, (await game.textContent('#finalPoints')) === String(st.points));
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#win a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === st.points, JSON.stringify(page.scores));
    await t.shot(page, `gewonnen-${size}`);

    await game.evaluate(() => { SPIEL.autopilot = false; SPIEL.timeScale = 1; });
    await game.click('#againBtn');
    const again = await game.evaluate(() => SPIEL.state());
    t.check(`${size}: „Nochmal spielen“ startet neu`, again.phase === 'countdown' && again.points === 0 && again.z === 0, JSON.stringify(again));
  }
}
