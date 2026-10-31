const { chromium } = require('playwright-core');
const path = require('path');
const games = ['skate-3','terraria','hollow-knight-silksong','among-us'];
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
  for (const g of games) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
    try {
      await page.goto('http://127.0.0.1:8000/games/' + g + '/index.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(40000);
      await page.screenshot({ path: path.resolve('../game-shots/' + g + '-slow.png') });
      const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 180));
      console.log(g, '| text:', txt || '(none)', '| errors:', errs.slice(0,2).join(' ~ ') || 'none');
    } catch (e) { console.log(g, 'FAILED', String(e).slice(0, 140)); }
    await page.close();
  }
  await browser.close();
})();
