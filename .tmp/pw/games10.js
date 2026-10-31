const { chromium } = require('playwright-core');
const path = require('path');
const games = ['among-us','buildnow-gg','clustertruck','crossy-road','geometry-dash','granny','hollow-knight-silksong','how-to-fish','skate-3','terraria','zenou-city'];
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'],
  });
  for (const g of games) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    const url = 'http://127.0.0.1:8000/games/' + g + '/index.html';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (g === 'zenou-city') { await page.waitForTimeout(2500); await page.click('.ov-start'); }
      await page.waitForTimeout(g === 'zenou-city' ? 2500 : 15000);
      await page.screenshot({ path: path.resolve('../game-shots/' + g + '.png') });
      const canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        try {
          const t = document.createElement('canvas'); t.width = 32; t.height = 32;
          t.getContext('2d').drawImage(c, 0, 0, 32, 32);
          const d = t.getContext('2d').getImageData(0, 0, 32, 32).data;
          let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i+1] + d[i+2];
          return Math.round(sum / (32*32*3));
        } catch (e) { return 'tainted'; }
      });
      console.log(g, '| canvas brightness:', canvas, '| errors:', errs.slice(0,2).join(' ~ ') || 'none');
    } catch (e) {
      console.log(g, 'FAILED', String(e).slice(0, 160));
    }
    await page.close();
  }
  await browser.close();
})();
