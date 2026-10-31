const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 4 });
  await page.addInitScript(() => { try { localStorage.setItem('zenou_tour_done', 'true'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.locator('.brand-mark').first().screenshot({ path: path.resolve('../../trailer/assets/shots/logo-mark.png'), omitBackground: true });
  await browser.close();
})();
