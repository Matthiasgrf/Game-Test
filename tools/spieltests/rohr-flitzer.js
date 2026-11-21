/* Durchspiel-Test für „Rohr-Flitzer“. Aufruf: node tools/spieltest.js rohr-flitzer
   Liest den Rohrplan über window.__rohrFlitzer, sucht den kürzesten Weg (Breitensuche)
   und lenkt die Wurst an jeder Abzweigung – am Computer mit Pfeiltasten, am Handy mit den Knöpfen. */
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const BUTTONS = { up: 'hoch', down: 'runter', left: 'links', right: 'rechts' };

/* Zustand und nächster Schritt auf dem kürzesten Weg (im Browser ausgeführt). */
function nextStep() {
  const { maze, sim } = window.__rohrFlitzer;
  const m = maze(), s = sim();
  const ROWS = m.down.length, COLS = m.right[0].length;
  if (s.r >= ROWS) return { done: true };
  if (s.moving || s.r < 0) return { moving: true };
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
    const home = page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' }).first();
    await home.waitFor({ timeout: 10000 }).catch(() => {}); // Spiel wird nachgeladen
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    const text = await page.textContent('main');
    t.check(`${size}: Haus Buchhammer und Fisser-Flitzer genannt`, text.includes('Haus Buchhammer') && text.includes('Fisser-Flitzer'));

    // Spielfeld groß genug und ohne Scrollen sichtbar
    const box = await page.locator('.rohr-stage').boundingBox();
    const vp = page.viewportSize();
    t.check(`${size}: Spielfeld füllt den Bildschirm`, box.width >= Math.min(vp.width - 40, 330) || box.height >= vp.height * 0.7, `${Math.round(box.width)}×${Math.round(box.height)}`);
    if (size === 'handy') t.check('handy: Steuerknöpfe sichtbar', await page.locator('.rohr-pad button[aria-label="runter"]').isVisible());

    await page.click('text=Spülen!');
    let first = null, turns = 0;
    for (let i = 0; i < 2000; i++) {
      const st = await page.evaluate(nextStep);
      if (st.done) break;
      if (st.moving) { await page.waitForTimeout(30); continue; }
      if (!st.dir) throw new Error('kein Weg in die Kanalisation');
      first ??= st;
      turns++;
      if (size === 'handy') await page.locator(`.rohr-pad button[aria-label="${BUTTONS[st.dir]}"]`).dispatchEvent('pointerdown');
      else await page.keyboard.press(KEYS[st.dir]);
      await page.waitForTimeout(30);
    }
    t.check(`${size}: Rohrsystem hat Verstopfungen`, first && first.clogs > 0, `${first?.clogs} Verstopfungen, ${turns} Entscheidungen`);

    await page.waitForSelector('text=Platsch!');
    await page.waitForSelector('text=Zeit gespeichert');
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await home.isVisible());
    const sc = page.scores[0];
    t.check(`${size}: Ergebnis gespeichert (${sc?.points} s)`,
      page.scores.length === 1 && sc.game_key === 'rohr-flitzer' && sc.points >= 1 && sc.points < 60 && sc.seconds === sc.points,
      JSON.stringify(page.scores));
    await t.shot(page, `gewonnen-${size}`);

    await page.click('text=Nochmal spielen');
    await page.waitForTimeout(300);
    t.check(`${size}: „Nochmal spielen“ startet eine neue Runde`, !(await page.locator('text=Platsch!').count()));
  }
}
