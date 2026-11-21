/* Durchspiel-Test für „Zahlenraten“. Aufruf: node tools/spieltest.js zahlenraten
   Rät mit Intervallhalbierung (höchstens 7 Versuche), prüft Hinweise, Speichern und „Nochmal spielen“. */
export default async function (t) {
  const page = await t.newPage(t.PHONE);
  await page.goto(t.url, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="hint"]');
  t.check('Link „🏠 Alle Spiele“ sichtbar', await page.locator('main a[href="#/"]', { hasText: 'Alle Spiele' }).isVisible());

  await page.fill('input[type="number"]', '0');
  await page.click('main button');
  t.check('ungültige Zahl zählt nicht als Versuch', (await page.textContent('main')).includes('Versuche: 0'));

  let lo = 1, hi = 100, tries = 0, hint = '';
  while (tries < 10) {
    const guess = Math.floor((lo + hi) / 2);
    await page.fill('input[type="number"]', String(guess));
    await page.click('main button');
    tries++;
    hint = await page.textContent('[data-testid="hint"]');
    if (hint.includes('zu klein')) lo = guess + 1;
    else if (hint.includes('zu groß')) hi = guess - 1;
    else break;
  }
  t.check('Zahl gefunden', hint.startsWith('Richtig!'), hint);
  t.check('höchstens 7 Versuche nötig', tries <= 7, tries);
  await page.waitForFunction(() => document.body.textContent.includes('gespeichert'));
  t.check('Ergebnis gespeichert', page.scores.length === 1 && page.scores[0].game_key === 'zahlenraten' && page.scores[0].points === tries, JSON.stringify(page.scores));
  await t.shot(page, 'gewonnen');

  await page.click('text=Nochmal spielen');
  t.check('„Nochmal spielen“ startet neu', (await page.textContent('main')).includes('Versuche: 0'));
}
