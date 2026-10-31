const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const shot = (n) => page.screenshot({ path: path.resolve('../trailer/assets/shots/' + n + '.png') });
  const base = 'http://127.0.0.1:8000/';
  await page.goto(base + 'index.html', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(4500);
  await shot('home');
  await page.evaluate(() => document.querySelector('#browse')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(2500);
  await shot('library');
  for (const [name, url, scroll] of [['web','web.html',0],['media','social.html',0],['music','music.html',0],['mineral','mineral.html',0],['search','search.html?q=race',0]]) {
    await page.goto(base + url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(3500);
    if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await shot(name);
  }
  await browser.close();
})();
