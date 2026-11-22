/* Durchspiel-Test für „Labyrinth-Abenteuer“. Aufruf: node tools/spieltest.js labyrinth
   Das Spiel bietet window.SPIEL (state(), plan() = Weg über alle Sterne zum Ziel, gehe('N'|'E'|'S'|'W'),
   zelle(x, y) = Bildschirm-Position einer Zelle).
   Geprüft wird auf Computer und Handy eine ganze Challenge „Leicht“ (5 Labyrinthe, alle Sterne):
   Start-Bildschirm mit drei Stufen, Leiste und Pause-Fenster, Steuerung (Pfeiltasten, Wand, Steuerkreuz,
   gedrückt halten, Ziehen mit dem Finger), Zwischen-Bildschirm, Gewinn-Bildschirm, gespeichertes Ergebnis,
   „Nochmal spielen“, „↩ Andere Stufe“ im Pause-Fenster und der Rekord auf dem Start-Bildschirm.
   Auf allen Größen (auch Handy quer und Tablet): Labyrinth groß und von nichts überdeckt, Foto der laufenden Szene.
   Die Test-Uhr (page.clock) springt über die kurze Pause nach jedem Ziel und hält das Steuerkreuz an, bis der
   Test die Zeit weiterlaufen lässt. */
const KEY = { N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft' };
const STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

/* Aufteilung: Labyrinth im Bild und frei, Anzeigen im Bild */
const measure = (game) => game.evaluate(() => {
  const box = (sel) => {
    const e = document.querySelector(sel);
    if (!e || e.hidden) return null;
    const b = e.getBoundingClientRect();
    return b.width && b.height ? b : null;
  };
  const brett = box('#brett');
  const others = { Anzeigen: box('#hud'), Aufgabe: box('#aufgabe'), Steuerkreuz: box('#kreuz'), Leiste: box('.gt-bar') };
  const hits = Object.entries(others)
    .filter(([, o]) => o && !(o.right <= brett.left || o.left >= brett.right || o.bottom <= brett.top || o.top >= brett.bottom))
    .map(([n]) => n);
  const out = Object.entries({ Labyrinth: brett, ...others })
    .filter(([, o]) => o && (o.left < -0.5 || o.top < -0.5 || o.right > innerWidth + 0.5 || o.bottom > innerHeight + 0.5))
    .map(([n]) => n);
  return {
    hits, out,
    share: Math.min(brett.width, brett.height) / Math.min(innerWidth, innerHeight),
    width: brett.width,
    text: `${Math.round(brett.width)}×${Math.round(brett.height)} bei ${innerWidth}×${innerHeight}, ${document.body.classList.contains('quer') ? 'quer' : 'hoch'}`,
  };
});

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER], ['tablet', t.TABLET]]) {
    const full = size === 'computer' || size === 'handy';
    const page = await t.newPage(options);
    await page.clock.install();
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL);
    const state = () => game.evaluate(() => SPIEL.state());
    const press = (sel, type) => game.dispatchEvent(sel, type, { pointerId: 1, isPrimary: true });

    t.check(`${size}: Start-Bildschirm mit drei Stufen`, (await game.locator('[data-screen="menu"] .stufe').count()) === 3);
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="menu"] a[href="../../#/"]').isVisible());

    await game.click(`.stufe[data-mode="${full ? 'leicht' : 'knifflig'}"]`);
    let st = await state();
    t.check(`${size}: Spiel startet`, st.phase === 'play' && st.level === 0, JSON.stringify(st));
    t.check(`${size}: „🏠 Alle Spiele“ während des Spiels (Leiste des Kits)`, await game.locator('.gt-bar a[href="../../#/"]').isVisible());
    const m = await measure(game);
    t.check(`${size}: Labyrinth groß (${m.text})`, m.share >= (size === 'tablet' ? 0.7 : 0.85), `${Math.round(m.share * 100)} %`);
    t.check(`${size}: nichts überdeckt das Labyrinth`, m.hits.length === 0, m.hits.join(', '));
    t.check(`${size}: alles im Bild`, m.out.length === 0, m.out.join(', '));
    if (size.startsWith('handy')) t.check(`${size}: Zellen auch im größten Labyrinth (11×11) groß genug`, m.width / 11 >= 30, `${Math.round(m.width / 11)} px`);
    await t.shot(page, `spiel-${size}`);

    if (!full) {
      // Ein Labyrinth lösen: Zwischen-Bildschirm
      await game.evaluate(() => SPIEL.plan().forEach((d) => SPIEL.gehe(d)));
      await page.clock.runFor(500);
      t.check(`${size}: Zwischen-Bildschirm nach dem Ziel`, await game.locator('[data-screen="level"]').isVisible());
      continue;
    }

    // Pause: Fenster mit „↩ Andere Stufe“, Figur bewegt sich nicht
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    t.check(`${size}: Pause-Fenster mit „↩ Andere Stufe“`, await game.locator('[data-gt="pause"] button', { hasText: 'Andere Stufe' }).isVisible());
    const plan0 = await game.evaluate(() => SPIEL.plan());
    await game.evaluate((d) => SPIEL.gehe(d), plan0[0]);
    t.check(`${size}: in der Pause bewegt sich nichts`, JSON.stringify((await state()).pos) === '{"x":0,"y":0}');
    await game.click('[data-gt="weiter"]');

    // Level 1 mit echter Steuerung
    if (size === 'computer') {
      await page.keyboard.press('ArrowUp'); // oben ist immer Wand
      t.check(`${size}: gegen die Wand – Figur bleibt stehen`, JSON.stringify((await state()).pos) === '{"x":0,"y":0}');
      for (const d of plan0) await page.keyboard.press(KEY[d]);
      st = await state();
      t.check(`${size}: mit den Pfeiltasten ins Ziel`, st.pos.x === 3 && st.pos.y === 3, JSON.stringify(st));
    } else {
      // erster Schritt: mit dem Finger auf das Nachbarfeld tippen
      const [dx, dy] = STEP[plan0[0]];
      const p = await game.evaluate(([x, y]) => SPIEL.zelle(x, y), [dx, dy]);
      const frameBox = await (await game.frameElement()).boundingBox();
      await page.touchscreen.tap(frameBox.x + p.x, frameBox.y + p.y);
      st = await state();
      t.check(`${size}: Antippen bewegt die Figur dorthin`, st.pos.x === dx && st.pos.y === dy, JSON.stringify(st.pos));
      for (const d of plan0.slice(1)) {
        await press(`#kreuz [data-dir="${d}"]`, 'pointerdown');
        await press(`#kreuz [data-dir="${d}"]`, 'pointerup');
      }
      st = await state();
      t.check(`${size}: mit dem Steuerkreuz ins Ziel`, st.pos.x === 3 && st.pos.y === 3, JSON.stringify(st));
    }
    await page.clock.runFor(500);
    t.check(`${size}: Zwischen-Bildschirm nach Labyrinth 1`, await game.locator('[data-screen="level"]').isVisible());
    st = await state();
    t.check(`${size}: Lob und Sterne`, /\S/.test(await game.textContent('#lob')) && (await game.locator('#lobSterne span').count()) === st.stars && (await game.locator('#lobSterne span.an').count()) === st.stars, `${st.stars} Sterne`);
    if (size === 'computer') await page.keyboard.press('Enter'); else await game.click('[data-action="weiter"]');

    for (let level = 1; level < 5; level++) {
      st = await state();
      t.check(`${size}: Labyrinth ${level + 1} (${st.size}×${st.size})`, st.phase === 'play' && st.level === level, JSON.stringify(st));
      if (size === 'handy' && level === 1) {
        // Steuerkreuz gedrückt halten: läuft weiter
        const plan = await game.evaluate(() => SPIEL.plan());
        const i = plan.findIndex((d, k) => d === plan[k + 1]);
        if (i >= 0) {
          await game.evaluate((ds) => ds.forEach((d) => SPIEL.gehe(d)), plan.slice(0, i));
          const before = (await state()).pos;
          await press(`#kreuz [data-dir="${plan[i]}"]`, 'pointerdown');
          await page.clock.runFor(230);
          await press(`#kreuz [data-dir="${plan[i]}"]`, 'pointerup');
          const after = (await state()).pos;
          const [sx, sy] = STEP[plan[i]];
          t.check(`${size}: Steuerkreuz gedrückt halten läuft weiter`, after.x === before.x + 2 * sx && after.y === before.y + 2 * sy, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        }
      }
      await game.evaluate(() => SPIEL.plan().forEach((d) => SPIEL.gehe(d)));
      await page.clock.runFor(500);
      if (level < 4) await game.click('[data-action="weiter"]');
    }

    // Gewinn-Bildschirm und Ergebnis
    await game.waitForSelector('[data-screen="fertig"]', { state: 'visible', timeout: 5000 });
    st = await state();
    const total = st.starsTotal;
    // je Labyrinth 3 Sterne (im kleinsten 4×4 manchmal nur 2), alle erreichbar, ohne über das Ziel zu laufen
    t.check(`${size}: alle Sterne gesammelt`, st.starsTotal === st.maxStars && st.maxStars >= 14, `${st.starsTotal} von ${st.maxStars}`);
    t.check(`${size}: Sterne auf dem Gewinn-Bildschirm`, (await game.textContent('#ergebnis')).includes(`${st.starsTotal} von ${st.maxStars}`));
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="fertig"] a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    const s = page.scores[0] || {};
    t.check(`${size}: Ergebnis gespeichert (Stufe, Sterne, Zeit)`, page.scores.length === 1 && s.game_key === 'labyrinth' && s.variant === 'leicht' && s.points === st.starsTotal && s.max_points === st.maxStars && s.seconds >= 0, JSON.stringify(page.scores));
    t.check(`${size}: „Neuer Rekord!“`, await game.locator('#rekord').isVisible());
    await t.shot(page, `gewonnen-${size}`);

    await game.click('[data-action="nochmal"]');
    st = await state();
    t.check(`${size}: „Nochmal spielen“ startet neu`, st.phase === 'play' && st.level === 0 && st.starsTotal === 0 && st.mode === 'leicht', JSON.stringify(st));
    await game.click('.gt-bar [aria-label="Pause"]');
    await game.click('[data-gt="pause"] button:has-text("Andere Stufe")');
    t.check(`${size}: „↩ Andere Stufe“ führt zur Stufen-Auswahl`, await game.locator('[data-screen="menu"]').isVisible() && (await state()).phase === 'menu');
    t.check(`${size}: Rekord auf dem Start-Bildschirm`, (await game.textContent('.stufe[data-mode="leicht"] small')) === `Rekord: ⭐ ${total}`, await game.textContent('.stufe[data-mode="leicht"] small'));
  }
}
