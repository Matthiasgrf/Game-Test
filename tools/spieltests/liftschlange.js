/* Durchspiel-Test für „Liftschlange“. Aufruf: node tools/spieltest.js liftschlange
   Das Spiel bietet einen Zugang window.SPIEL (timeScale, state(), step(), advance(), place(), kid(),
   holdWarden(), level(), view()). Mit timeScale 0 steht die Zeit still und der Test bewegt die Schlange
   Schritt für Schritt – so ist jeder Lauf gleich.
   Geprüft auf Computer, Tablet (iPad quer) und Handy (iPhone): Startbildschirm (Countdown, Spielerauswahl,
   Foto), Tutorial beim ersten Start, Steuerung (Pfeiltasten bzw. Steuerkreuz), Einsammeln, alle Power-ups,
   Snowboard-Kid, Liftwart-Sichtkegel → „ERWISCHT“, Game-Over-Bildschirm, gespeichertes Ergebnis (Highscores der App,
   keine eigene Bestenliste), Score teilen, Link zu den Highscores, „Nochmal spielen“ und ein echter Lauf gegen das Gitter. */
import zlib from 'node:zlib';

/* kleines PNG (32×32, einfarbig) als Test-Foto */
function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(32, 0); ihdr.writeUInt32BE(32, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(32 * (1 + 32 * 3));
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) raw.set([240, 180, 120], y * 97 + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export default async function (t) {
  for (const [size, options] of [['computer', t.DESK], ['tablet', t.TABLET], ['handy', t.PHONE]]) {
    const touch = size !== 'computer';
    const page = await t.newPage(options);
    await page.goto(t.url, { waitUntil: 'load' });
    const game = await t.frame(page);
    await game.waitForFunction(() => window.SPIEL && SPIEL.state());
    const st = () => game.evaluate(() => SPIEL.state());
    const steps = (n) => game.evaluate((k) => { for (let i = 0; i < k; i++) SPIEL.step(); }, n);
    const steer = async (dir) => {
      const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      const pads = { up: '#padUp', down: '#padDown', left: '#padLeft', right: '#padRight' };
      if (touch) await game.dispatchEvent(pads[dir], 'pointerdown');
      else await page.keyboard.press(keys[dir]);
      await page.waitForTimeout(300); // mit Jagertee kommen Eingaben manchmal verspätet an
    };

    /* Startbildschirm */
    const startText = await game.textContent('#start');
    t.check(`${size}: Start mit „Wer drängelt?“ und allen vier Freunden`, ['Wer drängelt?', 'Matze', 'Dani', 'Alex', 'Gabor'].every((w) => startText.includes(w)));
    t.check(`${size}: Countdown zum Skiurlaub`, /Skiurlaub/.test(await game.textContent('#countdown')));
    t.check(`${size}: Start-Bildschirm mit „🏠 Alle Spiele“`, await game.locator('#start a[href="../../#/"]').isVisible());
    t.check(`${size}: Start-Bildschirm mit Link zu den Highscores der App`, await game.locator('#start a[href="../../#/highscores"]').isVisible());
    await t.shot(page, `start-${size}`);
    await game.click('#p-Dani');
    t.check(`${size}: Dani ausgewählt`, (await st()).player === 'Dani' && (await game.getAttribute('#p-Dani', 'aria-pressed')) === 'true');
    if (size === 'computer') {
      await game.setInputFiles('#fotoInput', { name: 'gesicht.png', mimeType: 'image/png', buffer: png() });
      await game.waitForSelector('#fotoVorschau', { state: 'visible' });
      await game.waitForFunction(() => SPIEL.state().foto);
      t.check('Foto als Kopf übernommen (nur im Browser gespeichert)', await game.evaluate(() => !!localStorage.getItem('liftschlange_foto_v1_Dani')));
    }

    /* Start → Tutorial beim ersten Mal */
    await game.click('#startBtn');
    t.check(`${size}: Tutorial beim ersten Start`, await game.locator('#tutorial').isVisible());
    await game.click('#tutorialOk');
    await game.evaluate(() => { SPIEL.timeScale = 0; });
    let s = await st();
    t.check(`${size}: Spiel läuft, Länge 3`, s.phase === 'play' && s.length === 3 && s.points === 0, JSON.stringify(s));
    t.check(`${size}: während des Spiels „🏠 Alle Spiele“`, await game.locator('#hud a[href="../../#/"]').isVisible());
    const view = await game.evaluate(() => SPIEL.view());
    t.check(`${size}: Spielfeld passt auf den Bildschirm`, view.left >= 0 && view.top >= 0 && view.right <= view.screen[0] && view.bottom <= view.screen[1] && view.canvas[0] > 200, JSON.stringify(view));
    if (touch) {
      t.check(`${size}: Steuerkreuz sichtbar`, await game.locator('#padUp').isVisible() && await game.locator('#padRight').isVisible());
      const box = await game.locator('#padRight').boundingBox();
      t.check(`${size}: Steuerknöpfe groß genug`, box.width >= 56 && box.height >= 56, `${box.width}×${box.height}`);
      const pad = await game.locator('#pad').boundingBox();
      t.check(`${size}: Steuerkreuz überdeckt das Spielfeld nicht`, pad.x >= view.right - 1 || pad.y >= view.bottom - 1, JSON.stringify(pad));
    }

    /* Steuerung */
    const h0 = s.head;
    await steer('up'); await steps(1);
    s = await st();
    t.check(`${size}: ${touch ? 'Knopf ▲' : 'Pfeiltaste ↑'} lenkt nach oben`, s.head.x === h0.x && s.head.y === h0.y - 1, JSON.stringify(s.head));
    await steer('right'); await steps(1);
    s = await st();
    t.check(`${size}: ${touch ? 'Knopf ▶' : 'Pfeiltaste →'} lenkt nach rechts`, s.head.x === h0.x + 1 && s.head.y === h0.y - 1, JSON.stringify(s.head));

    /* Einsammeln */
    await game.evaluate(() => SPIEL.place('person'));
    await steps(2);
    s = await st();
    t.check(`${size}: Skifahrer eingesammelt → 10 Punkte, Schlange länger`, s.points === 10 && s.length === 4 && s.people === 1, JSON.stringify(s));
    await game.evaluate(() => SPIEL.place('kumpel'));
    await steps(1);
    s = await st();
    t.check(`${size}: Kumpel eingesammelt → 25 Punkte, Sprechblase`, s.points === 35 && s.bubbles > 0, JSON.stringify(s));

    /* Power-ups */
    await game.evaluate(() => SPIEL.place('jager'));
    await steps(1);
    s = await st();
    t.check(`${size}: Jagertee wirkt`, s.effects.jager > 7, JSON.stringify(s.effects));
    t.check(`${size}: Jagertee-Anzeige im HUD`, (await game.textContent('#effects')).includes('🍺'));
    await game.evaluate(() => SPIEL.place('person'));
    await steps(1);
    s = await st();
    t.check(`${size}: mit Jagertee doppelte Punkte`, s.points === 55, String(s.points));
    await game.evaluate(() => SPIEL.place('schmarrn'));
    await steps(1);
    s = await st();
    t.check(`${size}: Kaiserschmarrn bringt Bonus (doppelt mit Jagertee)`, s.points === 155, String(s.points));
    const tick = s.tickMs;
    await game.evaluate(() => SPIEL.place('williams'));
    await steps(1);
    s = await st();
    t.check(`${size}: Williams-Shot macht schneller`, s.effects.williams > 2 && s.tickMs < tick, `${tick} → ${s.tickMs}`);
    await game.evaluate(() => SPIEL.place('furz'));
    await steps(1);
    s = await st();
    t.check(`${size}: Gondel-Furz betäubt den Liftwart`, s.effects.furz > 3 && s.wardens.every((w) => w.stun > 3 && w.cone === 0), JSON.stringify(s.wardens));
    await t.shot(page, `spiel-${size}`);

    /* runter und nach links, dabei noch zwei Leute einsammeln */
    await steer('down'); await steps(1);
    await steer('left'); await steps(1);
    s = await st();
    t.check(`${size}: ${touch ? 'Knöpfe ▼ ◀' : 'Pfeiltasten ↓ ←'} lenken`, s.dir.x === -1 && s.dir.y === 0, JSON.stringify(s));
    await game.evaluate(() => SPIEL.place('person'));
    await steps(2);
    await game.evaluate(() => SPIEL.place('person'));
    await steps(2);

    /* Snowboard-Kid fährt in die Schlange und nimmt 3 Glieder */
    s = await st();
    const len = s.length;
    await game.evaluate(() => { const st = SPIEL.state(); SPIEL.kid(st.head.x + 1, st.head.y, 1); SPIEL.advance(0.04, true); });
    s = await st();
    t.check(`${size}: Snowboard-Kid kostet 3 Glieder`, s.length === len - 3 && s.kid === null && s.phase === 'play', `${len} → ${s.length}`);

    /* Liftwart: Kopf im Sichtkegel → Verdacht → ERWISCHT */
    await game.evaluate(() => {
      const h = SPIEL.state().head;
      SPIEL.holdWarden(0, { x: h.x + 1, y: h.y + 2, fx: 0, fy: -1 }); // zwei Felder unter dem Kopf, schaut nach oben
      SPIEL.advance(0.3, true);
    });
    s = await st();
    t.check(`${size}: Kopf im Blick des Liftwarts → Verdacht steigt`, s.susp > 0.05 && s.phase === 'play', JSON.stringify(s));
    await game.evaluate(() => SPIEL.advance(4, true));
    s = await st();
    t.check(`${size}: Verdacht voll → ERWISCHT`, s.phase === 'over' && s.cause === 'liftwart', JSON.stringify(s));
    await game.waitForSelector('#over', { state: 'visible' });
    t.check(`${size}: Game Over „ERWISCHT! Ab ans Ende der Schlange!“`, (await game.textContent('#overTitle')).includes('ERWISCHT'));
    t.check(`${size}: Punkte und Rang auf dem Game-Over-Bildschirm`, (await game.textContent('#finalPoints')) === String(s.points) && (await game.textContent('#overRank')).length > 3, await game.textContent('#overRank'));
    t.check(`${size}: Game Over mit „🏠 Alle Spiele“`, await game.locator('#over a[href="../../#/"]').isVisible());
    await page.waitForSelector('.html-game-toast');
    t.check(`${size}: Ergebnis in der App gespeichert`, page.scores.length === 1 && page.scores[0].game_key === t.game.key && page.scores[0].points === s.points, JSON.stringify(page.scores));
    await t.shot(page, `erwischt-${size}`);

    /* Score teilen */
    await game.click('#shareBtn');
    await game.waitForFunction(() => document.getElementById('shareInfo').textContent.length > 0);
    t.check(`${size}: Teilen-Text`, (await game.textContent('#shareText')).includes(`${s.points} Plätze vorgedrängelt`) && (await game.textContent('#shareText')).includes('ihr Pfeifen'));
    t.check(`${size}: Teilen-Knopf meldet sich`, (await game.textContent('#shareInfo')).length > 5, await game.textContent('#shareInfo'));

    /* Highscores nur in der App: Link statt eigener Bestenliste */
    t.check(`${size}: Link „🏅 Highscores“ zur Highscore-Seite der App`, await game.locator('#over a[href="../../#/highscores"]').isVisible());
    t.check(`${size}: keine eigene Bestenliste im Spiel`, await game.evaluate(() => !document.getElementById('board') && !Object.keys(localStorage).some((k) => k.includes('bestenliste'))));

    /* Nochmal spielen: ohne Tutorial, echter Lauf ohne Lenken bis ans Gitter */
    await game.evaluate(() => { SPIEL.timeScale = 1; });
    await game.click('#againBtn');
    s = await st();
    t.check(`${size}: „Nochmal spielen“ startet neu ohne Tutorial`, s.phase === 'play' && s.points === 0 && s.length === 3 && await game.locator('#tutorial').isHidden(), JSON.stringify(s));
    await game.waitForFunction(() => SPIEL.state().phase === 'over', null, { timeout: 15000 });
    s = await st();
    t.check(`${size}: ohne Lenken ans Absperrgitter → Game Over`, s.cause === 'wand', JSON.stringify(s));
    await game.waitForSelector('#over', { state: 'visible' });
    t.check(`${size}: Gitter-Text`, (await game.textContent('#overTitle')).includes('Absperrgitter'));

    /* Pause */
    await game.click('#againBtn');
    await game.click('#pauseBtn');
    t.check(`${size}: Pause-Bildschirm`, await game.locator('#pause').isVisible() && (await st()).phase === 'pause');
    await game.click('#resumeBtn');
    t.check(`${size}: weiter nach der Pause`, (await st()).phase === 'play');
  }
}
