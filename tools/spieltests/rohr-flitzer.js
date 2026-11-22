/* Durchspiel-Test für „Rohr-Flitzer“. Aufruf: node tools/spieltest.js rohr-flitzer
   Das Spiel bietet window.SPIEL (maze(), sim(), state(), view(), loop). Der Test sucht im Rohrplan den kürzesten
   Weg (Breitensuche) und lenkt die Wurst Feld für Feld – am Computer mit Pfeiltasten, am Handy mit den Knöpfen
   (der erste Schritt durch Antippen der Szene).
   Geprüft wird auf Computer und Handy: Start-Bildschirm, die Wurst läuft nie von selbst, kurzer Druck = ein Feld,
   gedrückt halten = weiterflitzen, Pause hält die Zeit an, Gewinn-Bildschirm, gespeichertes Ergebnis,
   „Nochmal spielen“ mit neuem Rohrplan. Auf allen Größen (auch Handy quer und Tablet): Bild scharf und
   bildschirmfüllend, Haus groß, ganz im Bild und von nichts überdeckt, Foto der laufenden Szene. */
const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

/* Zustand und nächster Schritt auf dem kürzesten Weg (im Browser ausgeführt).
   straight: hinter dem nächsten Feld geht es in derselben Richtung weiter (für „gedrückt halten“). */
