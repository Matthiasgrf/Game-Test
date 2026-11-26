/* Durchspiel-Test für „Flatter, der Schmetterling“. Aufruf: node tools/spieltest.js schmetterling
   Das Spiel bietet einen Zugang window.SPIEL (state, dinge, teleport, qualleNach, memory, labyrinthWeg, zeitraffer).
   Geprüft wird auf Computer, Handy hoch und quer: Start-Bildschirm, Leiste des Kits (Pause), Steuerung
   (Pfeiltasten bzw. Steuerknüppel), Münze, Herz, Qualle (berührt → Herz weg, geschnappt → Punkte), Einhorn → Fuchs
   frisst eine Qualle, 2 × Tier-Memory (ein falsches Paar zuerst), 2 × Labyrinth, Gewinn-Bildschirm, gespeichertes
   Ergebnis, „Nochmal spielen“ – und die laufende Szene, Memory und Labyrinth als Screenshot. */
export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL);
    const st = () => game.evaluate(() => SPIEL.state());
    /* Warten mit Namen: bei einer Zeitüberschreitung steht im Ergebnis, welcher Schritt hängt */
    const warte = (name, fn, arg) => game.waitForFunction(fn, arg, { timeout: 15000 }).catch(async () => {
      throw new Error(`${size}: ${name} – Zeit abgelaufen (${JSON.stringify(await game.evaluate(() => SPIEL.state()))})`);
    });
    const phase = (p) => warte(`Phase ${p}`, (p) => SPIEL.state().phase === p, p);

    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="start"] a[href="../../#/"][target="_top"]').isVisible());
    await game.click('[data-action="start"]');
    await phase('play');

    /* Leiste und Pause aus dem Kit */
    t.check(`${size}: Leiste mit Pause und Alle Spiele`,
      await game.locator('.gt-bar [aria-label="Pause"]').isVisible() && await game.locator('.gt-bar a[href="../../#/"][target="_top"]').isVisible());
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    await game.click('[data-gt="weiter"]');
    t.check(`${size}: weiter nach der Pause`, await game.locator('[data-gt="pause"]').isHidden());

    /* Fliegen: Pfeiltaste bzw. Steuerknüppel nach oben */
    const s0 = await st();
    if (touch) {
      const joy = await game.locator('#joy').boundingBox();
      const knopf = await game.locator('#schnapp').boundingBox();
      t.check(`${size}: Steuerknüppel und Schnapp-Knopf groß genug`, joy.width >= 56 && knopf.width >= 56 && knopf.height >= 56, `${Math.round(joy.width)} / ${Math.round(knopf.width)}`);
      await game.evaluate(() => {
        const j = document.getElementById('joy'), r = j.getBoundingClientRect();
        j.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: r.left + r.width / 2, clientY: r.top + 4, bubbles: true }));
      });
      await warte('fliegen', (s) => Math.hypot(SPIEL.state().x - s.x, SPIEL.state().z - s.z) > 1, s0);
      await game.evaluate(() => document.getElementById('joy').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })));
    } else {
      await page.keyboard.down('ArrowUp');
      await warte('fliegen', (s) => Math.hypot(SPIEL.state().x - s.x, SPIEL.state().z - s.z) > 1, s0);
      await page.keyboard.up('ArrowUp');
    }
    t.check(`${size}: Flatter fliegt`, true);
    await game.evaluate(() => { const s = SPIEL.state(); SPIEL.teleport(s.x, s.z, s.rot); });
    await t.shot(page, `spiel-${size}`);

    /* Münze */
    let d = await game.evaluate(() => SPIEL.dinge());
    await game.evaluate((m) => SPIEL.teleport(m.x, m.z), d.muenzen[0]);
    await warte('Münze', () => SPIEL.state().liste.muenzen >= 10);
    t.check(`${size}: Münze gibt 10 Punkte`, (await st()).punkte >= 10);

    /* Herz durchfliegen: ein Herz mehr */
    await game.evaluate((h) => SPIEL.teleport(h.x, h.z), d.herzen[0]);
    await warte('Herz', () => SPIEL.state().liste.herzen === 20);
    t.check(`${size}: Herz gibt 20 Punkte und ein Herz`, (await st()).herzen >= 3);

    /* Qualle berührt Flatter → ein Herz weniger; danach eine Qualle schnappen */
    d = await game.evaluate(() => SPIEL.dinge());
    const herzenVorher = (await st()).herzen;
    await game.evaluate((q) => SPIEL.teleport(q.x, q.z), d.quallen[0]);
    await warte('Qualle berührt', (n) => SPIEL.state().herzen < n || SPIEL.state().ausruhen > 0, herzenVorher);
    t.check(`${size}: Qualle berührt → ein Herz weniger, Punkte bleiben`, (await st()).liste.quallen === 0);
    await game.evaluate((q) => SPIEL.teleport(q.x - 1.6, q.z, Math.PI / 2), d.quallen[1]);
    if (touch) await game.locator('#schnapp').dispatchEvent('pointerdown');
    else await page.keyboard.press('Space');
    // die eben berührte Qualle schwebt oft noch daneben – dann schnappt Flatter beide (2 × 25 Punkte)
    await warte('Qualle schnappen', () => SPIEL.state().liste.quallen >= 25);
    t.check(`${size}: Qualle geschnappt → 25 Punkte`, (await st()).liste.quallen % 25 === 0);

    /* Einhorn → Fuchs hilft und frisst eine Qualle */
    await game.evaluate((e) => SPIEL.teleport(e.x, e.z), d.einhoerner[0]);
    await warte('Einhorn', () => SPIEL.state().fuchs > 0);
    t.check(`${size}: Einhorn → Fuchs kommt`, (await st()).liste.einhoerner === 50 && await game.locator('#hud-fuchs').isVisible());
    await game.evaluate(() => {
      const d = SPIEL.dinge();
      const i = d.quallen.findIndex((q) => !q.weg);
      SPIEL.qualleNach(i, d.fuchs.x + 3, d.fuchs.z + 3);
      SPIEL.zeitraffer(3);
    });
    await warte('Fuchs frisst', () => SPIEL.state().liste.fuchs >= 25);
    await game.evaluate(() => SPIEL.zeitraffer(1));
    t.check(`${size}: Fuchs frisst eine Qualle`, true);

    /* Die 4 Zauberblumen */
    d = await game.evaluate(() => SPIEL.dinge());
    let memoryNr = 0, labNr = 0;
    for (const [i, b] of d.blumen.entries()) {
      await game.evaluate((b) => SPIEL.teleport(b.x, b.z), b);
      await phase(b.art);
      if (b.art === 'memory') {
        const tiere = await game.evaluate(() => SPIEL.memory());
        const karten = game.locator('.mem-karte');
        const box = await karten.nth(0).boundingBox();
        t.check(`${size}: Memory ${memoryNr + 1}: 20 Karten, groß genug`, tiere.length === 20 && (await karten.count()) === 20 && box.width >= 44, `${Math.round(box.width)} px`);
        if (memoryNr === 0) await t.shot(page, `memory-${size}`);
        /* zuerst ein falsches Paar */
        const falsch = tiere.findIndex((x) => x !== tiere[0]);
        await karten.nth(0).click();
        await karten.nth(falsch).click();
        t.check(`${size}: falsches Paar → freundlicher Hinweis`, (await game.textContent('#mem-rueckmeldung')).includes('merk dir'));
        await warte('Memory-Karten drehen sich zurück', () => !document.querySelector('.mem-karte.offen:not(.fertig)'));
        const fertig = new Set();
        for (let k = 0; k < 20; k++) {
          if (fertig.has(k)) continue;
          const partner = tiere.findIndex((x, j) => j !== k && x === tiere[k]);
          await karten.nth(k).click();
          await karten.nth(partner).click();
          fertig.add(k); fertig.add(partner);
        }
        memoryNr++;
      } else {
        const weg = await game.evaluate(() => SPIEL.labyrinthWeg());
        t.check(`${size}: Labyrinth ${labNr + 1} hat einen Weg zur Blume`, weg.length >= 6, weg.length);
        if (labNr === 0) await t.shot(page, `labyrinth-${size}`);
        const TASTE = { hoch: 'ArrowUp', runter: 'ArrowDown', links: 'ArrowLeft', rechts: 'ArrowRight' };
        const TITEL = { hoch: 'nach oben', runter: 'nach unten', links: 'nach links', rechts: 'nach rechts' };
        for (const [n, r] of weg.entries()) {
          if (touch && n === 0) {
            const k = game.locator(`#lab-kreuz [aria-label="${TITEL[r]}"]`);
            const box = await k.boundingBox();
            t.check(`${size}: Steuerkreuz im Labyrinth groß genug`, box.width >= 56, Math.round(box.width));
            await k.dispatchEvent('pointerdown');
            await k.dispatchEvent('pointerup');
          } else {
            await page.keyboard.press(TASTE[r]);
          }
        }
        labNr++;
      }
      await phase('geschafft');
      t.check(`${size}: Zauberblume ${i + 1} geschafft`, (await st()).geloest === i + 1);
      await game.click('[data-action="weiter"]');
    }

    await phase('ende');
    const ende = await st();
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="ende"] a[href="../../#/"]').isVisible());
    t.check(`${size}: Punkte angezeigt`, (await game.textContent('#ergebnis')).includes(`${ende.punkte} Punkte`), ende.punkte);
    t.check(`${size}: Memory und Labyrinth zählen`, ende.liste.memory >= 100 && ende.liste.labyrinth >= 200, JSON.stringify(ende.liste));
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'schmetterling' && page.scores[0].points === ende.punkte && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    await t.shot(page, `ende-${size}`);

    await game.click('[data-action="nochmal"]');
    await warte('Nochmal spielen', () => SPIEL.state().phase === 'play');
    t.check(`${size}: „Nochmal spielen“ startet neu`, await game.evaluate(() => SPIEL.state().phase === 'play' && SPIEL.state().punkte === 0 && SPIEL.state().geloest === 0), JSON.stringify(await st()));
  }
}
