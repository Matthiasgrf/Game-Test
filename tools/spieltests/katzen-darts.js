/* Durchspiel-Test für „Katzen-Darts“. Aufruf: node tools/spieltest.js katzen-darts
   Das Spiel bietet einen Zugang window.SPIEL (state(), wertung(x, y), feld(feld, zahl), art(a), wurf(x, y),
   katze(typ), rufe(), loop).
   Geprüft wird auf Computer, Handy hoch und quer: Start-Bildschirm, Leiste des Kits (Pause, Ton, Alle Spiele),
   Pause-Fenster, echter Wurf mit Maus bzw. Finger (halten = Kraft laden, loslassen = werfen), Wertung der Scheibe
   (Single, Double, Triple, Bull, Bullseye, daneben), alle Katzen mit ihren Punkten und Effekten (×2, Pech,
   Oma, Hausverbot), Maßkrug (halbe Punkte, Promille) und Bierflasche (Prost-Bonus), 15 Würfe in 5 Runden,
   Abrechnung mit Titel, gespeichertes Ergebnis, „Nochmal spielen“ – und die laufende Szene als Screenshot. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL && SPIEL.layout().R > 0);

    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="start"] a[href="../../#/"][target="_top"]').isVisible());
    await game.click('[data-action="start"]');
    await game.waitForFunction(() => SPIEL.state().phase === 'play');

    /* Wertung der Scheibe (echte Dart-Regeln) */
    if (size === 'computer') {
      const w = await game.evaluate(() => {
        const p = (f, z) => { const q = SPIEL.feld(f, z); return SPIEL.wertung(q.x, q.y).punkte; };
        return { t20: p('triple', 20), d20: p('double', 20), s20: p('single', 20), t19: p('triple', 19), d3: p('double', 3), s6: p('single', 6), bull: p('bull'), outer: p('outer'), wand: p('wand') };
      });
      t.check('Scheibe: Triple 20 = 60, Double 20 = 40, Single 20 = 20', w.t20 === 60 && w.d20 === 40 && w.s20 === 20, JSON.stringify(w));
      t.check('Scheibe: Triple 19 = 57, Double 3 = 6, Single 6 = 6', w.t19 === 57 && w.d3 === 6 && w.s6 === 6, JSON.stringify(w));
      t.check('Scheibe: Bullseye 50, Bull 25, daneben 0', w.bull === 50 && w.outer === 25 && w.wand === 0, JSON.stringify(w));
      const arten = await game.evaluate(() => Object.fromEntries(Object.entries(SPIEL.katzenArten).map(([k, v]) => [k, v.punkte])));
      t.check('alle 7 Katzen mit den richtigen Punkten', JSON.stringify(arten) === JSON.stringify({ tiger: 30, pummel: 10, ski: 40, gold: 100, schwarz: -25, perser: 0, wirt: -50 }), JSON.stringify(arten));
    }

    /* Leiste und Pause aus dem Kit */
    t.check(`${size}: Leiste mit Pause, Ton und Alle Spiele`,
      await game.locator('.gt-bar [aria-label="Pause"]').isVisible() && await game.locator('.gt-bar a[href="../../#/"][target="_top"]').isVisible());
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    await game.click('[data-gt="weiter"]');
    t.check(`${size}: weiter nach der Pause`, await game.locator('[data-gt="pause"]').isHidden());
    await game.waitForFunction(() => SPIEL.state().wurfPhase === 'zielen');

    /* Echter Wurf: halten lädt die Kraft, loslassen wirft */
    await game.evaluate(() => SPIEL.art('pfeil'));
    const box = await game.locator('#szene').boundingBox();
    const mitte = await game.evaluate(() => { const l = SPIEL.layout(); return { x: l.cx, y: l.cy }; });
    if (touch) {
      const ev = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: mitte.x, clientY: mitte.y + 60, button: 0 };
      await game.locator('#szene').dispatchEvent('pointerdown', ev);
      await game.waitForFunction(() => SPIEL.state().kraft > 0.3);
      await t.shot(page, `spiel-${size}`);
      await game.locator('#szene').dispatchEvent('pointerup', ev);
    } else {
      await page.mouse.move(box.x + mitte.x, box.y + mitte.y);
      await page.mouse.down();
      await game.waitForFunction(() => SPIEL.state().kraft > 0.3);
      await t.shot(page, `spiel-${size}`);
      await page.mouse.up();
    }
    await game.waitForFunction(() => SPIEL.state().wurf === 1, null, { timeout: 5000 });
    t.check(`${size}: Wurf mit ${touch ? 'Finger' : 'Maus'} (halten und loslassen)`, true);
    await game.evaluate(() => { SPIEL.loop.timeScale = 3; });
    await game.waitForFunction(() => SPIEL.state().wurfPhase === 'zielen');
    const basis = await game.evaluate(() => SPIEL.state().gesamt);

    /* Die restlichen 14 Würfe gezielt: art, Ziel (Feld der Scheibe oder Katze), erwartetes Ergebnis */
    const wuerfe = [
      { art: 'pfeil', feld: ['bull'], erwartet: { scheibe: 50 }, name: 'Bullseye' },
      { art: 'pfeil', katze: 'ski', erwartet: { plus: 40, multi: true }, name: 'Ski-Katze +40 und ×2' },
      { art: 'pfeil', feld: ['triple', 20], erwartet: { scheibe: 120 }, name: 'Triple 20 mit ×2 = 120' },
      { art: 'pfeil', katze: 'wirt', erwartet: { minus: -50 }, ruf: 'HAUSVERBOT', name: 'Wirts-Katze −50, „Hausverbot!“' },
      { art: 'krug', feld: ['bull'], erwartet: { scheibe: 25 }, name: 'Maßkrug aufs Bullseye: halbe Punkte' },
      { art: 'flasche', feld: ['bull'], erwartet: { scheibe: 100 }, name: 'Bierflasche ins Bullseye: Prost-Bonus 100' },
      { art: 'pfeil', katze: 'schwarz', erwartet: { minus: -25, pech: 3 }, name: 'schwarze Katze −25 und Pech' },
      { art: 'pfeil', katze: 'perser', erwartet: { plus: 0, minus: 0 }, ruf: 'Oma', name: 'Omas Perserkatze 0, Oma schimpft' },
      { art: 'pfeil', katze: 'gold', erwartet: { plus: 100 }, name: 'Goldene Glückskatze +100' },
      { art: 'pfeil', katze: 'tiger', erwartet: { plus: 30 }, name: 'Tiger-Kater +30' },
      { art: 'pfeil', katze: 'pummel', erwartet: { plus: 10 }, name: 'Pummel +10' },
      { art: 'pfeil', feld: ['wand'], erwartet: { scheibe: 0 }, name: 'daneben 0' },
      { art: 'pfeil', feld: ['double', 20], erwartet: { scheibe: 40 }, name: 'Double 20' },
      { art: 'pfeil', feld: ['single', 20], erwartet: { scheibe: 20 }, name: 'Single 20' },
    ];
    let summe = basis;
    for (const [i, w] of wuerfe.entries()) {
      const r = await game.evaluate(async ({ w, nr }) => {
        SPIEL.art(w.art);
        let ziel;
        if (w.katze) ziel = SPIEL.katze(w.katze);
        else {
          ziel = SPIEL.feld(...w.feld);
          if (w.feld[0] === 'wand') { const l = SPIEL.layout(); ziel = { x: l.cx + l.R * 1.12, y: l.cy }; }
        }
        SPIEL.wurf(ziel.x, ziel.y);
        await new Promise((ok) => { const f = () => (SPIEL.state().wurf > nr ? ok() : setTimeout(f, 20)); f(); });
        return { s: SPIEL.state(), rufe: SPIEL.rufe() };
      }, { w, nr: i + 1 });
      const l = r.s.letzte;
      const ok = Object.entries(w.erwartet).every(([k, v]) => (k === 'multi' || k === 'pech' ? r.s[k] === v : l[k] === v))
        && (!w.katze || l.katzen.includes(w.katze)) && (!w.ruf || r.rufe.some((x) => x.includes(w.ruf)));
      t.check(`${size}: ${w.name}`, ok, JSON.stringify({ letzte: l, rufe: r.rufe, pech: r.s.pech, multi: r.s.multi }));
      summe += l.scheibe + l.plus + l.minus;
      if (w.art === 'krug' && touch) await t.shot(page, `bier-${size}`);
      if (i < wuerfe.length - 1) await game.waitForFunction(() => SPIEL.state().wurfPhase === 'zielen');
    }
    const st = await game.evaluate(() => SPIEL.state());
    t.check(`${size}: 5 Runden à 3 Würfe`, st.wurf === 15 && st.runde === 5, JSON.stringify({ wurf: st.wurf, runde: st.runde }));
    t.check(`${size}: Promille nach 2 Bierwürfen`, st.bier >= 2 && st.promille >= 0.6, `${st.bier} Bier, ${st.promille} ‰`);
    t.check(`${size}: Promille lassen das Fadenkreuz stärker wackeln`, st.wackelStaerke > 0, String(st.wackelStaerke));

    await game.waitForSelector('[data-screen="ende"]', { state: 'visible', timeout: 10000 });
    const gesamt = Number(await game.textContent('#gesamt'));
    t.check(`${size}: Abrechnung stimmt (${summe})`, gesamt === summe, `${gesamt} / ${summe}`);
    t.check(`${size}: Abrechnung aufgeschlüsselt mit Titel`, (await game.locator('#abrechnung tr').count()) === 5 && (await game.textContent('#ende-titel')).length > 3);
    t.check(`${size}: Ende mit „🏠 Alle Spiele“`, await game.locator('[data-screen="ende"] a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === Math.max(0, gesamt), JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);

    await game.click('[data-action="nochmal"]');
    t.check(`${size}: „Nochmal spielen“ startet neu`, await game.evaluate(() => SPIEL.state().phase === 'play' && SPIEL.state().wurf === 0 && SPIEL.state().gesamt === 0));
  }
}
