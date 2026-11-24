/* Durchspiel-Test für „Ski-Flitzer“. Aufruf: node tools/spieltest.js ski-flitzer
   Das Spiel bietet einen Zugang window.SPIEL (items, duration, timeScale, autopilot, state(), view()).
   Geprüft wird auf Computer, Tablet (iPad quer), Handy (iPhone) hoch und quer, mit hoher Pixeldichte:
   Start-Bildschirm, 3D-Bild genau so groß wie der Bildschirm, Kackwurst von hinten im Bild (auch ohne
   Lenken), Steuerung (Pfeiltasten bzw. Knöpfe ◀ ▶), ein ganzer Lauf über 40 Spielsekunden (im Test
   beschleunigt, Autopilot sammelt ein), Zirbenschnaps mit Turbo, Neustart-Knopf (Anzeige und Pause-Fenster),
   Gewinn-Bildschirm, gespeichertes Ergebnis und „Nochmal spielen“. */
const visible = (v) => Math.abs(v.player[0]) < 0.9 && Math.abs(v.player[1]) < 0.9;

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['tablet', t.TABLET], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL && SPIEL.items.length > 0);

    if (size === 'computer') {
      const items = await game.evaluate(() => SPIEL.items.map((i) => i.name));
      const wanted = ['Aperol Spritz', 'Verband', 'Skistöcke', 'Klopapier', 'Hot Dog', 'Bier', 'Wiener Schnitzel', 'Zirbenschnaps'];
      t.check('alle gewünschten Dinge zum Einsammeln vorhanden', wanted.every((w) => items.includes(w)), items.join(', '));
      t.check('Spieldauer 40 Sekunden', (await game.evaluate(() => SPIEL.duration)) === 40);
    }
    const startText = await game.textContent('#start');
    t.check(`${size}: Serfaus-Fiss-Ladis und Fisser-Flitzer genannt`, startText.includes('Serfaus-Fiss-Ladis') && startText.includes('Fisser-Flitzer'));
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#start a[href="../../#/"]').isVisible());

    await game.click('#startBtn');
    t.check(`${size}: während des Spiels „🏠 Alle Spiele“ (Leiste des Kits)`, await game.locator('.gt-bar a[href="../../#/"]').isVisible());
    await game.evaluate(() => { SPIEL.timeScale = 4; });
    await game.waitForFunction(() => SPIEL.state().phase === 'play', null, { timeout: 60000 });

    // Bild füllt genau den Bildschirm (bei Pixeldichte 2–3 sonst nur ein vergrößerter Ausschnitt)
    let view = await game.evaluate(() => SPIEL.view());
    t.check(`${size}: 3D-Bild so groß wie der Bildschirm`, view.canvas[0] === view.screen[0] && view.canvas[1] === view.screen[1], `${view.canvas.join('×')} / ${view.screen.join('×')}`);

    // Ohne zu lenken bleibt die Wurst auf der Piste und im Bild
    await game.waitForFunction(() => SPIEL.state().timeLeft < 33, null, { timeout: 60000 });
    view = await game.evaluate(() => SPIEL.view());
    t.check(`${size}: Kackwurst ohne Lenken nach 7 s gut im Bild`, visible(view), view.player.map((n) => n.toFixed(2)).join(', '));
    if (size === 'computer' || size === 'tablet') await t.shot(page, `fahrt-${size}`);   // Handys: Foto mit Turbo weiter unten

    // Neustart-Knopf in der Anzeige: bricht den Lauf ab und beginnt sofort neu (ohne Ergebnis)
    const restartBtn = game.locator('#restartBtn');
    t.check(`${size}: Neustart-Knopf während des Spiels sichtbar`, await restartBtn.isVisible());
    const rb = await restartBtn.boundingBox();
    t.check(`${size}: Neustart-Knopf groß genug`, rb.width >= 48 && rb.height >= 48, `${rb.width}×${rb.height}`);
    await restartBtn.click();
    let st0 = await game.evaluate(() => SPIEL.state());
    t.check(`${size}: Neustart-Knopf startet neu`, st0.phase === 'countdown' && st0.points === 0 && st0.z === 0 && st0.timeLeft === 40, JSON.stringify(st0));
    if (size === 'computer') {
      // auch über das Pause-Fenster des Kits
      await game.waitForFunction(() => SPIEL.state().phase === 'play', null, { timeout: 60000 });
      await game.click('.gt-bar button[aria-label="Pause"]');
      const pauseRestart = game.locator('[data-gt="pause"] button', { hasText: 'Neu starten' });
      t.check('Pause-Fenster mit „🔄 Neu starten“', await pauseRestart.isVisible());
      await pauseRestart.click();
      st0 = await game.evaluate(() => SPIEL.state());
      t.check('„Neu starten“ im Pause-Fenster startet neu', st0.phase === 'countdown' && st0.z === 0 && await game.locator('[data-gt="pause"]').isHidden(), JSON.stringify(st0));
    }
    if (size === 'computer') {
      // Punkte-Ausgleich: jede neu gemischte Strecke bietet ungefähr gleich viele Punkte (Ziel 2500)
      const sums = [];
      for (let i = 0; i < 6; i++) { await game.evaluate(() => SPIEL.restart()); sums.push(await game.evaluate(() => SPIEL.coursePoints())); }
      const target = await game.evaluate(() => SPIEL.targetPoints);
      t.check('jede Strecke bietet ungefähr gleich viele Punkte', sums.every((p) => Math.abs(p - target) <= 250) && new Set(sums).size > 1, sums.join(', '));
    }
    t.check(`${size}: nach dem Neustart kein Ergebnis gespeichert`, page.scores.length === 0, JSON.stringify(page.scores));
    await game.waitForFunction(() => SPIEL.state().phase === 'play', null, { timeout: 60000 });

    // Zirbenschnaps: gibt Punkte und den Zirben-Turbo
    const p0 = (await game.evaluate(() => SPIEL.state())).points;
    await game.evaluate(() => { SPIEL.place('zirbe', 18); });
    if (size === 'handy') {   // Zirbenschnaps vor der Wurst fotografieren
      await game.evaluate(() => { SPIEL.timeScale = 0.01; });
      await game.waitForFunction(() => document.querySelector('canvas'));
      await t.shot(page, `zirbe-${size}`);
      await game.evaluate(() => { SPIEL.timeScale = 4; });
    }
    const turbo = await game.waitForFunction(() => SPIEL.state().turbo, null, { timeout: 20000 }).then(() => true, () => false);
    const st1 = await game.evaluate(() => SPIEL.state());
    t.check(`${size}: Zirbenschnaps eingesammelt, Turbo an`, turbo && st1.points >= p0 + 25 && await game.locator('#turboBox').isVisible(), JSON.stringify(st1));
    if (size === 'handy' || size === 'handy-quer') await t.shot(page, `turbo-${size}`);

    if (size !== 'handy-quer') {   // Lenken wie auf dem Handy hochkant – quer nur Bild, Neustart, Turbo und Ende
      // Steuerung: links/rechts so, wie man es auf dem Bildschirm sieht (Abstand zur Pistenmitte im Bild)
      const rel = () => game.evaluate(() => { const v = SPIEL.view(); return v.player[0] - v.pisteMitte[0]; });
      if (touch) {
        t.check(`${size}: Steuerknöpfe sichtbar`, await game.locator('#btnRight').isVisible() && await game.locator('#btnLeft').isVisible());
        const box = await game.locator('#btnRight').boundingBox();
        t.check(`${size}: Steuerknöpfe groß genug`, box.width >= 60 && box.height >= 60, `${box.width}×${box.height}`);
      }
      for (const [dir, sign] of [['links', -1], ['rechts', 1]]) {
        const before = await rel();
        const label = touch ? `Knopf ${sign < 0 ? '◀' : '▶'}` : `Pfeiltaste ${sign < 0 ? '←' : '→'}`;
        if (touch) await game.dispatchEvent(sign < 0 ? '#btnLeft' : '#btnRight', 'pointerdown');
        else await page.keyboard.down(sign < 0 ? 'ArrowLeft' : 'ArrowRight');
        const moved = await game.waitForFunction(([b, sg]) => {
          const v = SPIEL.view();
          return sg * (v.player[0] - v.pisteMitte[0] - b) > 0.12;
        }, [before, sign], { timeout: 30000 }).then(() => true, () => false);
        if (touch) await game.dispatchEvent(sign < 0 ? '#btnLeft' : '#btnRight', 'pointerup');
        else await page.keyboard.up(sign < 0 ? 'ArrowLeft' : 'ArrowRight');
        t.check(`${size}: ${label} lenkt auf dem Bildschirm nach ${dir}`, moved, `vorher ${before.toFixed(2)}, nachher ${(await rel()).toFixed(2)}`);
      }
      // Ganz an den Pistenrand lenken: die Wurst bleibt trotzdem im Bild
      for (const [dir, sel, key] of [['links', '#btnLeft', 'ArrowLeft'], ['rechts', '#btnRight', 'ArrowRight']]) {
        const until = (await game.evaluate(() => SPIEL.state().timeLeft)) - 2.5;
        if (touch) await game.dispatchEvent(sel, 'pointerdown'); else await page.keyboard.down(key);
        await game.waitForFunction((u) => SPIEL.state().timeLeft < u, until, { timeout: 60000 });
        const edge = await game.evaluate(() => SPIEL.view());
        if (touch) await game.dispatchEvent(sel, 'pointerup'); else await page.keyboard.up(key);
        t.check(`${size}: ganz ${dir} am Pistenrand noch im Bild`, visible(edge), edge.player.map((n) => n.toFixed(2)).join(', '));
      }
      view = await game.evaluate(() => SPIEL.view());
      t.check(`${size}: Kackwurst nach dem Lenken im Bild`, visible(view), view.player.map((n) => n.toFixed(2)).join(', '));
    }

    // Rest des Laufs beschleunigt mit Autopilot
    await game.evaluate(() => { SPIEL.autopilot = true; SPIEL.timeScale = 40; });
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
