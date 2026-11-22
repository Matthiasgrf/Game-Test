/* Durchspiel-Test für „Elisabeth von Thüringen“. Aufruf: node tools/spieltest.js elisabeth
   Das Spiel bietet einen Zugang window.ELISABETH (stations, goTo(index)).
   Geprüft wird: Aufgaben sind vollständig, alle Stationen der Reihe nach, bei jeder Aufgabenart
   (eine Antwort bzw. Stimmt/Stimmt nicht, mehrere Antworten, Reihenfolge, Fehler finden, Paare) genau ein
   Fehlversuch mit freundlichem Feedback, Gewinn-Bildschirm mit Fehlversuchen und Zeit, Ergebnis wird
   gespeichert, Link zurück zur Übersicht, Bestenliste, Handy-Ansicht.
   Nach jeder Station schließt das Spiel das Fenster erst nach 2,6 s; die Test-Uhr (page.clock) springt
   über diese Wartezeit, statt sie abzuwarten (20 Stationen × 2 Größen = 1:44 min gespart). */

/* Eine Aufgabe lösen; bei der ersten Aufgabe jeder Art vorher einmal falsch antworten */
async function solve(t, game, q, tried, size) {
  const kind = q.type === 'tf' ? 'mc' : q.type;
  const firstTry = !tried.has(kind);
  tried.add(kind);
  const wrongFeedback = async (what) => t.check(`${size}: ${what} falsch → freundliches Feedback`,
    (await game.textContent('#feedback')).includes('Nicht ganz'));
  const opts = '#options-container button';
  if (q.type === 'mc' || q.type === 'tf') {
    const buttons = await game.$$(opts);
    if (firstTry) { await buttons[q.correct === 0 ? 1 : 0].click(); await wrongFeedback('eine Antwort'); }
    await buttons[q.correct].click();
  } else if (q.type === 'multi') {
    const buttons = await game.$$(opts);
    const wrong = q.options.findIndex((_, i) => !q.correctSet.includes(i));
    if (firstTry) { await buttons[wrong].click(); await game.click('#check-btn'); await wrongFeedback('mehrere Antworten'); }
    for (const i of q.correctSet) await buttons[i].click();
    await game.click('#check-btn');
  } else if (q.type === 'order') {
    const buttons = await game.$$(opts);
    if (firstTry) { await buttons[q.options.indexOf(q.items[1])].click(); await wrongFeedback('Reihenfolge'); }
    for (const item of q.items) await buttons[q.options.indexOf(item)].click();
  } else if (q.type === 'find') {
    const words = await game.$$(opts);
    if (firstTry) { await words[q.wrong === 0 ? 1 : 0].click(); await wrongFeedback('Fehler finden'); }
    await words[q.wrong].click();
    await (await game.$$('#fix-container button'))[q.fix.correct].click();
  } else if (q.type === 'pairs') {
    for (let k = 0; k < q.pairs.length; k++) {
      const [start, end] = q.pairs[k];
      await game.click(`#options-container [data-left="${q.left.indexOf(start)}"]`);
      if (firstTry && k === 0) {
        await game.click(`#options-container [data-right="${q.right.findIndex((r) => r !== end)}"]`);
        await wrongFeedback('Paare');
      }
      await game.click(`#options-container [data-right="${q.right.indexOf(end)}"]`);
    }
  }
}

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.clock.install();
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.ELISABETH && ELISABETH.stations.length > 0);
    t.check(`${size}: läuft eingebettet in der App`, await game.evaluate(() => GameTest.embedded));

    if (size === 'computer') {
      const bad = await game.evaluate(() => ELISABETH.stations.flatMap((s) => s.steps.filter((q) => {
        if (!q.question || !q.explanation) return true;
        const valid = (list, i) => list.length >= 2 && i >= 0 && i < list.length && new Set(list).size === list.length;
        if (q.type === 'mc' || q.type === 'tf') return !valid(q.options, q.correct);
        if (q.type === 'multi') return q.correctSet.length < 1 || q.correctSet.length >= q.options.length || q.correctSet.some((i) => i < 0);
        if (q.type === 'order') return q.items.length < 3 || q.options.length !== q.items.length || q.items.some((x) => !q.options.includes(x));
        if (q.type === 'find') return !(q.wrong >= 0) || !valid(q.fix.options, q.fix.correct);
        if (q.type === 'pairs') return q.pairs.some(([a, b]) => !q.left.includes(a) || !q.right.includes(b));
        return true;
      }).map((q) => s.title + ' (' + q.type + ')')));
      t.check('jede Aufgabe hat Text, Erklärung und eine gültige Lösung', bad.length === 0, bad.join(', '));
      const types = await game.evaluate(() => [...new Set(ELISABETH.stations.flatMap((s) => s.steps.map((q) => q.type)))].sort().join(','));
      t.check('alle Aufgabenarten kommen vor', types === 'find,mc,multi,order,pairs,tf', types);
    }

    await game.click('#start-modal .action-btn');
    const n = await game.evaluate(() => ELISABETH.stations.length);
    t.check(`${size}: 20 Stationen`, n === 20, n);
    const tried = new Set();
    for (let i = 0; i < n; i++) {
      await game.evaluate((i) => ELISABETH.goTo(i), i);
      await game.waitForFunction(() => document.getElementById('quiz-modal').style.display === 'block', null, { timeout: 5000 });
      const steps = await game.evaluate((i) => ELISABETH.stations[i].steps, i);
      for (let k = 0; k < steps.length; k++) {
        await solve(t, game, steps[k], tried, size);
        if (k < steps.length - 1) await game.click('#next-btn');
      }
      if (size === 'handy' && i === 1) await t.shot(page, 'aufgabe-fehler-handy');
      if (size === 'handy' && i === 14) await t.shot(page, 'aufgabe-paare-handy');
      await page.clock.fastForward(2600);
      await game.waitForFunction(() => document.getElementById('quiz-modal').style.display === 'none', null, { timeout: 6000 });
    }
    const expected = tried.size;   /* je Aufgabenart ein Fehlversuch */

    await game.waitForSelector('#end-modal', { state: 'visible' });
    t.check(`${size}: Gewinn-Bildschirm zeigt ${expected} Fehlversuche`, (await game.textContent('#final-result-text')).includes(`Fehlversuche: ${expected}`));
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis gespeichert`, page.scores.length === 1 && page.scores[0].game_key === 'elisabeth' && page.scores[0].points === expected && page.scores[0].seconds >= 0, JSON.stringify(page.scores));
    t.check(`${size}: Hinweis „gespeichert“`, (await page.textContent('.html-game-toast')).includes('gespeichert'));
    await t.shot(page, `ende-${size}`);

    await game.click('#end-modal a.action-btn');
    await page.waitForSelector('.game-tile');
    t.check(`${size}: „🏠 Alle Spiele“ führt zur Übersicht`, !(await page.$('iframe')));
  }

  // Laufende Szene auf Handy hoch und quer und auf dem Tablet: Elisabeth läuft zwischen den Stationen
  for (const [size, options] of [['handy', t.PHONE], ['handy-quer', t.PHONE_QUER], ['tablet', t.TABLET]]) {
    const p = await t.newPage(options);
    await p.goto(t.url, { waitUntil: 'load' });
    const g = await t.frame(p);
    await g.waitForFunction(() => window.ELISABETH);
    await g.click('#start-modal .action-btn');
    await g.evaluate(() => { const a = ELISABETH.stations[1], b = ELISABETH.stations[2]; ELISABETH.goTo(1); ELISABETH.player.x = (a.x + b.x) / 2; ELISABETH.player.z = a.z + 1.5; });
    await g.waitForTimeout(400);
    await t.shot(p, `spiel-${size}`);
  }

  const page = await t.newPage(t.PHONE, {
    highscores: [{ id: 1, game_key: 'elisabeth', variant: '', group_id: 1, rank: 1, username: 'testkind', points: 1, max_points: null, seconds: 300, created_at: '2026-11-21T08:00:00Z' }],
  });
  await page.goto(t.url.replace(/#.*/, '#/highscores'), { waitUntil: 'load' });
  await page.click('main .tabs button:has-text("Elisabeth")');
  await page.waitForSelector('table');
  t.check('Bestenliste zeigt Fehlversuche und Zeit', /Fehlversuche[\s\S]*Zeit/.test(await page.textContent('thead')) && (await page.textContent('tbody')).includes('5:00 min'));
  await t.shot(page, 'bestenliste-handy');
}
