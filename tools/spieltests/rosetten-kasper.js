/* Durchspiel-Test für „Der Rosetten-Kasper“. Aufruf: node tools/spieltest.js rosetten-kasper
   Das Spiel bietet einen Zugang window.SPIEL (state(), objekte(art), kanonen(), buckel, setze(z, x), setDruck(d),
   risiko(r), halteX(x), loop).
   Geprüft wird auf Computer, Handy hoch und quer: Start-Bildschirm, Leiste des Kits (Pause, Ton, Alle Spiele),
   Pause-Fenster, Lenken und Zusammenkneifen (Tasten bzw. Touch-Knöpfe ≥ 48 px), Boost (mit und ohne „nicht nur
   Luft“), Knödel, Zirbenschnaps, Dixi-Klo mit Gabor, Dani, Alex, Matze, Skischule, Pistenraupe, Schanze,
   Buckelpiste, Schneekanone, Malheur bei 100 % (Ergebnis ohne Bonus), Zieleinlauf mit Abrechnung und 99-%-Bonus,
   gespeichertes Ergebnis, „Nochmal spielen“ – und die laufende Szene als Screenshot. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL);
    const st = () => game.evaluate(() => SPIEL.state());

    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="start"] a[href="../../#/"][target="_top"]').isVisible());
    await game.click('[data-action="start"]');
    await game.waitForFunction(() => SPIEL.state().phase === 'play');
    t.check(`${size}: Klemm-O-Meter sichtbar`, await game.locator('#meter').isVisible());

    /* Leiste und Pause aus dem Kit */
    t.check(`${size}: Leiste mit Pause, Ton und Alle Spiele`,
      await game.locator('.gt-bar [aria-label="Pause"]').isVisible() && await game.locator('.gt-bar a[href="../../#/"][target="_top"]').isVisible());
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    const zPause = await game.evaluate(async () => { const z = SPIEL.state().z; await new Promise((ok) => setTimeout(ok, 120)); return SPIEL.state().z - z; });
    t.check(`${size}: in der Pause steht Kasper`, zPause === 0);
    await game.click('[data-gt="weiter"]');
    t.check(`${size}: weiter nach der Pause`, await game.locator('[data-gt="pause"]').isHidden());

    /* Lenken und Kneifen: am Computer Tasten, auf dem Handy Touch-Knöpfe */
    await game.evaluate(() => SPIEL.setze(150, 0));
    const x0 = (await st()).x;
    if (touch) {
      const rechts = game.locator('#steuerung-links .gt-ctl').nth(1);
      const box = await rechts.boundingBox();
      t.check(`${size}: Steuerknöpfe groß genug`, box && box.width >= 56 && box.height >= 56, box && `${Math.round(box.width)}×${Math.round(box.height)}`);
      await rechts.dispatchEvent('pointerdown');
      await game.waitForFunction((x) => SPIEL.state().x > x + 1, x0);
      await rechts.dispatchEvent('pointerup');
    } else {
      await page.keyboard.down('ArrowRight');
      await game.waitForFunction((x) => SPIEL.state().x > x + 1, x0);
      await page.keyboard.up('ArrowRight');
    }
    t.check(`${size}: Kasper lässt sich lenken`, true);

    await game.evaluate(() => { SPIEL.setze(160, 0); SPIEL.setDruck(60); });
    await game.waitForFunction(() => SPIEL.state().v > 18);
    const kneifKnopf = game.locator('#steuerung-rechts .gt-ctl').nth(1);
    if (touch) await kneifKnopf.dispatchEvent('pointerdown'); else await page.keyboard.down('Space');
    await game.waitForFunction(() => SPIEL.state().kneift && SPIEL.state().v < 12);
    const k = await st();
    if (touch) await kneifKnopf.dispatchEvent('pointerup'); else await page.keyboard.up('Space');
    t.check(`${size}: Zusammenkneifen senkt den Druck und bremst`, k.druck < 60 && k.v < 12, `Druck ${k.druck.toFixed(1)}, Tempo ${k.v.toFixed(1)}`);

    /* Boost ohne Panne */
    await game.evaluate(() => { SPIEL.risiko(false); SPIEL.setDruck(50); });
    if (touch) { const b = game.locator('#steuerung-rechts .gt-ctl').nth(0); await b.dispatchEvent('pointerdown'); await b.dispatchEvent('pointerup'); } else await page.keyboard.press('ArrowUp');
    const b1 = await st();
    t.check(`${size}: Rückstoß-Boost: Schub und weniger Druck`, b1.boost > 0 && b1.druck < 40 && b1.pannen === 0, JSON.stringify({ boost: b1.boost, druck: b1.druck }));

    /* Laufende Szene: Dani liegt vorn quer */
    await game.evaluate(() => { SPIEL.setze(312, 0); SPIEL.setDruck(78); });
    await game.waitForFunction(() => SPIEL.state().z > 314);
    await t.shot(page, `spiel-${size}`);

    if (size === 'computer') {
      await game.evaluate(() => { SPIEL.loop.timeScale = 2; });
      /* Ereignisse der Strecke: Kasper vor das Objekt setzen, Druck merken, Ergebnis prüfen */
      const ereignis = (art, i, dx = 0, druck = 40) => game.evaluate(async ({ art, i, dx, druck }) => {
        await new Promise((ok) => { const f = () => (SPIEL.state().sturz === 0 && SPIEL.state().halt === 0 ? ok() : setTimeout(f, 10)); f(); });
        const o = SPIEL.objekte(art)[i];
        SPIEL.setDruck(druck);
        SPIEL.setze(o.z - 3, o.x + dx);
        const vorher = SPIEL.state();
        /* bewegte Hindernisse (Skischule, Pistenraupe): immer die aktuelle Position nehmen */
        const jetzt = () => SPIEL.objekte(art)[i];
        await new Promise((ok) => { const f = () => (SPIEL.state().z > jetzt().z + 1 || SPIEL.state().sturz > 0 || SPIEL.state().halt > 0 ? ok() : (SPIEL.halteX(jetzt().x + dx), setTimeout(f, 10))); f(); });
        return { vorher, nachher: SPIEL.state() };
      }, { art, i, dx, druck });

      let r = await ereignis('knoedel', 0);
      t.check('Kaspressknödel: +1 Knödel, mehr Druck', r.nachher.knoedel === r.vorher.knoedel + 1 && r.nachher.druck > 43, JSON.stringify({ k: r.nachher.knoedel, d: r.nachher.druck }));
      r = await ereignis('schnaps', 0, 0, 60);
      t.check('Zirbenschnaps: weniger Druck, Steuerung wackelig', r.nachher.druck < 45 && r.nachher.wackel > 3, JSON.stringify({ d: r.nachher.druck, w: r.nachher.wackel }));
      r = await ereignis('dixi', 0);
      t.check('Dixi-Klo: besetzt, drinnen sitzt Gabor', r.nachher.halt > 0 && /Gabor/.test(r.nachher.ruf) && r.nachher.druck > 47, r.nachher.ruf);
      for (const [art, name] of [['dani', 'Dani'], ['alex', 'Alex'], ['matze', 'Matze']]) {
        r = await ereignis(art, 0);
        t.check(`${name} als Hindernis: Sturz, mehr Druck`, r.nachher.sturz > 0 && r.nachher.ruf.includes(name) && r.nachher.druck > 49, r.nachher.ruf);
      }
      t.check('Matze fragt „Gemma no oane?“', r.nachher.ruf.includes('Gemma no oane?'));
      r = await ereignis('raupe', 0);
      t.check('Pistenraupe: Sturz', r.nachher.sturz > 0 && /Pistenraupe/.test(r.nachher.ruf), r.nachher.ruf);
      const kinder = await game.evaluate(() => SPIEL.objekte('kind').length);
      t.check('Skischulgruppen in Schlangenformation (2 Gruppen)', kinder === 13, String(kinder));
      r = await ereignis('kind', 3);
      t.check('Skischule: Sturz', r.nachher.sturz > 0 && /Skischule/.test(r.nachher.ruf), r.nachher.ruf);

      /* Schanze: Sprung, Landung lässt das Klemm-O-Meter hochschnellen */
      r = await ereignis('schanze', 0);
      t.check('Schanze: Sprung', r.nachher.spruenge === 1 && r.nachher.luft > 0, JSON.stringify({ s: r.nachher.spruenge, l: r.nachher.luft }));
      const lande = await game.evaluate(async () => { const d = SPIEL.state().druck; await new Promise((ok) => { const f = () => (SPIEL.state().luft === 0 ? ok() : setTimeout(f, 10)); f(); }); return { d, n: SPIEL.state().druck, ruf: SPIEL.state().ruf }; });
      t.check('Landung: Druck +14', lande.n - lande.d >= 13, JSON.stringify(lande));

      /* Buckelpiste und Schneekanone: Druck steigt schneller */
      const rate = (z, x) => game.evaluate(async ({ z, x }) => {
        SPIEL.setze(z, x); SPIEL.setDruck(30);
        const t0 = SPIEL.state().t;
        await new Promise((ok) => { const f = () => (SPIEL.state().t > t0 + 1 ? ok() : (SPIEL.halteX(x), setTimeout(f, 10))); f(); });
        const s = SPIEL.state();
        return { rate: (s.druck - 30) / (s.t - t0), buckel: s.buckel, kanone: s.kanone };
      }, { z, x });
      const normal = await rate(1300, 0);
      const bu = await rate(650, 0);
      t.check('Buckelpiste: Druck steigt schneller', bu.buckel && bu.rate > normal.rate + 3, JSON.stringify({ normal, bu }));
      const kan = (await game.evaluate(() => SPIEL.kanonen()))[0];
      const ka = await rate(kan.z - 2, kan.s * (kan.rand - 3));
      t.check('Schneekanone: Kälteschock, Druck steigt', ka.kanone && ka.rate > normal.rate + 6, JSON.stringify(ka));

      /* Boost mit Panne */
      await game.evaluate(() => { SPIEL.setze(1300, 0); SPIEL.setDruck(85); SPIEL.risiko(true); });
      await game.waitForFunction(() => SPIEL.state().sturz === 0 && SPIEL.state().halt === 0);
      await page.keyboard.press('ArrowUp');
      const p = await st();
      t.check('Boost: „nicht nur Luft“ zählt als Panne', p.pannen === 1 && /nicht nur Luft/.test(p.ruf), p.ruf);
      await game.evaluate(() => SPIEL.risiko(null));

      /* Malheur: Klemm-O-Meter voll */
      await game.evaluate(() => SPIEL.setDruck(99.9));
      await game.waitForSelector('[data-screen="malheur"]', { state: 'visible', timeout: 8000 });
      t.check('Malheur bei 100 %: „Kasper hat\'s nicht gepackt“', (await game.textContent('[data-screen="malheur"] h1')).includes("Kasper hat's nicht gepackt"));
      t.check('Malheur-Fenster mit „🏠 Alle Spiele“', await game.locator('[data-screen="malheur"] a[href="../../#/"]').isVisible());
      await t.shot(page, 'malheur-computer');
      const m = (await st()).ergebnis;
      const mGesamt = Number(await game.textContent('#malheur-gesamt'));
      t.check('Malheur: Punkte ohne Ankunfts-, Zeit- und 99-%-Bonus', m.malheur && mGesamt === m.gesamt
        && m.zeilen[0][1] === Math.min(400, Math.floor(m.meter / 5)) && !m.zeilen.some(([text]) => /Angekommen|Zeit|%/.test(text)), JSON.stringify(m.zeilen));
      await page.waitForSelector('.html-game-toast');
      t.check('Malheur: Ergebnis gespeichert', page.scores.length === 1 && page.scores[0].points === mGesamt, JSON.stringify(page.scores));
      page.scores.length = 0;
      await game.click('[data-screen="malheur"] [data-action="nochmal"]');
      t.check('„Nochmal spielen“ nach dem Malheur', await game.evaluate(() => SPIEL.state().phase === 'play' && SPIEL.state().z < 5 && SPIEL.state().druck < 35));
      await game.evaluate(() => { for (const n of [0, 1]) { const o = SPIEL.objekte('knoedel')[n]; SPIEL.setze(o.z - 1, o.x); } });
      await game.waitForFunction(() => SPIEL.state().knoedel >= 1);
    }

    /* Zieleinlauf mit 99 % */
    await game.evaluate(() => { SPIEL.loop.timeScale = 1; SPIEL.setze(SPIEL.LAENGE - 2, 6); SPIEL.setDruck(99.1); });
    await game.waitForSelector('[data-screen="ende"]', { state: 'visible', timeout: 8000 });
    const e = (await st()).ergebnis;
    const summe = e.zeilen.reduce((s, [, p]) => s + p, 0);
    const gesamt = Number(await game.textContent('#gesamt'));
    t.check(`${size}: Abrechnung stimmt (${summe})`, gesamt === summe && gesamt === e.gesamt, `${gesamt} / ${summe}`);
    t.check(`${size}: Bonus „Mit 99 % ins Ziel“`, e.zeilen.some(([text, p]) => /99 %/.test(text) && p === 1500), JSON.stringify(e.zeilen));
    t.check(`${size}: Titel angezeigt`, (await game.textContent('#ende-titel')).length > 3);
    t.check(`${size}: Ende mit „🏠 Alle Spiele“`, await game.locator('[data-screen="ende"] a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    for (let i = 0; i < 100 && !page.scores.length; i++) await page.waitForTimeout(50);   // auf das Ergebnis warten
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === gesamt, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);

    await game.click('[data-screen="ende"] [data-action="nochmal"]');
    t.check(`${size}: „Nochmal spielen“ startet neu`, await game.evaluate(() => SPIEL.state().phase === 'play' && SPIEL.state().knoedel === 0 && SPIEL.state().z < 5));
  }
}
