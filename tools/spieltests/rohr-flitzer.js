/* Durchspiel-Test für „Rohr-Flitzer“. Aufruf: node tools/spieltest.js rohr-flitzer
   Liest den Rohrplan über window.__rohrFlitzer, sucht den kürzesten Weg (Breitensuche)
   und steuert die Wurst mit den Pfeiltasten bis in die Kanalisation. */
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

/* Nächster Schritt auf dem kürzesten Weg von der aktuellen Zelle (im Browser ausgeführt). */
function nextStep() {
  const { maze, sim } = window.__rohrFlitzer;
  const m = maze(), s = sim();
  const ROWS = m.down.length, COLS = m.right[0].length;
  if (s.r >= ROWS) return { done: true };
  const D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const edge = (r, c, d) => d === 'right' ? (c < COLS - 1 ? m.right[r][c] : 0)
    : d === 'left' ? (c > 0 ? m.right[r][c - 1] : 0)
    : d === 'down' ? m.down[r][c] : (r > 0 ? m.down[r - 1][c] : 0);
  const key = (r, c) => r * COLS + c;
  const prev = new Map([[key(s.r, s.c), null]]);
  const queue = [[s.r, s.c]];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === ROWS - 1 && c === m.exitCol) {
      let k = key(r, c), dir = 'down';
      while (prev.get(k)) { const [pk, d] = prev.get(k); dir = d; k = pk; }
      return { dir, clogs: [...m.right, ...m.down].flat().filter((e) => e === 2).length };
    }
    for (const d of Object.keys(D)) {
      if (edge(r, c, d) !== 1) continue;
      const nr = r + D[d][0], nc = c + D[d][1];
      if (nr < 0 || nr >= ROWS || prev.has(key(nr, nc))) continue;
      prev.set(key(nr, nc), [key(r, c), d]);
      queue.push([nr, nc]);
    }
  }
  return { dir: null };
}

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE]]) {
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const home = page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' });
    await home.waitFor({ timeout: 10000 }).catch(() => {}); // Spiel wird nachgeladen
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    t.check(`${size}: Haus Buchhammer und Fisser-Flitzer genannt`,
      (await page.textContent('main')).includes('Haus Buchhammer') && (await page.textContent('main')).includes('Fisser-Flitzer'));
    if (size === 'handy') t.check('handy: Steuerkreuz sichtbar', await page.locator('.rohr-dpad-down').isVisible());
    await page.click('text=Spülen!');

    let steps = 0, first = null;
    for (; steps < 400; steps++) {
      const st = await page.evaluate(nextStep);
      if (!first) first = st;
      if (st.done) break;
      if (!st.dir) throw new Error('kein Weg in die Kanalisation');
      await page.keyboard.down(KEYS[st.dir]);
      await page.waitForTimeout(60);
      await page.keyboard.up(KEYS[st.dir]);
    }
    t.check(`${size}: Rohrsystem hat Verstopfungen`, first.clogs > 0, `${first.clogs} Verstopfungen`);

    await page.waitForSelector('text=Platsch!');
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    await page.waitForSelector('text=Zeit gespeichert');
    const sc = page.scores[0];
    t.check(`${size}: Ergebnis gespeichert (${sc?.points} s)`,
      page.scores.length === 1 && sc.game_key === 'rohr-flitzer' && sc.points >= 3 && sc.points < 60 && sc.seconds === sc.points,
      JSON.stringify(page.scores));
    await t.shot(page, `gewonnen-${size}`);

    await page.click('text=Nochmal spülen');
    await page.waitForTimeout(300);
    t.check(`${size}: „Nochmal spülen“ startet eine neue Runde`, !(await page.locator('text=Platsch!').count()));
  }
}