function nextStep() {
  const m = SPIEL.maze(), s = SPIEL.sim();
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
      const dirs = [];
      let k = key(r, c);
      while (prev.get(k)) { const [pk, d] = prev.get(k); dirs.unshift(d); k = pk; }
      dirs.push('down');
      return { dir: dirs[0], straight: dirs[1] === dirs[0], pos: [s.r, s.c], clogs: [...m.right, ...m.down].flat().filter((e) => e === 2).length };
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

/* Haus im Bild und frei, Bild so groß wie der Bildschirm */
const measure = (game) => game.evaluate(() => {
  const v = SPIEL.view();
  const h = v.house;
  const box = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return b.width && b.height && getComputedStyle(e).display !== 'none' ? b : null;
  };
  const parts = { Zeit: box('#zeit'), Leiste: box('.gt-bar') };
  if (box('#pad')) document.querySelectorAll('#pad button').forEach((b) => { parts[`Knopf ${b.textContent}`] = b.getBoundingClientRect(); });
  const hits = Object.entries(parts).filter(([, o]) => o && !(o.right <= h.x || o.left >= h.x + h.width || o.bottom <= h.y || o.top >= h.y + h.height)).map(([n]) => n);
  return {
    hits,
    inside: h.x >= -0.5 && h.y >= -0.5 && h.x + h.width <= innerWidth + 0.5 && h.y + h.height <= innerHeight + 0.5,
    share: Math.max(h.width / innerWidth, h.height / innerHeight),
    sharp: v.canvas[0] === v.screen[0] && v.canvas[1] === v.screen[1],
    text: `${Math.round(h.width)}×${Math.round(h.height)} bei ${innerWidth}×${innerHeight}, Bild ${v.canvas.join('×')}`,
  };
});

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['handy', t.PHONE], ['handy-quer', t.PHONE_QUER], ['tablet', t.TABLET]]) {
    const full = size === 'computer' || size === 'handy';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL && SPIEL.view());
    const state = () => game.evaluate(() => SPIEL.state());

    const startText = await game.textContent('[data-screen="start"]');
    t.check(`${size}: Haus Buchhammer und Fisser-Flitzer genannt`, startText.includes('Haus Buchhammer') && startText.includes('Fisser-Flitzer'));
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="start"] a[href="../../#/"]').isVisible());
    const startBtn = await game.locator('[data-action="start"]').boundingBox();
    const vp = page.viewportSize();
    t.check(`${size}: „Spülen!“ ohne Scrollen zu sehen`, startBtn && startBtn.y >= 0 && startBtn.y + startBtn.height <= vp.height, JSON.stringify(startBtn));

    const m = await measure(game);
    t.check(`${size}: Bild scharf und bildschirmfüllend`, m.sharp, m.text);
    t.check(`${size}: Haus groß (${m.text})`, m.share >= 0.85, `${Math.round(m.share * 100)} %`);
    t.check(`${size}: Haus ganz im Bild`, m.inside);
    t.check(`${size}: nichts überdeckt das Haus`, m.hits.length === 0, m.hits.join(', '));

    await game.click('[data-action="start"]');
    t.check(`${size}: während des Spiels „🏠 Alle Spiele“ (Leiste des Kits)`, await game.locator('.gt-bar a[href="../../#/"]').isVisible());
    if (size !== 'computer') t.check(`${size}: Pfeil-Knöpfe sichtbar`, await game.locator('#pad [data-dir="down"]').isVisible());

    // Ohne Eingabe: die Wurst plumpst ins erste Rohr und bleibt dort stehen
    await game.waitForFunction(() => SPIEL.state().time > 1.2, null, { timeout: 15000 });
    const still = await state();
    t.check(`${size}: Wurst läuft nicht von selbst`, still.r === 0 && !still.moving, JSON.stringify(still));
    await t.shot(page, `spiel-${size}`);
    if (!full) continue;

    // Pause: die Zeit steht
    await game.click('.gt-bar [aria-label="Pause"]');
    t.check(`${size}: Pause-Fenster`, await game.locator('[data-gt="pause"]').isVisible());
    const before = (await state()).time;
    await game.waitForTimeout(400);
    t.check(`${size}: in der Pause steht die Zeit`, (await state()).time === before);
    await game.click('[data-gt="weiter"]');

    const btn = (d) => `#pad [data-dir="${d}"]`;
    const down = (d) => (size === 'handy' ? game.dispatchEvent(btn(d), 'pointerdown') : page.keyboard.down(KEYS[d]));
    const up = (d) => (size === 'handy' ? game.dispatchEvent(btn(d), 'pointerup') : page.keyboard.up(KEYS[d]));
    const pos = async () => { const s = await state(); return [s.r, s.c]; };
    let first = null, steps = 0, held = false;
    for (let i = 0; i < 3000; i++) {
      const st = await game.evaluate(nextStep);
      if (st.done) break;
      if (st.moving) { await game.waitForTimeout(15); continue; }
      if (!st.dir) throw new Error('kein Weg in die Kanalisation');
      steps++;
      if (!first) {
        first = st;
        // kurzer Druck = genau ein Feld (Handy: auf die Szene tippen, in Richtung des nächsten Rohrs)
        if (size === 'handy') {
          const p = await game.evaluate((d) => {
            const v = SPIEL.view(), s = SPIEL.sim(), k = v.house.width / 420;
            const x = v.house.x + (18 + s.c * 64 + 32) * k, y = v.house.y + (132 + s.r * 64 + 32) * k;
            return { x: x + d[1] * 90, y: y + d[0] * 90 };
          }, D[st.dir]);
          const frameBox = await (await game.frameElement()).boundingBox();
          await page.touchscreen.tap(frameBox.x + p.x, frameBox.y + p.y);
        } else {
          await down(st.dir);
          await up(st.dir);
        }
        await game.waitForFunction(() => SPIEL.state().moving === null && SPIEL.state().time > 0, null, { timeout: 5000 });
        await game.waitForTimeout(250);
        const after = await state();
        const moved = Math.abs(after.r - st.pos[0]) + Math.abs(after.c - st.pos[1]);
        t.check(`${size}: ${size === 'handy' ? 'Tippen' : 'kurzer Druck'} bewegt genau ein Feld`, moved === 1 && !after.moving, JSON.stringify({ von: st.pos, nach: [after.r, after.c] }));
        await game.evaluate(() => { SPIEL.loop.timeScale = 3; });
        continue;
      }
      if (!held && st.straight) {
        // gedrückt halten = weiterflitzen (mindestens zwei Felder)
        held = true;
        await down(st.dir);
        await game.waitForFunction(([r, c]) => { const s = SPIEL.state(); return Math.abs(s.r - r) + Math.abs(s.c - c) >= 2; }, st.pos, { timeout: 5000 }).catch(() => {});
        await up(st.dir);
        const p = await pos();
        t.check(`${size}: gedrückt halten flitzt weiter`, Math.abs(p[0] - st.pos[0]) + Math.abs(p[1] - st.pos[1]) >= 2, JSON.stringify({ von: st.pos, nach: p }));
        continue;
      }
      await down(st.dir);
      await up(st.dir);
    }
    t.check(`${size}: Rohrsystem hat Verstopfungen`, first && first.clogs > 0, `${first?.clogs} Verstopfungen, ${steps} Schritte`);

    await game.waitForSelector('[data-screen="win"]', { state: 'visible', timeout: 10000 });
    t.check(`${size}: Gewinn-Bildschirm mit Zeit`, /\d+,\d\d Sekunden/.test(await game.textContent('#ergebnis')), await game.textContent('#ergebnis'));
    t.check(`${size}: Gewinn-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('[data-screen="win"] a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    const sc = page.scores[0];
    t.check(`${size}: Ergebnis gespeichert (${sc?.points} Hundertstel)`,
      page.scores.length === 1 && sc.game_key === 'rohr-flitzer' && sc.points >= 1 && sc.points < 6000
        && sc.seconds === Math.max(1, Math.ceil(sc.points / 100)),
      JSON.stringify(page.scores));
    await t.shot(page, `gewonnen-${size}`);

    const plan = await game.evaluate(() => JSON.stringify(SPIEL.maze()));
    await game.click('[data-action="nochmal"]');
    const again = await state();
    t.check(`${size}: „Nochmal spielen“ startet eine neue Runde`, again.phase === 'playing' && again.time < 1 && await game.evaluate(() => JSON.stringify(SPIEL.maze())) !== plan, JSON.stringify(again));
  }
}
