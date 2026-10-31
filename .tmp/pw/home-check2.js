const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto('http://127.0.0.1:8790/index.html', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(900);
  const skip = p.locator('button:has-text("Skip")');
  if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(500); }
  await p.screenshot({ path: '.tmp/review/home-top.png', clip: { x: 0, y: 0, width: 1440, height: 420 } });
  await p.evaluate(() => document.querySelector('#catalog, .catalogue, main').scrollIntoView());
  await p.waitForTimeout(700);
  const row = p.locator('text=Among Us').first();
  if (await row.count()) await row.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  await p.screenshot({ path: '.tmp/review/home-cat.png' });
  console.log(await p.evaluate(() => ({
    first: [...document.querySelectorAll('.card .title, .gcard .title, .card h3')].slice(0,5).map(e=>e.textContent.trim()),
    count: document.querySelectorAll('.card, .gcard').length
  })));
  await b.close();
})();
