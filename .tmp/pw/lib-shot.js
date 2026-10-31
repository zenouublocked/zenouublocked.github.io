const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  // seed a believable library so the page is not empty
  await page.addInitScript(() => {
    try {
      localStorage.setItem('zenou_tour_done', 'true');
      localStorage.setItem('zenou_fav', JSON.stringify(['lo-hexgl','hm-moto-x3m','lo-2048','sc-568895146','cg-drift-bosses']));
      localStorage.setItem('zenou_recent', JSON.stringify([
        { id: 'lo-hexgl', t: 'HexGL', at: Date.now() - 3600e3 },
        { id: 'coffee-break', t: 'Idle Breakout', at: Date.now() - 7200e3 },
        { id: 'drift-boss', t: 'Drift Bosses', at: Date.now() - 86400e3 }
      ]));
      localStorage.setItem('zenou_playtime', JSON.stringify({ 'lo-hexgl': 5400, 'lo-2048': 1200, 'hm-moto-x3m': 2600 }));
      localStorage.setItem('zenou_playlists', JSON.stringify([{ name: 'After school', ids: ['lo-2048','lo-crossy-road','lo-clustertruck'] }]));
    } catch (e) {}
  });
  await page.goto('http://127.0.0.1:8000/library.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.resolve('../../trailer/assets/shots/library-real.png') });
  console.log('title', await page.title());
  console.log((await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 200))));
  await browser.close();
})();
